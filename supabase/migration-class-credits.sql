-- 2026-11-14. Class credits: a cancelled pay-as-you-go class becomes a credit for another class (no refunds; owner decision 2026-10-16).
-- One row = some credits for one email. Staff can add, use and void credits in the back office (Members > open a member > Class credits).
-- The booking function will later call consume_class_credit() so a credit is spent automatically when the member books. Nothing spends credits automatically yet.
-- Only the server and signed-in staff (admin, manager) can read or change this table. Credits never expire unless an expiry date is set.
-- To undo: drop the functions below, then drop table public.class_credits.
create table if not exists public.class_credits (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  user_id uuid,
  credits integer not null default 1 check (credits between 1 and 10),
  reason text not null default 'Pay as you go class cancelled',
  source text not null default 'staff' check (source in ('staff', 'payg_cancel', 'system')),
  source_ref text,
  original_class text,
  original_date date,
  status text not null default 'available' check (status in ('available', 'used', 'void')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  used_at timestamptz,
  used_by uuid,
  used_for text,
  used_booking_ref text,
  note text
);
create index if not exists class_credits_email on public.class_credits (email, status);
alter table public.class_credits enable row level security;
revoke all on public.class_credits from anon, authenticated;

create or replace function public._credit_json(c public.class_credits) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', c.id, 'email', c.email, 'credits', c.credits, 'reason', c.reason, 'source', c.source, 'source_ref', c.source_ref,
    'original_class', c.original_class, 'original_date', c.original_date, 'status', case when c.status = 'available' and c.expires_at is not null and c.expires_at < now() then 'expired' else c.status end,
    'expires_at', c.expires_at, 'created_at', c.created_at, 'used_at', c.used_at, 'used_for', c.used_for, 'note', c.note)
$$;

-- list one member's credits (or everyone's available ones when no email is given)
create or replace function public.admin_credits_list(p_email text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); e text := lower(trim(coalesce(p_email, '')));
begin
  return jsonb_build_object(
    'balance', coalesce((select sum(credits) from public.class_credits where (e = '' or email = e) and status = 'available' and (expires_at is null or expires_at >= now())), 0),
    'credits', coalesce((select jsonb_agg(public._credit_json(c) order by c.created_at desc) from (select * from public.class_credits where (e = '' or email = e) and (e <> '' or status = 'available') order by created_at desc limit 200) c), '[]'::jsonb));
end $$;

create or replace function public.admin_credit_grant(p_email text, p_credits integer, p_reason text, p_original_class text default null, p_original_date date default null, p_expires_on date default null)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); e text := lower(trim(coalesce(p_email, ''))); n integer := coalesce(p_credits, 1); id uuid;
begin
  if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'That email address does not look right.'; end if;
  if n < 1 or n > 10 then raise exception 'A credit is for 1 to 10 classes.'; end if;
  if p_expires_on is not null and p_expires_on <= current_date then raise exception 'The expiry date must be in the future.'; end if;
  insert into public.class_credits (email, user_id, credits, reason, source, original_class, original_date, expires_at, created_by)
  values (e, (select u.id from auth.users u where lower(u.email) = e limit 1), n, left(coalesce(nullif(trim(p_reason), ''), 'Pay as you go class cancelled'), 200), 'staff',
          left(nullif(trim(coalesce(p_original_class, '')), ''), 120), p_original_date, case when p_expires_on is null then null else (p_expires_on + 1)::timestamptz end, auth.uid())
  returning class_credits.id into id;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'credit_granted', left(e || ' x' || n, 200));
  return jsonb_build_object('id', id);
end $$;

