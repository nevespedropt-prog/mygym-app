-- MY GYM London: Change plan screen in the app (written 2026-11-19, applied 2026-11-20 after owner approval; tested first inside a rolled-back transaction).
-- 1. member_plan_options: the recurring plans a member can compare and ask to move to (prices copied from the website Services page; edit here when prices change).
-- 2. membership_requests.target_plan: which plan the member asked to move to. 3. request_membership_change takes the target plan.
-- Nothing changes on the member's plan by itself: staff still make the change in the back office and press Mark done.
create table if not exists public.member_plan_options (
  name text primary key, price numeric not null, per text not null, includes jsonb not null default '[]'::jsonb, sort int not null default 0, active boolean not null default true
);
alter table public.member_plan_options enable row level security;
revoke all on public.member_plan_options from anon, authenticated;
insert into public.member_plan_options (name, price, per, includes, sort) values
  ('Gym Membership', 26, 'every month', '["Gym access"]'::jsonb, 1),
  ('Exercise Class Only Membership', 26, 'every month', '["Access to over 25 classes a week"]'::jsonb, 2),
  ('Gym & Exercise Class Membership', 35, 'every month', '["Access to over 25 classes a week", "Gym access", "Free induction", "Introductory health check"]'::jsonb, 3),
  ('Gym, Classes & 2 Personal Training Membership', 100, 'every month', '["Gym access", "All exercise classes", "2 personal training sessions"]'::jsonb, 4),
  ('Small Group Personal Training', 90, 'per month', '["2–4 people per group", "Split the £90 between you", "Minimum 4 sessions per month"]'::jsonb, 5),
  ('Exercise Classes (Annual)', 299, 'every year', '["Access to over 25 classes a week"]'::jsonb, 6),
  ('Gym & Exercise Class Membership (Annual)', 400, 'every year', '["Access to over 25 classes a week", "Gym access", "Free induction", "Introductory health check", "Saving of £20"]'::jsonb, 7)
on conflict (name) do update set price = excluded.price, per = excluded.per, includes = excluded.includes, sort = excluded.sort;

alter table public.membership_requests add column if not exists target_plan text;

create or replace function public.my_plan_options() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', name, 'price', price, 'per', per, 'includes', includes) order by sort) from public.member_plan_options where active), '[]'::jsonb);
end $$;

create or replace function public._mreq_json(q public.membership_requests) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', q.id, 'type', q.request_type, 'from_date', q.from_date, 'reason', q.reason, 'message', q.message, 'plan', q.plan_name, 'target', q.target_plan, 'status', q.status, 'created_at', q.created_at, 'resolved_at', q.resolved_at, 'note', q.staff_note, 'email', q.email)
$$;

