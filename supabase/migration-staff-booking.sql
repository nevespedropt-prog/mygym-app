-- 2026-11-14. Back office: staff can book a member, or a pay as you go person who pays at the gym, into a class or gym slot (function admin-book-member). APPLIED.
-- walkin_bookings records pay as you go people (name, contact, price, paid at the gym) and members who have no app login; admin_day returns them as 'walkins'. Spaces still come from Wix (the Wix booking is made first).
-- To undo: drop table public.walkin_bookings; re-run migration-admin-backend.sql to restore admin_day.
create table if not exists public.walkin_bookings (
  id uuid primary key default gen_random_uuid(),
  class_id bigint not null references public.classes(id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  name text not null, phone text, email text,
  kind text not null default 'payg' check (kind in ('payg', 'member')),
  amount numeric, paid_at_gym boolean not null default false,
  wix_booking_id text, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists walkin_bookings_class_date on public.walkin_bookings (class_id, date);
alter table public.walkin_bookings enable row level security;
revoke all on public.walkin_bookings from anon, authenticated;
-- admin_day was patched in place to add 'walkins' after 'other_wix' (see the DO block in the session notes: pg_get_functiondef + replace).
