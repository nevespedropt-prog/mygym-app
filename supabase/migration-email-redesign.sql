-- MY GYM London: email system redesign — 2026-11-08
-- Drops old health-form and week-one crons, adds member_since tracking to wix_orders,
-- creates the part3-nutrition cron.
-- Apply AFTER:
--   1. templates.mjs updated and bundled (node supabase/shared/bundle.mjs)
--   2. send-email edge function redeployed
--   3. sync-wix-payments edge function deployed
-- Safe to run more than once.

-- 1. Drop old scheduled jobs (ignore errors if they were already removed)
do $$ begin
  begin perform cron.unschedule('health-form-reminders'); exception when others then null; end;
  begin perform cron.unschedule('week-one-checkin'); exception when others then null; end;
end $$;

-- 2. Drop old cron functions (replaced by sync-wix-payments + part3 cron below)
drop function if exists public.email_cron_health_reminders();
drop function if exists public.email_cron_week_one();

-- 3. Add member_since column to wix_orders (tracks when membership first became active)
alter table public.wix_orders add column if not exists member_since timestamptz;

-- 4. Part 3 nutrition guide cron
--    Runs every hour at :15. Finds members whose membership first became active 71-73 hours ago
--    and sends them the nutrition guide (Part 3). The dedupe_key prevents duplicates.
create or replace function public.email_cron_part3_nutrition() returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r record;
begin
  for r in
    select order_id, email,
           coalesce(nullif(trim(coalesce(first_name, '')), ''), 'there') as first_name,
           plan_name
    from public.wix_orders
    where member_since between now() - interval '73 hours' and now() - interval '71 hours'
      and email is not null
  loop
    perform public.queue_email(
      'part3-nutrition', null, r.email,
      jsonb_build_object('first_name', r.first_name, 'plan_name', r.plan_name),
      'part3-nutrition:' || r.order_id
    );
  end loop;
exception when others then null;
end $$;
revoke all on function public.email_cron_part3_nutrition() from public, anon, authenticated;

select cron.schedule('part3-nutrition', '15 * * * *', 'select public.email_cron_part3_nutrition()');

-- To undo:
--   perform cron.unschedule('part3-nutrition');
--   drop function if exists public.email_cron_part3_nutrition();
