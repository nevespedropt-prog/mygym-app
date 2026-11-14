-- 2026-11-14. My membership: a member sees their plan in the app and can ask to pause, cancel or change it. Staff confirm in the back office (Members > Requests).
-- Nothing is paused or cancelled by the request itself: it only tells the gym, who then use the existing buttons on the member and press Mark done.
-- The gym is emailed with the existing admin-change-request email. To undo: drop the functions below, then drop table public.membership_requests.
create table if not exists public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null, user_id uuid,
  request_type text not null check (request_type in ('pause', 'cancel', 'change')),
  from_date date not null, reason text, message text,
  order_id text, plan_name text,
  status text not null default 'received' check (status in ('received', 'done', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid, staff_note text
);
create index if not exists membership_requests_email on public.membership_requests (email, status);
alter table public.membership_requests enable row level security;
revoke all on public.membership_requests from anon, authenticated;

create or replace function public._mreq_json(q public.membership_requests) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', q.id, 'type', q.request_type, 'from_date', q.from_date, 'reason', q.reason, 'message', q.message, 'plan', q.plan_name, 'status', q.status, 'created_at', q.created_at, 'resolved_at', q.resolved_at, 'note', q.staff_note, 'email', q.email)
$$;

-- the signed-in member's plan, credits and latest request
create or replace function public.my_membership() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare e text; o record; q public.membership_requests; nxt date;
begin
  select lower(email) into e from auth.users where id = auth.uid();
  if e is null then raise exception 'Please sign in.'; end if;
  select * into o from public.wix_orders w where lower(w.email) = e and w.status in ('ACTIVE', 'PAUSED')
    order by (w.status = 'ACTIVE') desc, w.cycle_started desc nulls last limit 1;
  if found and o.cycle_unit in ('MONTH', 'WEEK', 'YEAR') and o.cycle_started is not null and o.status = 'ACTIVE' then
    nxt := (o.cycle_started::date + (case o.cycle_unit when 'MONTH' then interval '1 month' when 'WEEK' then interval '1 week' else interval '1 year' end))::date;
    while nxt <= current_date loop nxt := (nxt + (case o.cycle_unit when 'MONTH' then interval '1 month' when 'WEEK' then interval '1 week' else interval '1 year' end))::date; end loop;
    if o.end_date is not null and nxt > o.end_date::date then nxt := null; end if;
  end if;
  select * into q from public.membership_requests where email = e order by created_at desc limit 1;
  return jsonb_build_object(
    'plan', case when o.order_id is null then null else jsonb_build_object('order_id', o.order_id, 'name', o.plan_name, 'status', lower(o.status), 'amount', o.amount, 'unit', o.cycle_unit, 'started', o.cycle_started,
       'ends', o.end_date, 'cancelling', o.auto_renew_canceled, 'next_payment', nxt, 'payment_failed', (o.last_payment_status = 'FAILED' or o.failed_since is not null), 'type', public._plan_type(o.plan_name)) end,
    'credits', coalesce((select sum(credits) from public.class_credits where email = e and status = 'available' and (expires_at is null or expires_at >= now())), 0),
    'request', case when q.id is null then null else public._mreq_json(q) end);
end $$;

create or replace function public.request_membership_change(p_type text, p_from date, p_reason text default null, p_message text default null) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare e text; o record; nm text; id uuid; t text := lower(coalesce(p_type, '')); label text;
begin
  select lower(email) into e from auth.users where auth.users.id = auth.uid();
  if e is null then raise exception 'Please sign in.'; end if;
  if t not in ('pause', 'cancel', 'change') then raise exception 'Choose what you would like to do.'; end if;
  if p_from is null or p_from < current_date or p_from > current_date + 90 then raise exception 'Choose a date from today up to 90 days ahead.'; end if;
  select * into o from public.wix_orders w where lower(w.email) = e and w.status in ('ACTIVE', 'PAUSED') order by (w.status = 'ACTIVE') desc, w.cycle_started desc nulls last limit 1;
  if not found then raise exception 'You have no active membership to change.'; end if;
  if exists (select 1 from public.membership_requests m where m.email = e and m.status = 'received') then raise exception 'You already have a request waiting. Withdraw it first to send a new one.'; end if;
  insert into public.membership_requests (email, user_id, request_type, from_date, reason, message, order_id, plan_name)
  values (e, auth.uid(), t, p_from, left(nullif(trim(coalesce(p_reason, '')), ''), 120), left(nullif(trim(coalesce(p_message, '')), ''), 600), o.order_id, o.plan_name) returning membership_requests.id into id;
  select coalesce(nullif(trim(p.full_name), ''), e) into nm from public.profiles p where p.id = auth.uid();
  label := case t when 'pause' then 'Pause' when 'cancel' then 'Cancel' else 'Change plan' end;
  perform public.queue_email('admin-change-request', null, 'info@mygymlondon.co.uk',
    jsonb_build_object('person_name', coalesce(nm, e), 'request_type', label, 'from_date', to_char(p_from, 'DD Mon YYYY'), 'reason', coalesce(nullif(trim(p_reason), ''), ''), 'sla', 'two working days', 'admin_url', 'https://admin.mygymlondon.co.uk/#/members'),
    'mreq:' || id::text);
  return jsonb_build_object('id', id);
end $$;

create or replace function public.withdraw_membership_request(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare e text;
begin
  select lower(email) into e from auth.users where auth.users.id = auth.uid();
  update public.membership_requests set status = 'withdrawn', resolved_at = now() where membership_requests.id = p_id and email = e and status = 'received';
  if not found then raise exception 'That request cannot be withdrawn.'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_membership_requests(p_status text default 'received') returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  return coalesce((select jsonb_agg(public._mreq_json(q) || jsonb_build_object('name', coalesce((select nullif(trim(full_name), '') from public.profiles p where p.id = q.user_id), q.email)) order by q.created_at desc)
    from (select * from public.membership_requests where (p_status is null or status = p_status) order by created_at desc limit 100) q), '[]'::jsonb);
end $$;

create or replace function public.admin_membership_request_resolve(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  if p_status not in ('done', 'declined') then raise exception 'Choose done or declined.'; end if;
  update public.membership_requests set status = p_status, resolved_at = now(), resolved_by = auth.uid(), staff_note = left(nullif(trim(coalesce(p_note, '')), ''), 300) where membership_requests.id = p_id and status = 'received';
  if not found then raise exception 'That request is no longer waiting.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'membership_request_' || p_status, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public._mreq_json(public.membership_requests) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['my_membership()', 'request_membership_change(text,date,text,text)', 'withdraw_membership_request(uuid)', 'admin_membership_requests(text)', 'admin_membership_request_resolve(uuid,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
notify pgrst, 'reload schema';
