-- MY GYM London: payment and membership emails driven by Wix Pricing Plans orders. Written 2026-10-28. Tables APPLIED; the function sync-wix-payments is NOT deployed and NOT scheduled yet.
-- Owner decision 2026-10-28: after the full move off Wix, Wix only takes payments (plus domain and mailboxes). Every email comes from our own system, including payment emails.
-- Safety: the switch app_flags key 'wix_payment_emails' is OFF. While off the function only tracks orders and sends nothing. The very first run records every existing order as a baseline and never emails for them.
create table if not exists public.wix_orders (
  order_id text primary key,
  contact_id text, email text, first_name text, full_name text,
  plan_name text, plan_includes text, amount numeric, cycle_unit text,
  status text, last_payment_status text, cycle_index integer, cycle_started timestamptz, end_date timestamptz,
  auto_renew_canceled boolean not null default false,
  failed_since timestamptz, failed_steps integer not null default 0,
  first_seen timestamptz not null default now(), updated_at timestamptz not null default now(), baseline boolean not null default false
);
alter table public.wix_orders enable row level security;
revoke all on public.wix_orders from anon, authenticated;
insert into public.app_flags (key, mode) values ('wix_payment_emails', 'off') on conflict (key) do nothing;

-- WHEN THE FULL TRANSITION IS DONE (see NEXT-SESSION): deploy the function, run the schedule below, switch the flag to 'test' (emails only to test_emails), check, then 'on'.
-- select cron.schedule('sync-wix-payments', '*/15 * * * *', replace((select command from cron.job where jobname = 'sync-timetable'), '/functions/v1/sync-timetable', '/functions/v1/sync-wix-payments'));
-- update public.app_flags set mode = 'test', test_emails = array['nevespedro.pt@gmail.com'] where key = 'wix_payment_emails';   -- then later: set mode = 'on'
-- To stop:  select cron.unschedule('sync-wix-payments');   and   update public.app_flags set mode = 'off' where key = 'wix_payment_emails';
