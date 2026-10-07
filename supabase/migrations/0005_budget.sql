-- Aksjeinnsikt: månedsbudsjett og brukerinnstillinger

create table public.user_settings (
  user_id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- null betyr ingen grense
  monthly_budget_usd  numeric(10, 2) default 25 check (monthly_budget_usd is null or monthly_budget_usd >= 0),
  updated_at          timestamptz not null default now()
);

alter table public.user_settings enable row level security;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Er brukeren over månedsbudsjettet? Kjøringer som pågår, teller med.
create or replace function public.over_monthly_budget(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with budget as (
    select coalesce(
      (select monthly_budget_usd from user_settings where user_id = p_user),
      case when exists (select 1 from user_settings where user_id = p_user) then null else 25 end
    ) as usd
  )
  select budget.usd is not null
     and (
       select coalesce(sum(cost_usd), 0) from research_runs
        where user_id = p_user and created_at >= date_trunc('month', now())
     ) >= budget.usd
    from budget;
$$;

revoke all on function public.over_monthly_budget(uuid) from public, anon, authenticated;
grant execute on function public.over_monthly_budget(uuid) to service_role;

-- Ukentlig kjøring hopper over brukere som har nådd budsjettet
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
       and not over_monthly_budget(s.user_id)
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
