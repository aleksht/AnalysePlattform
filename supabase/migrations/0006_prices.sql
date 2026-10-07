-- Aksjeinnsikt: aksjekurser fra Yahoo Finance
--
-- Daglige sluttkurser lagres per aksje. De hentes på serveren (service-rollen),
-- og brukeren kan bare lese kursene for sine egne aksjer.

alter table public.stocks
  add column price_symbol      text check (price_symbol is null or char_length(price_symbol) <= 30),
  add column last_price        numeric(18, 4),
  add column price_change_pct  numeric(8, 3),
  add column price_currency    text,
  add column price_updated_at  timestamptz,
  add column price_error       text;

create table public.stock_prices (
  stock_id  uuid not null references public.stocks (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  date      date not null,
  close     numeric(18, 4) not null,
  primary key (stock_id, date)
);
create index stock_prices_user_idx on public.stock_prices (user_id);

alter table public.stock_prices enable row level security;
create policy "stock_prices_select_own" on public.stock_prices
  for select to authenticated using (user_id = (select auth.uid()));

-- Daglig oppdatering av kurser kl. 18:15 UTC (etter stengetid i Stockholm og Oslo).
-- Bruker de samme Vault-hemmelighetene som arbeideren (app_url, job_secret).
create or replace function public.kick_price_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'job_secret';
  if v_url is null or v_secret is null then
    raise warning 'Aksjeinnsikt: app_url eller job_secret mangler i Vault';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/prices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.kick_price_refresh() from public, anon, authenticated;

select cron.schedule('aksjeinnsikt-prices', '15 18 * * 1-5', $$select public.kick_price_refresh()$$);
