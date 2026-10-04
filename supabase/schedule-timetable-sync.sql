-- ============================================================
-- MY GYM London: automatic timetable sync (step 2 of 2: the hourly schedule)
-- NOT RUN YET. Run only AFTER migration-timetable-sync.sql, after the
-- sync-timetable function is deployed (Verify JWT OFF) and a dry run looks right.
--
-- Every hour (at 7 minutes past) the database asks the function to compare the
-- website timetable with the app and apply any changes.
-- To stop it:  select cron.unschedule('sync-timetable');
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-timetable',
  '7 * * * *',
  $cron$
    select net.http_post(
      url := 'https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/sync-timetable',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $cron$
);