-- staff spent a credit (they put the member into a class by hand): record what it was used for
create or replace function public.admin_credit_use(p_id uuid, p_used_for text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); c public.class_credits;
begin
  select * into c from public.class_credits where id = p_id for update;
  if not found then raise exception 'That credit was not found.'; end if;
  if c.status <> 'available' then raise exception 'That credit is already %.', c.status; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'That credit has expired.'; end if;
  if nullif(trim(coalesce(p_used_for, '')), '') is null then raise exception 'Say which class it was used for.'; end if;
  if c.credits > 1 then
    update public.class_credits set credits = credits - 1 where id = p_id;
    insert into public.class_credits (email, user_id, credits, reason, source, source_ref, original_class, original_date, status, created_by, used_at, used_by, used_for)
    values (c.email, c.user_id, 1, c.reason, c.source, c.source_ref, c.original_class, c.original_date, 'used', c.created_by, now(), auth.uid(), left(trim(p_used_for), 200));
  else
    update public.class_credits set status = 'used', used_at = now(), used_by = auth.uid(), used_for = left(trim(p_used_for), 200) where id = p_id;
  end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'credit_used', left(c.email, 200));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_credit_void(p_id uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); c public.class_credits;
begin
  select * into c from public.class_credits where id = p_id for update;
  if not found then raise exception 'That credit was not found.'; end if;
  if c.status <> 'available' then raise exception 'Only an available credit can be cancelled.'; end if;
  update public.class_credits set status = 'void', note = left(nullif(trim(coalesce(p_note, '')), ''), 300) where id = p_id;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'credit_voided', left(c.email, 200));
  return jsonb_build_object('ok', true);
end $$;

-- for the booking function (server only): spend one available credit for this email, oldest first, and return its id (null when there is none)
create or replace function public.consume_class_credit(p_email text, p_used_for text, p_booking_ref text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare e text := lower(trim(coalesce(p_email, ''))); c public.class_credits; nid uuid;
begin
  select * into c from public.class_credits where email = e and status = 'available' and (expires_at is null or expires_at >= now())
   order by expires_at nulls last, created_at limit 1 for update skip locked;
  if not found then return null; end if;
  if c.credits > 1 then
    update public.class_credits set credits = credits - 1 where id = c.id;
    insert into public.class_credits (email, user_id, credits, reason, source, source_ref, original_class, original_date, status, created_by, used_at, used_for, used_booking_ref)
    values (c.email, c.user_id, 1, c.reason, c.source, c.source_ref, c.original_class, c.original_date, 'used', c.created_by, now(), left(coalesce(p_used_for, ''), 200), left(p_booking_ref, 120)) returning id into nid;
    return nid;
  end if;
  update public.class_credits set status = 'used', used_at = now(), used_for = left(coalesce(p_used_for, ''), 200), used_booking_ref = left(p_booking_ref, 120) where id = c.id;
  return c.id;
end $$;

revoke all on function public._credit_json(public.class_credits) from public, anon, authenticated;
revoke all on function public.consume_class_credit(text, text, text) from public, anon, authenticated;
grant execute on function public.consume_class_credit(text, text, text) to service_role;
do $$ declare f text; begin
  foreach f in array array['admin_credits_list(text)', 'admin_credit_grant(text,integer,text,text,date,date)', 'admin_credit_use(uuid,text)', 'admin_credit_void(uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
notify pgrst, 'reload schema';

-- Plan type: pay-as-you-go plans (for example 'PAYG Gym Visit') are their own type, not 'Gym + Classes'. APPLIED 2026-11-14.
create or replace function public._plan_type(p_name text) returns text language sql immutable as $$
  select case when p_name ~* 'personal training' then 'pt' when p_name ~* 'payg|pay as you go' then 'payg' when p_name ~* 'gym' then 'gym_classes' when p_name ~* 'class' then 'classes' else 'other' end
$$;

-- Back office: take a member off news and offers (withdraw only; nobody is ever re-subscribed from here). APPLIED 2026-11-14.
create or replace function public.admin_member_marketing_withdraw(p_email text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); e text := lower(trim(coalesce(p_email, ''))); n integer;
begin
  if e = '' then raise exception 'That person has no email address.'; end if;
  update public.marketing_consent set withdrawn_at = now() where lower(email) = e and confirmed_at is not null and withdrawn_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'They are not subscribed to news and offers.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'marketing_withdrawn', left(e, 200));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_member_marketing_withdraw(text) from public, anon;
grant execute on function public.admin_member_marketing_withdraw(text) to authenticated;
notify pgrst, 'reload schema';
