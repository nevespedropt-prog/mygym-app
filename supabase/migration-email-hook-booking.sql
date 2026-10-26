-- MY GYM London: booking confirmations now use the new email design (applied 2026-10-26, after a rolled-back dry run).
-- Before: a new row in class_bookings called the send-booking-email function, which sent the old plain email.
-- Now: the same trigger asks send-email to send "booking-confirmation" (see email-templates). Bookings from Wix (source <> 'app') are still skipped: Wix emails those itself.
-- Each booking is emailed once (dedupe key 'booking-<id>' in email_events). Never blocks or fails a booking: any problem inside is swallowed.
-- Needs migration-email-hooks.sql first (queue_email, email_events). To go back to the old plain email, run the notify_booking_email function from migration-booking-emails.sql again.
create or replace function public.booking_email_vars(p_booking uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'first_name', coalesce(nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''), 'there'),
    'class_name', case when c.kind = 'gym' then 'Gym session' else c.name end,
    'when', trim(to_char(b.date::date, 'FMDay')) || ' ' || to_char(b.date::date, 'FMDD') || ' ' || trim(to_char(b.date::date, 'FMMonth')) || ' at ' || left(c.start_time, 5),
    'coach', case when c.kind <> 'gym' then coalesce(c.coach, '') else '' end)
  from public.class_bookings b join public.classes c on c.id = b.class_id left join public.profiles p on p.id = b.user_id
  where b.id = p_booking
$$;
revoke all on function public.booking_email_vars(uuid) from public, anon, authenticated;

create or replace function public.notify_booking_email() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if coalesce(new.source, 'app') = 'app' then
    begin
      perform public.queue_email('booking-confirmation', new.user_id, null, public.booking_email_vars(new.id), 'booking-' || new.id::text);
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;
revoke all on function public.notify_booking_email() from public, anon, authenticated;
