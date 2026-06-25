-- ============================================================================
-- Hazel's Cake Lounge — Part 1: schedule the daily occasion checker
-- ----------------------------------------------------------------------------
-- 08:00 SAST (UTC+2) == 06:00 UTC, every day.
--
-- RUN THIS ONLY AFTER the `daily-occasion-checker` edge function is deployed
-- (Part 2). pg_cron calls the function over HTTP via pg_net.
--
-- Replace the two placeholders before running:
--   <PROJECT_REF>          your Supabase project ref (e.g. abcdwxyz)
--   <SERVICE_ROLE_KEY>     stored in Vault below, never inline in cron
--
-- We keep the service role key in Supabase Vault rather than hard-coding it
-- into the cron command (which is visible in cron.job).
-- ============================================================================

-- Store the service role key once (run manually, do not commit the real key):
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

-- Remove any previous schedule with the same name (id-safe re-run).
select cron.unschedule('daily-occasion-checker')
where exists (select 1 from cron.job where jobname = 'daily-occasion-checker');

select cron.schedule(
  'daily-occasion-checker',
  '0 6 * * *',                       -- 06:00 UTC = 08:00 SAST
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/daily-occasion-checker',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret
                                       from vault.decrypted_secrets
                                       where name = 'service_role_key')
    ),
    body    := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
