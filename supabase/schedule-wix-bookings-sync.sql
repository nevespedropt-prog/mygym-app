-- ============================================================
-- MY GYM London: automatic Wix booking sync (step 2 of 2: the 5-minute schedule)
-- SCHEDULED 2026-10-16 by the owner in the Supabase SQL editor (cron job id 4). The end-to-end test with the owner's own account passed first.
--
-- Every 5 minutes the database asks the function to mirror confirmed Wix bookings into the app.
-- To stop it:  select cron.unschedule('sync-wix-bookings');
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-wix-bookings',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/sync-wix-bookings',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"apply": true}'::jsonb
    );
  $cron$
);
