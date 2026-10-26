-- MY GYM London: the "class-reminder" email, 2 hours before a booked class or gym session (written 2026-10-26).
-- Every 5 minutes the database looks for app bookings that start 115 to 125 minutes from now (UK time), made more than 2 hours ahead,
-- and asks send-email to send "class-reminder". send-email sends each booking's reminder once (dedupe key 'reminder-<booking id>').
-- The phone alert (send-class-reminders, one hour before) is separate and unchanged. Bookings from Wix are skipped, as for the confirmation.
-- Needs migration-email-hooks.sql first (queue_email, email_events). To stop:  select cron.unschedule('class-reminder-emails');
create or replace function public.send_class_reminder_emails(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in
    select b.id, b.user_id, b.date, c.name, c.kind, c.coach, left(c.start_time, 5) as hhmm
    from public.class_bookings b
    join public.classes c on c.id = b.class_id
    where coalesce(b.source, 'app') = 'app'
      and ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London') between p_now + interval '115 minutes' and p_now + interval '125 minutes'
      and b.created_at < ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London') - interval '120 minutes'
      and not exists (select 1 from public.email_events e where e.dedupe_key = 'reminder-' || b.id::text)
  loop
    perform public.queue_email('class-reminder', r.user_id, null, jsonb_build_object(
      'first_name', coalesce(nullif(split_part(trim(coalesce((select full_name from public.profiles where id = r.user_id), '')), ' ', 1), ''), 'there'),
      'class_name', case when r.kind = 'gym' then 'Gym session' else r.name end,
      'time', r.hhmm,
      'when', trim(to_char(r.date::date, 'FMDay')) || ' ' || to_char(r.date::date, 'FMDD') || ' ' || trim(to_char(r.date::date, 'FMMonth')) || ' at ' || r.hhmm,
      'coach', case when r.kind <> 'gym' then coalesce(r.coach, '') else '' end), 'reminder-' || r.id::text);
    n := n + 1;
  end loop;
  return n;
exception when others then
  return n;
end $$;
revoke all on function public.send_class_reminder_emails(timestamptz) from public, anon, authenticated;

select cron.schedule('class-reminder-emails', '*/5 * * * *', 'select public.send_class_reminder_emails()');
