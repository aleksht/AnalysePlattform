-- Aksjeinnsikt: grunnskjema
-- folders, stocks, research_runs, sources, findings med Row Level Security per bruker.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Mapper
-- ---------------------------------------------------------------------------
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index folders_user_idx on public.folders (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- Aksjer
-- ---------------------------------------------------------------------------
create table public.stocks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id        uuid references public.folders (id) on delete set null,
  name             text not null check (char_length(name) between 1 and 120),
  ticker           text not null check (char_length(ticker) between 1 and 20),
  exchange         text check (exchange is null or char_length(exchange) <= 60),
  notes            text,
  -- Siste oversikt fra researchagenten: beskrivelse, segmenter, kunder, konkurrenter
  overview         jsonb,
  -- Samlet stemning fra siste kjøring, -1 (negativ) til 1 (positiv)
  sentiment_score  numeric(4, 3) check (sentiment_score between -1 and 1),
  sentiment_label  text check (sentiment_label in ('positiv', 'nøytral', 'negativ', 'blandet')),
  last_run_at      timestamptz,
  weekly_auto      boolean not null default true,
  created_at       timestamptz not null default now()
);
create index stocks_user_idx on public.stocks (user_id);
create index stocks_folder_idx on public.stocks (folder_id);

-- ---------------------------------------------------------------------------
-- Researchkjøringer
-- ---------------------------------------------------------------------------
create table public.research_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stock_id       uuid not null references public.stocks (id) on delete cascade,
  status         text not null default 'queued'
                 check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  trigger        text not null default 'manual' check (trigger in ('manual', 'weekly')),
  current_step   text,
  steps_total    integer not null default 0,
  steps_done     integer not null default 0,
  summary_md     text,
  theme_scores   jsonb,
  trend          jsonb,
  model          text,
  input_tokens   bigint not null default 0,
  output_tokens  bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  web_searches   integer not null default 0,
  web_fetches    integer not null default 0,
  cost_usd       numeric(10, 4) not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
create index research_runs_stock_idx on public.research_runs (stock_id, created_at desc);
create index research_runs_user_idx on public.research_runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Kilder (én rad per unik URL per kjøring)
-- ---------------------------------------------------------------------------
create table public.sources (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  run_id        uuid not null references public.research_runs (id) on delete cascade,
  stock_id      uuid not null references public.stocks (id) on delete cascade,
  url           text not null,
  title         text,
  source_type   text not null,
  published_at  date,
  accessed_at   timestamptz not null default now(),
  unique (run_id, url)
);
create index sources_run_idx on public.sources (run_id);

-- ---------------------------------------------------------------------------
-- Funn
-- ---------------------------------------------------------------------------
create table public.findings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  run_id             uuid not null references public.research_runs (id) on delete cascade,
  stock_id           uuid not null references public.stocks (id) on delete cascade,
  source_id          uuid references public.sources (id) on delete set null,
  claim              text not null,
  category           text not null
                     check (category in ('kunder', 'ansatte', 'ledelse', 'nyheter', 'konkurrenter')),
  theme              text not null,
  sentiment          text not null check (sentiment in ('positiv', 'nøytral', 'negativ')),
  quote              text,
  is_paraphrase      boolean not null default true,
  source_url         text not null,
  source_type        text not null,
  published_at       date,
  evidence_strength  text not null check (evidence_strength in ('sterk', 'middels', 'svak')),
  is_red_flag        boolean not null default false,
  created_at         timestamptz not null default now()
);
create index findings_run_idx on public.findings (run_id, category);
create index findings_stock_idx on public.findings (stock_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.folders       enable row level security;
alter table public.stocks        enable row level security;
alter table public.research_runs enable row level security;
alter table public.sources       enable row level security;
alter table public.findings      enable row level security;

-- Mapper: full tilgang til egne
create policy "folders_select_own" on public.folders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "folders_insert_own" on public.folders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "folders_update_own" on public.folders
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "folders_delete_own" on public.folders
  for delete to authenticated using (user_id = (select auth.uid()));

-- Aksjer: full tilgang til egne, og mappen må også være din
create policy "stocks_select_own" on public.stocks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "stocks_insert_own" on public.stocks
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())
    ))
  );
create policy "stocks_update_own" on public.stocks
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())
    ))
  );
create policy "stocks_delete_own" on public.stocks
  for delete to authenticated using (user_id = (select auth.uid()));

-- Kjøringer: brukeren kan lese, starte (for egne aksjer) og slette.
-- Statusoppdateringer gjøres av bakgrunnsjobben med service-rollen.
create policy "runs_select_own" on public.research_runs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "runs_insert_own" on public.research_runs
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stocks s where s.id = stock_id and s.user_id = (select auth.uid())
    )
  );
create policy "runs_delete_own" on public.research_runs
  for delete to authenticated using (user_id = (select auth.uid()));

-- Kilder og funn skrives kun av bakgrunnsjobben; brukeren kan lese egne.
create policy "sources_select_own" on public.sources
  for select to authenticated using (user_id = (select auth.uid()));
create policy "findings_select_own" on public.findings
  for select to authenticated using (user_id = (select auth.uid()));
