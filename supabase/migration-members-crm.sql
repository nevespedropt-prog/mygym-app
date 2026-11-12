-- MY GYM London: real client list in the back office (Wix contacts + membership orders + app accounts). Written 2026-11-12.
-- Needs migration-admin-backend.sql (roles, _need, staff_access_log) and migration-wix-payments.sql (wix_orders).
-- The sync-wix-clients function copies Wix contacts and Pricing Plans orders into wix_contacts / wix_orders every 30 minutes (read-only on the Wix side).
-- Membership type comes from the plan name: gym_classes = Gym & Exercise Class plans (and staff gym plans), classes = class-only plans, pt = personal training packs.
-- Status: active | failed (active but the last payment failed) | paused | cancelled | ended | lead (no real order: free-class sign-ups, abandoned checkouts, contacts).
-- To undo: select cron.unschedule('sync-wix-clients'); drop the functions below, then drop table public.wix_contacts, public.member_notes (wix_orders stays).

create table if not exists public.wix_contacts (
  contact_id text primary key, email text, first_name text, last_name text, full_name text, phone text,
  labels text[] not null default '{}', subscription text, is_member boolean not null default false,
  created_wix timestamptz, last_activity timestamptz, updated_at timestamptz not null default now(),
  birthdate date, last_booked date, bookings_60d integer not null default 0
);
alter table public.wix_contacts add column if not exists birthdate date;
alter table public.wix_contacts add column if not exists last_booked date;
alter table public.wix_contacts add column if not exists bookings_60d integer not null default 0;
-- date of birth for members who sign up in the app (asked at sign-up and in Me > Profile); used for birthday emails
alter table public.profiles add column if not exists birthdate date;
create index if not exists wix_contacts_email on public.wix_contacts (lower(email));
alter table public.wix_contacts enable row level security;
revoke all on public.wix_contacts from anon, authenticated;

