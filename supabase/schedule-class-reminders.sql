-- ============================================================
-- MY GYM London: push reminders one hour before a booking (step 2 of 2: the 5-minute schedule)
-- Run ONLY AFTER migration-push-reminders.sql, after the send-class-reminders function is deployed
-- (Verify JWT OFF) and the VAPID_PRIVATE_KEY secret is set.
--
-- Every 5 minutes the database asks the function to send any reminders that are due.
-- The function only sends each booking's reminder once, so calling it more often is harmless.
-- To stop it:  select cron.unschedule('class-reminders');
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'class-reminders',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/send-class-reminders',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $cron$
);
