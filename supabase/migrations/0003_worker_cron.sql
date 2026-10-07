-- Aksjeinnsikt: sikkerhetsnett for jobbkøen
--
-- Hvert minutt sjekker Postgres om det finnes ventende eller hengende steg, og vekker
-- i så fall /api/jobs/run-step. Krever to hemmeligheter i Supabase Vault:
--
--   select vault.create_secret('https://<din-app>.vercel.app', 'app_url');
--   select vault.create_secret('<samme verdi som JOB_SECRET>', 'job_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.kick_research_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if not public.has_pending_steps() then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'job_secret';
  if v_url is null or v_secret is null then
    raise warning 'Aksjeinnsikt: app_url eller job_secret mangler i Vault';
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/run-step',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.kick_research_worker() from public, anon, authenticated;

select cron.schedule(
  'aksjeinnsikt-worker',
  '* * * * *',
  $$select public.kick_research_worker()$$
);