create table if not exists public.member_notes (
  id bigint generated always as identity primary key, email text not null, note text not null, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists member_notes_email on public.member_notes (lower(email));
alter table public.member_notes enable row level security;
revoke all on public.member_notes from anon, authenticated;
create index if not exists wix_orders_email on public.wix_orders (lower(email));

create or replace function public._plan_type(p_name text) returns text language sql immutable as $$
  select case when p_name ~* 'personal training' then 'pt' when p_name ~* 'gym' then 'gym_classes' when p_name ~* 'class' then 'classes' else 'other' end
$$;
create or replace function public._order_status(p_status text, p_pay text, p_failed timestamptz) returns text language sql immutable as $$
  select case when p_status = 'ACTIVE' and (p_pay = 'FAILED' or p_failed is not null) then 'failed' when p_status = 'ACTIVE' then 'active' when p_status = 'PAUSED' then 'paused'
              when p_status = 'CANCELED' then 'cancelled' when p_status = 'ENDED' then 'ended' else 'lead' end
$$;
create or replace function public._monthly(p_amount numeric, p_unit text) returns numeric language sql immutable as $$
  select coalesce(case p_unit when 'YEAR' then p_amount / 12 when 'WEEK' then p_amount * 52 / 12 when 'MONTH' then p_amount else 0 end, 0)
$$;

-- 1. everyone, one row each (by email): Wix contacts + orders + app accounts
create or replace function public.admin_member_directory(p_limit integer default 2000) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  return coalesce((select jsonb_agg(m order by (m->>'sort') desc nulls last) from (
    with keys as (
      select lower(email) e from public.wix_contacts where email is not null and email <> ''
      union select lower(email) from public.wix_orders where email is not null and email <> ''
      union select lower(email) from auth.users where email is not null),
    best as (
      select distinct on (lower(o.email)) lower(o.email) e, o.plan_name, o.amount, o.cycle_unit, o.status, o.last_payment_status, o.failed_since, o.cycle_started, o.end_date, o.auto_renew_canceled
      from public.wix_orders o where o.email is not null and o.status is distinct from 'DRAFT'
      order by lower(o.email), case o.status when 'ACTIVE' then 1 when 'PAUSED' then 2 when 'CANCELED' then 3 when 'ENDED' then 4 else 5 end, o.cycle_started desc nulls last),
    firsts as (select lower(email) e, min(cycle_started) since, count(*) n from public.wix_orders where email is not null and status is distinct from 'DRAFT' group by 1)
    select jsonb_build_object(
      'email', k.e,
      'name', coalesce(nullif(trim(c.full_name), ''), nullif(trim(pr.full_name), ''), (select nullif(trim(o2.full_name), '') from public.wix_orders o2 where lower(o2.email) = k.e and o2.full_name is not null limit 1), ''),
      'phone', coalesce(nullif(c.phone, ''), nullif(pr.phone, ''), ''),
      'plan', b.plan_name, 'plan_type', case when b.plan_name is null then null else public._plan_type(b.plan_name) end,
      'staff_rate', coalesce(b.plan_name ~* 'staff', false),
      'status', case when b.plan_name is null then 'lead' else public._order_status(b.status, b.last_payment_status, b.failed_since) end,
      'amount', b.amount, 'unit', b.cycle_unit, 'ends', b.end_date, 'cancelling', coalesce(b.auto_renew_canceled, false),
      'since', f.since, 'orders', coalesce(f.n, 0),
      'wix', c.contact_id is not null, 'site_member', coalesce(c.is_member, false), 'labels', coalesce(c.labels, '{}'),
      'wix_news', c.subscription,
      'app', u.id is not null, 'user_id', u.id,
      'bookings', case when u.id is null then 0 else (select count(*) from public.class_bookings cb where cb.user_id = u.id) end,
      'last_booking', greatest(case when u.id is null then null else (select max(cb.date)::date from public.class_bookings cb where cb.user_id = u.id and cb.date <= to_char(current_date, 'YYYY-MM-DD')) end, c.last_booked),
      'birthdate', coalesce(pr.birthdate, c.birthdate),
      'lapsed', coalesce(b.status = 'ACTIVE' and f.since < now() - interval '21 days'
                  and coalesce(greatest(case when u.id is null then null else (select max(cb.date)::date from public.class_bookings cb where cb.user_id = u.id and cb.date <= to_char(current_date, 'YYYY-MM-DD')) end, c.last_booked), date '2000-01-01') < current_date - 21, false),
      'marketing', case when exists (select 1 from public.marketing_consent mc where lower(mc.email) = k.e and mc.confirmed_at is not null and mc.withdrawn_at is null) then 'subscribed'
                        when exists (select 1 from public.marketing_consent mc where lower(mc.email) = k.e and mc.withdrawn_at is not null) then 'withdrawn' else 'no' end,
      'health_form', u.id is not null and exists (select 1 from public.member_health h where h.user_id = u.id and h.consent_health is true),
      'role', case when pr.is_admin then 'admin' else (select s.role from public.staff s where s.user_id = u.id) end,
      'joined', coalesce(c.created_wix, u.created_at),
      'sort', coalesce(c.last_activity, u.created_at, c.created_wix)) m
    from keys k
    left join (select distinct on (lower(email)) * from public.wix_contacts where email is not null order by lower(email), last_activity desc nulls last) c on lower(c.email) = k.e
    left join best b on b.e = k.e left join firsts f on f.e = k.e
    left join auth.users u on lower(u.email) = k.e left join public.profiles pr on pr.id = u.id
    limit greatest(1, least(coalesce(p_limit, 2000), 5000))) t), '[]'::jsonb);
end $$;

-- 2. everything about one person
create or replace function public.admin_member_profile(p_email text) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']); e text := lower(trim(coalesce(p_email, ''))); uid uuid;
begin
  select id into uid from auth.users where lower(email) = e limit 1;
  return jsonb_build_object(
    'contact', (select to_jsonb(c) - 'updated_at' from public.wix_contacts c where lower(c.email) = e order by last_activity desc nulls last limit 1),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('plan', o.plan_name, 'type', public._plan_type(o.plan_name), 'status', public._order_status(o.status, o.last_payment_status, o.failed_since), 'amount', o.amount, 'unit', o.cycle_unit,
        'pay', o.last_payment_status, 'started', o.cycle_started, 'ends', o.end_date, 'cycle', o.cycle_index, 'cancelling', o.auto_renew_canceled) order by o.cycle_started desc nulls last)
      from public.wix_orders o where lower(o.email) = e and o.status is distinct from 'DRAFT'), '[]'::jsonb),
    'app', case when uid is null then null else (select jsonb_build_object('user_id', u.id, 'created', u.created_at, 'last_sign_in', u.last_sign_in_at, 'gym_access', coalesce((select ma.gym_access from public.member_access ma where ma.user_id = u.id), false),
        'health_form', exists (select 1 from public.member_health h where h.user_id = u.id and h.consent_health is true), 'bookings', (select count(*) from public.class_bookings b where b.user_id = u.id)) from auth.users u where u.id = uid) end,
    'bookings', case when uid is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('date', b.date, 'time', c.start_time, 'name', c.name, 'source', coalesce(b.source, 'app')) order by b.date desc)
        from (select * from public.class_bookings where user_id = uid order by date desc limit 25) b join public.classes c on c.id = b.class_id), '[]'::jsonb) end,
    'forms', coalesce((select jsonb_agg(jsonb_build_object('form', f.form_id, 'at', f.created_at, 'status', f.status) order by f.created_at desc) from (select * from public.form_submissions where lower(data->>'email') = e order by created_at desc limit 15) f), '[]'::jsonb),
    'emails', coalesce((select jsonb_agg(jsonb_build_object('template', ev.template, 'status', ev.status, 'at', ev.created_at) order by ev.created_at desc) from (select * from public.email_events where lower(recipient) = e order by created_at desc limit 20) ev), '[]'::jsonb),
    'consent', (select jsonb_build_object('source', mc.source, 'confirmed', mc.confirmed_at, 'withdrawn', mc.withdrawn_at, 'wording', mc.wording) from public.marketing_consent mc where lower(mc.email) = e limit 1),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'note', n.note, 'at', n.created_at, 'by', coalesce((select pr.full_name from public.profiles pr where pr.id = n.created_by), 'Staff')) order by n.created_at desc) from public.member_notes n where lower(n.email) = e), '[]'::jsonb));