drop function if exists public.request_membership_change(text, date, text, text);
create or replace function public.request_membership_change(p_type text, p_from date, p_reason text default null, p_message text default null, p_target text default null) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare e text; o record; nm text; id uuid; t text := lower(coalesce(p_type, '')); label text; tgt text := nullif(trim(coalesce(p_target, '')), '');
begin
  select lower(email) into e from auth.users where auth.users.id = auth.uid();
  if e is null then raise exception 'Please sign in.'; end if;
  if t not in ('pause', 'cancel', 'change') then raise exception 'Choose what you would like to do.'; end if;
  if p_from is null or p_from < current_date or p_from > current_date + 90 then raise exception 'Choose a date from today up to 90 days ahead.'; end if;
  select * into o from public.wix_orders w where lower(w.email) = e and w.status in ('ACTIVE', 'PAUSED') order by (w.status = 'ACTIVE') desc, w.cycle_started desc nulls last limit 1;
  if not found then raise exception 'You have no active membership to change.'; end if;
  if exists (select 1 from public.membership_requests m where m.email = e and m.status = 'received') then raise exception 'You already have a request waiting. Withdraw it first to send a new one.'; end if;
  if t = 'change' and tgt is not null then
    if not exists (select 1 from public.member_plan_options where name = tgt and active) then raise exception 'Choose one of the plans shown.'; end if;
    if lower(tgt) = lower(o.plan_name) then raise exception 'That is your current plan.'; end if;
  end if;
  if t <> 'change' then tgt := null; end if;
  insert into public.membership_requests (email, user_id, request_type, from_date, reason, message, order_id, plan_name, target_plan)
  values (e, auth.uid(), t, p_from, left(nullif(trim(coalesce(p_reason, '')), ''), 120), left(nullif(trim(coalesce(p_message, '')), ''), 600), o.order_id, o.plan_name, tgt) returning membership_requests.id into id;
  select coalesce(nullif(trim(p.full_name), ''), e) into nm from public.profiles p where p.id = auth.uid();
  label := case t when 'pause' then 'Pause' when 'cancel' then 'Cancel' else 'Change plan' end;
  perform public.queue_email('admin-change-request', null, 'info@mygymlondon.co.uk',
    jsonb_build_object('person_name', coalesce(nm, e), 'request_type', label, 'from_date', to_char(p_from, 'DD Mon YYYY'), 'reason', trim(both ' ' from coalesce(case when tgt is not null then 'Wants: ' || tgt || '. ' end, '') || coalesce(nullif(trim(p_reason), ''), '')), 'sla', 'two working days', 'admin_url', 'https://admin.mygymlondon.co.uk/#/members'),
    'mreq:' || id::text);
  return jsonb_build_object('id', id);
end $$;

revoke all on function public.my_plan_options() from public, anon;
grant execute on function public.my_plan_options() to authenticated;
revoke all on function public.request_membership_change(text, date, text, text, text) from public, anon;
grant execute on function public.request_membership_change(text, date, text, text, text) to authenticated;

-- 4. "Paid but cannot see your plan?" The member tells us which email they paid with. Staff check it in Wix and link it by hand;
--    nothing is ever linked automatically (anyone could otherwise claim someone else's plan). One request per member per day.
create table if not exists public.plan_help_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid, account_email text not null, other_email text not null, message text,
  status text not null default 'received' check (status in ('received', 'done')), created_at timestamptz not null default now()
);
alter table public.plan_help_requests enable row level security;
revoke all on public.plan_help_requests from anon, authenticated;
create or replace function public.request_plan_help(p_other_email text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare e text; o text := lower(trim(coalesce(p_other_email, ''))); nm text; id uuid;
begin
  select lower(email) into e from auth.users where auth.users.id = auth.uid();
  if e is null then raise exception 'Please sign in.'; end if;
  if o !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'That email address does not look right.'; end if;
  if exists (select 1 from public.plan_help_requests h where h.user_id = auth.uid() and h.created_at > now() - interval '1 day') then
    raise exception 'You already sent us this today. We will email you within 2 working days.';
  end if;
  insert into public.plan_help_requests (user_id, account_email, other_email, message) values (auth.uid(), e, o, left(nullif(trim(coalesce(p_message, '')), ''), 500)) returning plan_help_requests.id into id;
  select coalesce(nullif(trim(p.full_name), ''), e) into nm from public.profiles p where p.id = auth.uid();
  perform public.queue_email('notice', null, 'info@mygymlondon.co.uk',
    jsonb_build_object('first_name', 'team', 'campaign_subject', 'A member cannot see their plan', 'campaign_preheader', coalesce(nm, e) || ' paid with a different email',
      'campaign_title', 'Member cannot see their plan',
      'campaign_body', coalesce(nm, e) || ' (account email ' || e || ') says they paid with ' || o || '.' || coalesce(' Message: ' || nullif(trim(p_message), ''), '') || ' Please check Wix, and if it is theirs, link it in the back office.',
      'campaign_button', 'Open the back office', 'campaign_url', 'https://admin.mygymlondon.co.uk/#/members'),
    'planhelp:' || id::text);
  return jsonb_build_object('id', id);
end $$;
revoke all on function public.request_plan_help(text, text) from public, anon;
grant execute on function public.request_plan_help(text, text) to authenticated;
notify pgrst, 'reload schema';
