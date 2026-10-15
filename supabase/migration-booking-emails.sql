-- ============================================================
-- MY GYM London: booking confirmation emails (app bookings)
-- NOT RUN YET. Run in the Supabase SQL editor ONLY AFTER:
--   1. the send-booking-email function is deployed (Verify JWT OFF) and the RESEND_API_KEY secret is set,
--   2. the Resend domain is verified (supabase/RESEND-SETUP.md).
-- Until then nothing sends. To switch off later:  drop trigger if exists booking_email on public.class_bookings;
-- ============================================================
create extension if not exists pg_net;

-- where a booking came from. The app is 'app'. Bookings read in from Wix later are 'wix' and get Wix's own email.
alter table public.class_bookings add column if not exists source text not null default 'app';

-- one row per booking that has been (or is being) emailed, so no booking is emailed twice
create table if not exists public.email_log (
  booking_id  uuid primary key references public.class_bookings(id) on delete cascade,
  status      text not null default 'failed',      -- 'sent' or 'failed'
  attempts    integer not null default 0,
  provider_id text,
  error       text,
  updated_at  timestamptz not null default now()
);
alter table public.email_log enable row level security;   -- no policies: only the server can use it

-- when a booking row is added, ask the function to send the confirmation.
-- This never blocks or fails a booking: any problem here is swallowed.
create or replace function public.notify_booking_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(new.source, 'app') = 'app' then
    begin
      perform net.http_post(
        url := 'https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/send-booking-email',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('booking_id', new.id)
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;

revoke all on function public.notify_booking_email() from public, anon, authenticated;

drop trigger if exists booking_email on public.class_bookings;
create trigger booking_email after insert on public.class_bookings
  for each row execute function public.notify_booking_email();

-- OPTIONAL safety net (not scheduled): every 5 minutes, email any booking from the last 30 minutes that was missed.
-- select cron.schedule('booking-email-catchup', '*/5 * * * *', $cron$
--   select net.http_post(url := 'https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/send-booking-email',
--     headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb);
-- $cron$);