end $$;

create or replace function public.admin_member_note_add(p_email text, p_note text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']); n text := left(trim(coalesce(p_note, '')), 2000);
begin
  if n = '' then raise exception 'Write a note first.'; end if;
  insert into public.member_notes (email, note, created_by) values (lower(trim(p_email)), n, auth.uid());
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'member_note_added', lower(trim(p_email)));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.admin_member_note_delete(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  delete from public.member_notes where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 3. real numbers for Plans and payments (replaces the sample figures)
create or replace function public.admin_payments_summary() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  return (with best as (
      select distinct on (lower(o.email)) lower(o.email) e, o.*, public._order_status(o.status, o.last_payment_status, o.failed_since) st
      from public.wix_orders o where o.email is not null and o.status is distinct from 'DRAFT'
      order by lower(o.email), case o.status when 'ACTIVE' then 1 when 'PAUSED' then 2 when 'CANCELED' then 3 when 'ENDED' then 4 else 5 end, o.cycle_started desc nulls last),
    live as (select * from best where st in ('active', 'failed') and plan_name !~* 'personal training')
    select jsonb_build_object(
      'synced', (select max(updated_at) from public.wix_orders),
      'mrr', coalesce((select round(sum(public._monthly(amount, cycle_unit)), 2) from live), 0),
      'active', (select count(*) from live), 'paused', (select count(*) from best where st = 'paused'),
      'failed', (select count(*) from best where st = 'failed'),
      'by_plan', coalesce((select jsonb_agg(x) from (select plan_name n, count(*) v, round(sum(public._monthly(amount, cycle_unit)), 2) mrr from live group by plan_name order by count(*) desc) x), '[]'::jsonb),
      'by_type', coalesce((select jsonb_object_agg(t, v) from (select public._plan_type(plan_name) t, count(*) v from live group by 1) x), '{}'::jsonb),
      'new_30d', (select count(*) from live where cycle_started > now() - interval '30 days' and coalesce(cycle_index, 0) = 0),
      'left_30d', (select count(*) from best where st in ('cancelled', 'ended') and coalesce(end_date, updated_at) > now() - interval '30 days'),
      'cancelling', (select count(*) from live where auto_renew_canceled),
      'failed_list', coalesce((select jsonb_agg(x) from (select email, coalesce(full_name, email) name, plan_name plan, amount, failed_since, last_payment_status pay from best where st = 'failed' order by failed_since nulls last limit 100) x), '[]'::jsonb)));
end $$;

do $$ declare f text; begin
  foreach f in array array['admin_member_directory(integer)', 'admin_member_profile(text)', 'admin_member_note_add(text,text)', 'admin_member_note_delete(bigint)', 'admin_payments_summary()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
