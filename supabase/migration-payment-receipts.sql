-- MY GYM London: every payment gets a receipt email. Written 2026-11-17.
-- A database trigger watches payments however they are recorded (Wix checkout, recorded in person by staff, cash at the gym) so a receipt follows each one.
-- The email 'payment-receipt' is the same one used for memberships. It honours the switch app_flags 'wix_payment_emails' (off = nothing, test = only the listed test emails, on = everyone).
-- Duplicates are impossible: each receipt has a fixed key (wixpay:<order>:receipt-<cycle> or walkpay:<booking>) and send-email ignores a key it has already sent.
-- To stop: drop trigger wix_orders_receipt on public.wix_orders; drop trigger walkin_receipt on public.walkin_bookings;

create or replace function public.queue_payment_receipt(p_to text, p_vars jsonb, p_key text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m text; t text[];
begin
  select mode, test_emails into m, t from public.app_flags where key = 'wix_payment_emails';
  m := coalesce(m, 'off');
  if p_to is null or btrim(p_to) = '' or m = 'off' then return; end if;
  if m = 'test' and not (lower(p_to) = any (select lower(x) from unnest(coalesce(t, '{}'::text[])) x)) then return; end if;
  perform public.queue_email('payment-receipt', null, lower(btrim(p_to)), p_vars, p_key);
exception when others then null;
end $$;
revoke all on function public.queue_payment_receipt(text, jsonb, text) from public, anon, authenticated;

-- 1. plan and membership payments (a new paid order, or a payment that arrives for an order we already hold)
create or replace function public._wix_order_receipt() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare nxt text; per text;
begin
  if new.last_payment_status is distinct from 'PAID' or coalesce(new.amount, 0) <= 0 or new.email is null or new.email = '' then return new; end if;
  if tg_op = 'INSERT' then
    if new.cycle_started is null or new.cycle_started < now() - interval '2 hours' then return new; end if;  -- only a payment that has just happened
  else
    if not (old.last_payment_status is distinct from 'PAID' or coalesce(new.cycle_index, 0) > coalesce(old.cycle_index, 0)) then return new; end if;
  end if;
  per := case new.cycle_unit when 'YEAR' then 'per year' when 'WEEK' then 'per week' when 'DAY' then 'per day' when '' then 'one off' when null then 'one off' else 'per month' end;
  nxt := case when coalesce(new.cycle_unit, '') = '' then 'No further payment'
    else to_char((new.cycle_started + case new.cycle_unit when 'YEAR' then interval '1 year' when 'WEEK' then interval '7 days' when 'DAY' then interval '1 day' else interval '1 month' end) at time zone 'Europe/London', 'FMDay FMDD FMMonth') end;
  perform public.queue_payment_receipt(new.email, jsonb_build_object(
    'first_name', coalesce(nullif(btrim(new.first_name), ''), nullif(split_part(coalesce(new.full_name, ''), ' ', 1), ''), 'there'),
    'plan_name', new.plan_name, 'amount', '£' || to_char(new.amount, 'FM999990.00'), 'billing_period', per,
    'payment_date', to_char(now() at time zone 'Europe/London', 'FMDay FMDD FMMonth'),
    'payment_method', case when coalesce(new.plan_includes, '') = '' then 'Paid in person' else 'Card, online' end,
    'next_payment_date', nxt,
    'receipt_number', 'MGL-' || to_char(new.cycle_started, 'YYMM') || '-' || upper(left(new.order_id, 4)) || '-' || coalesce(new.cycle_index, 0)),
    'wixpay:' || new.order_id || ':receipt-' || coalesce(new.cycle_index, 0));
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists wix_orders_receipt on public.wix_orders;
create trigger wix_orders_receipt after insert or update of last_payment_status, cycle_index on public.wix_orders for each row execute function public._wix_order_receipt();

-- 2. pay as you go paid at the gym (staff add the person to a class and tick "Paid at the gym"; needs an email address)
create or replace function public._walkin_receipt() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare cname text;
begin
  if new.kind is distinct from 'payg' or new.paid_at_gym is not true or coalesce(new.amount, 0) <= 0 or new.email is null or btrim(new.email) = '' then return new; end if;
  select name into cname from public.classes where id = new.class_id;
  perform public.queue_payment_receipt(new.email, jsonb_build_object(
    'first_name', coalesce(nullif(split_part(btrim(new.name), ' ', 1), ''), 'there'),
    'plan_name', 'Pay as you go: ' || coalesce(cname, 'session') || ' on ' || to_char(new.date::date, 'FMDay FMDD FMMonth'), 'amount', '£' || to_char(new.amount, 'FM999990.00'), 'billing_period', 'one off',
    'payment_date', to_char(now() at time zone 'Europe/London', 'FMDay FMDD FMMonth'), 'payment_method', 'Paid at the gym', 'next_payment_date', 'No further payment',
    'receipt_number', 'MGL-' || to_char(now() at time zone 'Europe/London', 'YYMM') || '-WALK-' || upper(left(new.id::text, 4))),
    'walkpay:' || new.id::text);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists walkin_receipt on public.walkin_bookings;
create trigger walkin_receipt after insert on public.walkin_bookings for each row execute function public._walkin_receipt();
