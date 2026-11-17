-- MY GYM London: payment failed, paused, resumed, cancelled and refund emails, sent by the database the moment an order changes. Written 2026-11-17.
-- Why the database and not only the 15-minute sync: the clients sync rewrites wix_orders every 30 minutes, so the payments sync could miss a change that the clients sync had already saved.
-- A trigger sees every change however it was saved. Each email has the same key the sync uses (wixpay:<order>:<event>), so nobody ever gets the same email twice.
-- The switch app_flags 'wix_payment_emails' still decides who receives them: off = nobody, test = only the test emails, on = everyone.
-- The day 5 and day 14 reminders and the staff task on day 21 still come from the sync (sync-wix-payments, every 15 minutes).

-- one place that honours the switch
create or replace function public.queue_wixpay_email(p_template text, p_to text, p_vars jsonb, p_key text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m text; t text[];
begin
  select mode, test_emails into m, t from public.app_flags where key = 'wix_payment_emails';
  m := coalesce(m, 'off');
  if p_to is null or btrim(p_to) = '' or m = 'off' then return; end if;
  if m = 'test' and not (lower(p_to) = any (select lower(x) from unnest(coalesce(t, '{}'::text[])) x)) then return; end if;
  perform public.queue_email(p_template, null, lower(btrim(p_to)), p_vars, p_key);
exception when others then null;
end $$;
revoke all on function public.queue_wixpay_email(text, text, jsonb, text) from public, anon, authenticated;
create or replace function public.queue_payment_receipt(p_to text, p_vars jsonb, p_key text) returns void
language sql security definer set search_path = public, pg_temp as $$ select public.queue_wixpay_email('payment-receipt', p_to, p_vars, p_key) $$;
revoke all on function public.queue_payment_receipt(text, jsonb, text) from public, anon, authenticated;

create or replace function public._wix_order_events() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare first text; pretty text := to_char(now() at time zone 'Europe/London', 'FMDay FMDD FMMonth'); amt text; isp boolean; swap boolean; k text; nxt text;
  admin_to constant text := 'info@mygymlondon.co.uk'; manage constant text := 'https://join.mygymlondon.co.uk/my-subscriptions';
begin
  if new.email is null or new.email = '' then return new; end if;
  first := coalesce(nullif(btrim(new.first_name), ''), nullif(split_part(coalesce(new.full_name, ''), ' ', 1), ''), 'there');
  amt := '£' || to_char(coalesce(new.amount, 0), 'FM999990.00');
  isp := new.plan_name ~* '(payg|pay as you go)';
  k := 'wixpay:' || new.order_id || ':';
  -- a plan being switched by staff or by the member: the old order stops while a new one is already running, so it is not a cancellation
  swap := exists (select 1 from public.wix_orders o where lower(o.email) = lower(new.email) and o.order_id <> new.order_id and o.status = 'ACTIVE' and o.cycle_started >= now() - interval '2 days');

  -- payment failed (a paid order whose payment now fails), and clear the failure again once it is paid
  if new.status = 'ACTIVE' and not isp and new.last_payment_status is distinct from old.last_payment_status then
    if (new.last_payment_status = 'FAILED' or (new.last_payment_status = 'UNPAID' and old.last_payment_status = 'PAID')) and new.failed_since is null then
      new.failed_since := now(); new.failed_steps := 1;
      perform public.queue_wixpay_email('payment-failed-1', new.email, jsonb_build_object('first_name', first, 'plan_name', new.plan_name, 'amount', amt, 'retry_date', to_char((now() + interval '5 days') at time zone 'Europe/London', 'FMDay FMDD FMMonth'), 'update_payment_url', manage), k || 'failed-1-' || coalesce(new.cycle_index, 0));
      perform public.queue_wixpay_email('admin-payment-failed', admin_to, jsonb_build_object('person_name', coalesce(nullif(new.full_name, ''), new.email), 'plan_name', new.plan_name, 'amount', amt, 'retry_date', to_char((now() + interval '5 days') at time zone 'Europe/London', 'FMDay FMDD FMMonth')), k || 'admin-failed-' || coalesce(new.cycle_index, 0));
    elsif new.last_payment_status = 'PAID' then
      new.failed_since := null; new.failed_steps := 0;
    end if;
  end if;

  -- refund
  if new.last_payment_status = 'REFUNDED' and old.last_payment_status is distinct from 'REFUNDED' and coalesce(new.amount, 0) > 0 then
    perform public.queue_wixpay_email('refund-issued', new.email, jsonb_build_object('first_name', first, 'amount', amt, 'payment_date', pretty, 'refund_reason', 'a refund you were due'), k || 'refund-' || coalesce(new.cycle_index, 0));
  end if;

  if not isp then
    -- paused / restarted
    if new.status = 'PAUSED' and old.status = 'ACTIVE' then
      perform public.queue_wixpay_email('membership-paused', new.email, jsonb_build_object('first_name', first, 'plan_name', new.plan_name, 'pause_date', pretty, 'resume_date', 'when you ask us to restart it'), k || 'paused-' || coalesce(new.cycle_index, 0));
    elsif new.status = 'ACTIVE' and old.status = 'PAUSED' then
      nxt := case when coalesce(new.cycle_unit, '') = '' then 'No further payment' else to_char((now() + case new.cycle_unit when 'YEAR' then interval '1 year' when 'WEEK' then interval '7 days' when 'DAY' then interval '1 day' else interval '1 month' end) at time zone 'Europe/London', 'FMDay FMDD FMMonth') end;
      perform public.queue_wixpay_email('membership-resumed', new.email, jsonb_build_object('first_name', first, 'plan_name', new.plan_name, 'next_payment_date', nxt), k || 'resumed-' || coalesce(new.cycle_index, 0));
    end if;
    -- cancelled (now, or set to stop at the end of the period)
    if not swap and old.status in ('ACTIVE', 'PAUSED') and ((new.auto_renew_canceled and not coalesce(old.auto_renew_canceled, false) and new.status = 'ACTIVE') or (new.status = 'CANCELED')) then
      perform public.queue_wixpay_email('membership-cancelled', new.email, jsonb_build_object('first_name', first, 'plan_name', new.plan_name, 'end_date', to_char(coalesce(new.end_date, now()) at time zone 'Europe/London', 'FMDay FMDD FMMonth'),
        'final_payment', case when coalesce(new.cycle_unit, '') <> '' then 'Your last payment has already been taken. There is nothing more to pay.' else 'Nothing more to pay' end), k || 'cancelled');
      perform public.queue_wixpay_email('admin-membership-cancelled', admin_to, jsonb_build_object('person_name', coalesce(nullif(new.full_name, ''), new.email), 'plan_name', new.plan_name, 'end_date', to_char(coalesce(new.end_date, now()) at time zone 'Europe/London', 'FMDay FMDD FMMonth'), 'reason', 'Cancelled in Wix'), k || 'admin-cancelled');
    end if;
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists wix_orders_events on public.wix_orders;
create trigger wix_orders_events before update of status, last_payment_status, auto_renew_canceled on public.wix_orders for each row execute function public._wix_order_events();
