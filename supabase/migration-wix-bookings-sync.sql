-- ============================================================
-- MY GYM London: show Wix bookings in the app (step 1 of 2: the database part)
-- NOT RUN YET. Run in the Supabase SQL editor BEFORE deploying the sync-wix-bookings function.
-- Safe to run more than once. It only ADDS a column and an index. It changes no existing booking.
--
-- wix_booking_id: the Wix booking a row mirrors, so the sync never adds the same booking twice and can remove it if it
-- is cancelled in Wix. Rows made in the app have it empty.
-- (class_bookings.source already exists from migration-booking-emails.sql: 'app' or 'wix'.)
-- To undo:  drop index if exists class_bookings_wix_booking_id_key;  alter table public.class_bookings drop column if exists wix_booking_id;
-- ============================================================
alter table public.class_bookings add column if not exists source text not null default 'app';
alter table public.class_bookings add column if not exists wix_booking_id text;

create unique index if not exists class_bookings_wix_booking_id_key
  on public.class_bookings (wix_booking_id) where wix_booking_id is not null;

-- sync_log already exists (migration-timetable-sync.sql). The sync uses a row with id 'wix-bookings'.
