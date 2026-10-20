-- MY GYM London: weekly health report (written 2026-10-20). NOT APPLIED YET.
-- Gathers COUNTS ONLY (no names, emails or health data) for the weekly report email. Run in the Supabase SQL editor
-- (paste the statements only, without comment lines). Safe to run more than once.

-- 1. The numbers. Only the server (service_role) may run it.
create or replace function public.weekly_report_stats() returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'members',            (select count(*) from public.profiles),
    'new_members_7d',     (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'admins',             (select count(*) from public.profiles where is_admin),
    'gym_members',        (select count(*) from public.member_access where gym_access),
    'bookings_7d_app',    (select count(*) from public.class_bookings where created_at > now() - interval '7 days' and coalesce(source, 'app') = 'app'),
    'bookings_7d_wix',    (select count(*) from public.class_bookings where created_at > now() - interval '7 days' and coalesce(source, 'app') <> 'app'),
    'upcoming_bookings',  (select count(*) from public.class_bookings where date >= to_char((now() at time zone 'Europe/London')::date, 'YYYY-MM-DD')),
    'upcoming_other_wix', (select count(*) from public.wix_other_bookings where date >= to_char((now() at time zone 'Europe/London')::date, 'YYYY-MM-DD')),
    'emails_7d_sent',     (select count(*) from public.email_log where status = 'sent'   and updated_at > now() - interval '7 days'),
    'emails_7d_failed',   (select count(*) from public.email_log where status = 'failed' and updated_at > now() - interval '7 days'),
    'wix_sync_age_min',   (select round(extract(epoch from now() - last_run) / 60) from public.sync_log where id = 'wix-bookings'),
    'wix_sync_ok',        (select coalesce((last_result ->> 'ok')::boolean, false) from public.sync_log where id = 'wix-bookings'),
    'timetable_age_min',  (select round(extract(epoch from now() - last_run) / 60) from public.sync_log where id = 'timetable'),
    'timetable_ok',       (select coalesce((last_result ->> 'ok')::boolean, false) from public.sync_log where id = 'timetable'),
    'wix_book_issue_rows',(select count(*) from public.sync_log where id = 'wix-book-issue'),
    'cron_runs_7d',       (select count(*) from cron.job_run_details where start_time > now() - interval '7 days'),
    'cron_failed_7d',     (select count(*) from cron.job_run_details where start_time > now() - interval '7 days' and status <> 'succeeded'),
    'database_mb',        (select round(pg_database_size(current_database()) / 1048576.0))
  );
$$;

revoke all on function public.weekly_report_stats() from public, anon, authenticated;
grant execute on function public.weekly_report_stats() to service_role;

-- 2. The schedule: every Monday 08:00 (UTC). It copies the address and the secret header of the existing
--    sync-timetable schedule and only swaps the function name, so the secret is never typed or shown.
select cron.schedule('weekly-report', '0 8 * * 1', replace(command, 'sync-timetable', 'weekly-report'))
from cron.job where jobname = 'sync-timetable';

-- To stop the report:  select cron.unschedule('weekly-report');
-- To send one now (test):  run the function's Test button in the Supabase dashboard, or wait for Monday.
