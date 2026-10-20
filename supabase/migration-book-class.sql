-- ============================================================
-- MY GYM London: switch for "app bookings also create a booking in Wix" (phase 2)
-- APPLIED 2026-10-19 (statements only, without these comments). Safe to run more than once. Creates one small table, changes nothing else.
--
-- public.app_flags: server-only switches. Row 'wix_booking' has a mode:
--   'off'   = the app books exactly as today (default)
--   'owner' = only the emails in test_emails book through Wix, everyone else as today
--             (add one with: update public.app_flags set test_emails = array['name@example.com'] where key = 'wix_booking';)
--   'on'    = everyone books through Wix
-- Switch with (owner runs in the SQL editor):
--   update public.app_flags set mode = 'owner' where key = 'wix_booking';
--   update public.app_flags set mode = 'on'    where key = 'wix_booking';
--   update public.app_flags set mode = 'off'   where key = 'wix_booking';   -- back to today, instantly
-- To undo everything: drop table if exists public.app_flags;
-- ============================================================
create table if not exists public.app_flags (
  key text primary key,
  mode text not null default 'off' check (mode in ('off', 'owner', 'on')),
  test_emails text[] not null default '{}'
);
alter table public.app_flags enable row level security;   -- no policies: only the server can use it
revoke all on public.app_flags from anon, authenticated;

insert into public.app_flags (key, mode, test_emails)
values ('wix_booking', 'off', '{}')   -- test emails are added by hand in the SQL editor, never committed here
on conflict (key) do nothing;
