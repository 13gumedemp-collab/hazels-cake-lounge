-- ============================================================================
-- Hazel's Cake Lounge — scheduled jobs (pg_cron + pg_net)
-- ----------------------------------------------------------------------------
--   daily-occasion-checker   06:00 UTC = 08:00 SAST, daily
--   enquiry-followup-check    hourly (24h no-reply nudge to Hazel)
--
-- The service role key lives in Supabase Vault (never inline in cron.job).
-- Run after the edge functions are deployed.
-- ============================================================================

-- Store the service role key once (idempotent).
select vault.create_secret(
  current_setting('app.settings.service_role_key', true),
  'service_role_key'
) where not exists (select 1 from vault.secrets where name = 'service_role_key');

-- daily-occasion-checker -----------------------------------------------------
select cron.unschedule('daily-occasion-checker')
where exists (select 1 from cron.job where jobname = 'daily-occasion-checker');

select cron.schedule('daily-occasion-checker', '0 6 * * *', $job$
  select net.http_post(
    url     := 'https://qgzpoyyijafblzfiyhoc.supabase.co/functions/v1/daily-occasion-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := jsonb_build_object('source', 'pg_cron')
  );
$job$);

-- enquiry-followup-check -----------------------------------------------------
select cron.unschedule('enquiry-followup-check')
where exists (select 1 from cron.job where jobname = 'enquiry-followup-check');

select cron.schedule('enquiry-followup-check', '0 * * * *', $job$
  select net.http_post(
    url     := 'https://qgzpoyyijafblzfiyhoc.supabase.co/functions/v1/enquiry-followup-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := jsonb_build_object('source', 'pg_cron')
  );
$job$);
