-- Aksjeinnsikt: innsiktsmodus, trend og ukentlig kjøring
--
-- * Nytt steg "syntese" som kjøres når alle kategoriene er ferdige. Det lager
--   hovedkonklusjoner og sammenligner med forrige kjøring.
-- * research_runs.report lagrer rapporten (overskrift, konklusjoner, endringer).
-- * Ukentlig pg_cron-jobb som legger aksjer med weekly_auto i køen.

alter table public.research_runs add column report jsonb;

alter table public.run_steps drop constraint run_steps_step_check;
alter table public.run_steps add constraint run_steps_step_check
  check (step in ('oversikt', 'kunder', 'ansatte', 'ledelse', 'nyheter', 'konkurrenter', 'syntese'));

-- ---------------------------------------------------------------------------
-- Felles regel for hvilke steg som kan plukkes nå. Syntesen venter til alle
-- andre steg i kjøringen er ferdige (eller har feilet).
-- ---------------------------------------------------------------------------
create or replace function public.step_is_ready(s public.run_steps, p_max_attempts integer default 3)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    (
      (s.status = 'queued' and (s.locked_until is null or s.locked_until < now()))
      or (s.status = 'running' and s.locked_until < now() and s.attempts < p_max_attempts)
    )
    and (
      s.step <> 'syntese'
      or not exists (
        select 1 from run_steps o
         where o.run_id = s.run_id and o.step <> 'syntese' and o.status in ('queued', 'running')
      )
    );
$$;

create or replace function public.claim_next_step(
  p_lock_seconds integer default 330,
  p_max_attempts integer default 3,
  p_max_parallel_per_run integer default 3
)
returns setof public.run_steps
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  update run_steps
     set status = 'failed',
         error = coalesce(error, 'Tidsavbrudd etter gjentatte forsøk'),
         updated_at = now()
   where status = 'running'
     and locked_until < now()
     and attempts >= p_max_attempts;

  select s.id into v_id
    from run_steps s
    join research_runs r on r.id = s.run_id
   where r.status in ('queued', 'running')
     and step_is_ready(s, p_max_attempts)
     and (
       select count(*) from run_steps o
        where o.run_id = s.run_id and o.status = 'running' and o.locked_until >= now()
     ) < p_max_parallel_per_run
   order by r.created_at, s.ord
   limit 1
   for update of s skip locked;

  if v_id is null then
    return;
  end if;

  update research_runs
     set status = 'running', started_at = coalesce(started_at, now())
   where id = (select run_id from run_steps where id = v_id)
     and status = 'queued';

  return query
    update run_steps
       set status = 'running',
           attempts = attempts + 1,
           locked_until = now() + make_interval(secs => p_lock_seconds),
           updated_at = now()
     where id = v_id
    returning *;
end;
$$;

-- Bruker samme regel, så en syntese som venter på andre steg ikke vekker arbeideren i løkke
create or replace function public.has_pending_steps()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
      from run_steps s
      join research_runs r on r.id = s.run_id
     where r.status in ('queued', 'running')
       and (step_is_ready(s) or (s.status = 'running' and s.locked_until < now()))
  )
  or exists (
    select 1 from research_runs r
     where r.status in ('queued', 'running')
       and not exists (
         select 1 from run_steps s where s.run_id = r.id and s.status in ('queued', 'running')
       )
  );
$$;

revoke all on function public.step_is_ready(public.run_steps, integer) from public, anon, authenticated;
revoke all on function public.claim_next_step(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.has_pending_steps() from public, anon, authenticated;
grant execute on function public.step_is_ready(public.run_steps, integer) to service_role;
grant execute on function public.claim_next_step(integer, integer, integer) to service_role;
grant execute on function public.has_pending_steps() to service_role;

-- ---------------------------------------------------------------------------
-- Ukentlig kjøring
-- ---------------------------------------------------------------------------

-- Stegene må stemme med STEPS i src/lib/research/schema.ts
create or replace function public.research_steps()
returns text[]
language sql
immutable
as $$
  select array['oversikt', 'kunder', 'ansatte', 'ledelse', 'nyheter', 'konkurrenter', 'syntese'];
$$;

-- Legger aksjer med weekly_auto i køen hvis siste kjøring er eldre enn seks dager.
-- Arbeideren vekkes av minuttjobben i 0003_worker_cron.sql.
create or replace function public.enqueue_weekly_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock record;
  v_count integer := 0;
begin
  for v_stock in
    select s.id
      from stocks s
     where s.weekly_auto
       and not exists (
         select 1 from research_runs r
          where r.stock_id = s.id
            and (r.status in ('queued', 'running') or r.created_at > now() - interval '6 days')
       )
     order by s.last_run_at nulls first
  loop
    perform create_research_run(v_stock.id, 'weekly', research_steps(), 'claude-sonnet-5-5');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.enqueue_weekly_runs() from public, anon, authenticated;
grant execute on function public.enqueue_weekly_runs() to service_role;

-- Mandager kl. 04:00 UTC (06:00 norsk sommertid, 05:00 vintertid)
select cron.schedule(
  'aksjeinnsikt-weekly',
  '0 4 * * 1',
  $$select public.enqueue_weekly_runs()$$
);

-- Trend for siste kjøring mot forrige, vises på aksjekortene
alter table public.stocks add column sentiment_trend text
  check (sentiment_trend in ('bedre', 'verre', 'uendret', 'ny'));
