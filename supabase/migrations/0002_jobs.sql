-- Aksjeinnsikt: jobbkø for researchkjøringer
--
-- En kjøring deles i steg (ett per kategori). Hvert steg kjøres av /api/jobs/run-step
-- innenfor tidsgrensen til en Vercel-funksjon. Et steg som ikke blir ferdig i tide,
-- lagrer tilstanden sin og legges tilbake i køen.

alter table public.research_runs
  add column sections jsonb,          -- temaer, dekning og oppsummering per kategori
  add column red_flags integer not null default 0,
  add column findings_count integer not null default 0;

create table public.run_steps (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.research_runs (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  step          text not null
                check (step in ('oversikt', 'kunder', 'ansatte', 'ledelse', 'nyheter', 'konkurrenter')),
  ord           integer not null,
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'done', 'failed')),
  attempts      integer not null default 0,
  locked_until  timestamptz,
  -- Mellomlagret samtale hvis steget må fortsette i en ny funksjon
  state         jsonb,
  -- Resultat som ikke er funn: temaer, dekning, oversikt, lovnader osv.
  result        jsonb,
  usage         jsonb not null default '{}'::jsonb,
  cost_usd      numeric(10, 4) not null default 0,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (run_id, step)
);
create index run_steps_queue_idx on public.run_steps (status, locked_until);
create index run_steps_run_idx on public.run_steps (run_id);

alter table public.run_steps enable row level security;
-- Brukeren kan følge fremdriften i egne kjøringer. Alt annet gjøres av service-rollen.
create policy "run_steps_select_own" on public.run_steps
  for select to authenticated using (user_id = (select auth.uid()));

-- Bare én aktiv kjøring per aksje
create unique index research_runs_one_active_idx
  on public.research_runs (stock_id) where status in ('queued', 'running');

-- ---------------------------------------------------------------------------
-- Plukker neste ledige steg. Kjøres kun av service-rollen.
-- ---------------------------------------------------------------------------
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
  -- Steg som har hengt for lenge, og som har brukt opp forsøkene, merkes som feilet
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
     and (
       (s.status = 'queued' and (s.locked_until is null or s.locked_until < now()))
       or (s.status = 'running' and s.locked_until < now() and s.attempts < p_max_attempts)
     )
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

-- Finnes det steg som venter? Brukes for å avgjøre om arbeideren skal startes igjen.
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
       and (
         (s.status = 'queued' and (s.locked_until is null or s.locked_until < now()))
         or (s.status = 'running' and s.locked_until < now())
       )
  )
  or exists (
    -- Kjøringer der alle steg er ferdige, men selve kjøringen ikke er avsluttet
    select 1 from research_runs r
     where r.status in ('queued', 'running')
       and not exists (
         select 1 from run_steps s where s.run_id = r.id and s.status in ('queued', 'running')
       )
  );
$$;

revoke all on function public.claim_next_step(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.has_pending_steps() from public, anon, authenticated;
grant execute on function public.claim_next_step(integer, integer, integer) to service_role;
grant execute on function public.has_pending_steps() to service_role;

-- ---------------------------------------------------------------------------
-- Oppretter en kjøring med alle steg i én transaksjon. Kalles av service-rollen
-- etter at appen har sjekket at aksjen tilhører brukeren.
-- ---------------------------------------------------------------------------
create or replace function public.create_research_run(
  p_stock_id uuid,
  p_trigger text,
  p_steps text[],
  p_model text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user uuid;
  v_run uuid;
begin
  select user_id into v_user from stocks where id = p_stock_id;
  if v_user is null then
    raise exception 'Aksjen finnes ikke';
  end if;

  insert into research_runs (user_id, stock_id, trigger, model, steps_total)
  values (v_user, p_stock_id, p_trigger, p_model, coalesce(array_length(p_steps, 1), 0))
  returning id into v_run;

  insert into run_steps (run_id, user_id, step, ord)
  select v_run, v_user, s.step, s.ord
    from unnest(p_steps) with ordinality as s(step, ord);

  return v_run;
end;
$$;

revoke all on function public.create_research_run(uuid, text, text[], text) from public, anon, authenticated;
grant execute on function public.create_research_run(uuid, text, text[], text) to service_role;
