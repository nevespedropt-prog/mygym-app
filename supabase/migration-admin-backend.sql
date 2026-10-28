-- MY GYM London: admin back end (staff roles + read/write functions). Written 2026-10-28. NOT YET APPLIED to the live database.
-- Roles: admin (owner, = profiles.is_admin), manager, reception, coach. The back end calls ONLY these functions; no table is opened up.
-- Every function checks the caller's role itself (SECURITY DEFINER) and returns only what that role may see. Health answers are viewed through one function that writes an audit row.
-- Needs: schema.sql (is_admin, profiles), migration-forms-and-consent.sql, migration-email-hooks.sql. Safe to run twice.

create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'reception', 'coach')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.staff_access_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  target text,
  at timestamptz not null default now()
);
alter table public.staff enable row level security;
alter table public.staff_access_log enable row level security;
revoke all on public.staff, public.staff_access_log from anon, authenticated;

-- who is calling: 'admin' | 'manager' | 'reception' | 'coach' | null
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select case when exists (select 1 from public.profiles where id = auth.uid() and is_admin is true) then 'admin'
              else (select role from public.staff where user_id = auth.uid()) end
$$;

create or replace function public._need(roles text[]) returns text
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public.staff_role();
begin
  if r is null or not (r = any (roles)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return r;
end $$;

create or replace function public._first_name(p text) returns text language sql immutable as $$
  select coalesce(nullif(split_part(trim(coalesce(p, '')), ' ', 1), ''), 'Member')
$$;
create or replace function public._short_name(p text) returns text language sql immutable as $$
  select public._first_name(p) || coalesce(' ' || nullif(left(split_part(trim(coalesce(p, '')), ' ', 2), 1), '') || '.', '')
$$;

-- 1. who am I (the page uses this to decide what to show)
create or replace function public.admin_whoami() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public.staff_role();
begin
  if r is null then return jsonb_build_object('role', null); end if;
  return jsonb_build_object('role', r,
    'name', coalesce((select full_name from public.profiles where id = auth.uid()), ''),
    'email', (select email from auth.users where id = auth.uid()));
end $$;

-- 2. dashboard numbers
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
  today date := (now() at time zone 'Europe/London')::date;
  out jsonb;
begin
  out := jsonb_build_object(
    'role', r, 'today', today,
    'today_classes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'start', c.start_time, 'coach', c.coach, 'kind', c.kind, 'capacity', c.capacity,
        'booked', (select count(*) from public.class_bookings b where b.class_id = c.id and b.date = today::text)
                + (select count(*) from public.wix_other_bookings w where w.class_id = c.id and w.date = today::text)) order by c.start_time)
      from public.classes c where c.active and c.day_name = trim(to_char(today, 'FMDay'))), '[]'::jsonb),
    'bookings_by_day', (
      select jsonb_agg(jsonb_build_object('d', g::date, 'n',
        (select count(*) from public.class_bookings b where b.date = g::date::text)
      + (select count(*) from public.wix_other_bookings w where w.date = g::date::text)) order by g)
      from generate_series(today - 13, today + 6, interval '1 day') g),
    'top_classes_30d', coalesce((
      select jsonb_agg(x order by (x->>'n')::int desc) from (
        select jsonb_build_object('name', c.name, 'n', count(*)) x
        from public.class_bookings b join public.classes c on c.id = b.class_id
        where c.kind = 'class' and b.date::date between today - 30 and today group by c.name order by count(*) desc limit 6) q), '[]'::jsonb),
    'upcoming_7d', (select count(*) from public.class_bookings b where b.date::date between today and today + 7));
  if r in ('admin', 'manager') then
    out := out || jsonb_build_object(
      'members_total', (select count(*) from auth.users),
      'members_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'members_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
      'emails_7d_sent', (select count(*) from public.email_events where status = 'sent' and created_at > now() - interval '7 days'),
      'emails_7d_failed', (select count(*) from public.email_events where status <> 'sent' and created_at > now() - interval '7 days'),
      'subscribers', (select count(*) from public.marketing_consent where confirmed_at is not null and withdrawn_at is null),
      'subscribers_pending', (select count(*) from public.marketing_consent where confirmed_at is null and withdrawn_at is null));
  end if;
  if r in ('admin', 'manager', 'reception') then
    out := out || jsonb_build_object(
      'enquiries_open', (select count(*) from public.form_submissions where status in ('new', 'contacted', 'trial')),
      'enquiries_new', (select count(*) from public.form_submissions where status = 'new'),
      'latest_enquiries', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'form_id', form_id, 'name', coalesce(data->>'full_name', data->>'parent_name', data->>'first_name', data->>'email'), 'status', status, 'at', created_at) order by created_at desc)
        from (select * from public.form_submissions where status in ('new', 'contacted', 'trial') order by created_at desc limit 5) s), '[]'::jsonb));
  end if;
  return out;
end $$;

-- 3. one day's classes with who is booked
create or replace function public.admin_day(p_date text) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
  d date := p_date::date;
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'start', c.start_time, 'coach', c.coach, 'kind', c.kind, 'capacity', c.capacity, 'info', c.info,
      'booked', (select count(*) from public.class_bookings b where b.class_id = c.id and b.date = d::text) + (select count(*) from public.wix_other_bookings w where w.class_id = c.id and w.date = d::text),
      'other_wix', (select count(*) from public.wix_other_bookings w where w.class_id = c.id and w.date = d::text),
      'people', coalesce((select jsonb_agg(jsonb_build_object('name', public._short_name(pr.full_name), 'source', coalesce(b.source, 'app')) order by b.created_at)
                          from public.class_bookings b left join public.profiles pr on pr.id = b.user_id where b.class_id = c.id and b.date = d::text), '[]'::jsonb)) order by c.start_time)
    from public.classes c where c.active and c.day_name = trim(to_char(d, 'FMDay'))), '[]'::jsonb);
end $$;

-- 4. members list (admin, manager, reception)
create or replace function public.admin_members(p_q text default '', p_limit integer default 200) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
  q text := '%' || lower(coalesce(p_q, '')) || '%';
begin
  return coalesce((
    select jsonb_agg(m order by (m->>'joined') desc) from (
      select jsonb_build_object('id', u.id, 'name', coalesce(pr.full_name, ''), 'email', u.email, 'phone', coalesce(pr.phone, ''), 'joined', u.created_at,
        'bookings', (select count(*) from public.class_bookings b where b.user_id = u.id),
        'last_booking', (select max(b.date) from public.class_bookings b where b.user_id = u.id),
        'gym_access', coalesce((select ma.gym_access from public.member_access ma where ma.user_id = u.id), false),
        'marketing', case when exists (select 1 from public.marketing_consent mc where mc.email = lower(u.email) and mc.confirmed_at is not null and mc.withdrawn_at is null) then 'subscribed'
                          when exists (select 1 from public.marketing_consent mc where mc.email = lower(u.email) and mc.withdrawn_at is not null) then 'withdrawn' else 'no' end,
        'health_form', exists (select 1 from public.member_health h where h.user_id = u.id and h.consent_health is true),
        'staff_role', (select s.role from public.staff s where s.user_id = u.id),
        'is_admin', coalesce(pr.is_admin, false)) m
      from auth.users u left join public.profiles pr on pr.id = u.id
      where lower(coalesce(pr.full_name, '') || ' ' || coalesce(u.email, '') || ' ' || coalesce(pr.phone, '')) like q
      order by u.created_at desc limit greatest(1, least(coalesce(p_limit, 200), 500))) t), '[]'::jsonb);
end $$;

-- 5. one member: bookings (admin, manager, reception)
create or replace function public.admin_member_bookings(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('date', b.date, 'time', c.start_time, 'name', c.name, 'kind', c.kind, 'source', coalesce(b.source, 'app'), 'booked_at', b.created_at) order by b.date desc, c.start_time desc)
    from (select * from public.class_bookings where user_id = p_user order by date desc limit 40) b join public.classes c on c.id = b.class_id), '[]'::jsonb);
end $$;

-- 6. health answers: admin, manager, coach only; every view is logged
create or replace function public.admin_member_health(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'coach']); h public.member_health%rowtype;
begin
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'view_health', p_user::text);
  select * into h from public.member_health where user_id = p_user;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'answers', h.answers, 'no_allergies', h.no_allergies, 'allergies', h.allergies, 'other_details', h.other_details,
    'consent_health', h.consent_health, 'consented_at', h.consented_at, 'updated_at', h.updated_at, 'version', h.consent_version);
end $$;

-- 7. enquiries (admin, manager, reception)
create or replace function public.admin_enquiries(p_status text default 'open') returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'form_id', s.form_id, 'data', s.data, 'status', s.status, 'note', s.note, 'handled_at', s.handled_at, 'created_at', s.created_at, 'source_url', s.source_url) order by s.created_at desc)
    from (select * from public.form_submissions
          where case when p_status = 'all' then true when p_status = 'open' then status in ('new', 'contacted', 'trial') else status = p_status end
          order by created_at desc limit 300) s), '[]'::jsonb);
end $$;
create or replace function public.admin_set_enquiry(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  if p_status is not null and p_status not in ('new', 'contacted', 'trial', 'joined', 'not_now', 'spam') then raise exception 'Bad status'; end if;
  update public.form_submissions set status = coalesce(p_status, status), note = case when p_note is null then note else nullif(left(p_note, 500), '') end, handled_at = now() where id = p_id;
end $$;

-- 8. email log and marketing numbers (admin, manager)
create or replace function public.admin_emails(p_limit integer default 100) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  return jsonb_build_object(
    'recent', coalesce((select jsonb_agg(jsonb_build_object('template', template, 'to', recipient, 'status', status, 'detail', left(coalesce(detail, ''), 160), 'at', created_at) order by created_at desc)
      from (select * from public.email_events order by created_at desc limit greatest(1, least(coalesce(p_limit, 100), 300))) e), '[]'::jsonb),
    'by_template_30d', coalesce((select jsonb_agg(jsonb_build_object('template', template, 'sent', n_ok, 'failed', n_bad) order by n_ok + n_bad desc)
      from (select template, count(*) filter (where status = 'sent') n_ok, count(*) filter (where status <> 'sent') n_bad from public.email_events where created_at > now() - interval '30 days' group by template) t), '[]'::jsonb));
end $$;

create or replace function public.admin_marketing() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  return jsonb_build_object(
    'confirmed', (select count(*) from public.marketing_consent where confirmed_at is not null and withdrawn_at is null),
    'pending', (select count(*) from public.marketing_consent where confirmed_at is null and withdrawn_at is null),
    'withdrawn', (select count(*) from public.marketing_consent where withdrawn_at is not null),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'n', n) order by n desc) from (select source, count(*) n from public.marketing_consent where confirmed_at is not null and withdrawn_at is null group by source) s), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'source', source, 'requested_at', requested_at, 'confirmed_at', confirmed_at, 'withdrawn_at', withdrawn_at) order by requested_at desc)
      from (select * from public.marketing_consent order by requested_at desc limit 50) m), '[]'::jsonb));
end $$;

-- 9. staff management (admin only)
create or replace function public.admin_staff_list() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', u.id, 'email', u.email, 'name', coalesce(pr.full_name, ''), 'role', case when pr.is_admin then 'admin' else s.role end, 'since', coalesce(s.created_at, u.created_at)) order by (case when pr.is_admin then 0 else 1 end), u.email)
    from auth.users u left join public.profiles pr on pr.id = u.id left join public.staff s on s.user_id = u.id
    where pr.is_admin is true or s.user_id is not null), '[]'::jsonb);
end $$;
create or replace function public.admin_staff_set(p_email text, p_role text) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']); uid uuid;
begin
  if p_role not in ('manager', 'reception', 'coach') then raise exception 'Role must be manager, reception or coach'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No app account with that email. Ask them to sign up in the app first.'; end if;
  if exists (select 1 from public.profiles where id = uid and is_admin is true) then raise exception 'That person is already an admin'; end if;
  insert into public.staff (user_id, role, added_by) values (uid, p_role, auth.uid()) on conflict (user_id) do update set role = excluded.role;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'staff_set', uid::text || ':' || p_role);
end $$;
create or replace function public.admin_staff_remove(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
begin
  delete from public.staff where user_id = p_user;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'staff_remove', p_user::text);
end $$;
create or replace function public.admin_audit(p_limit integer default 100) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'who', (select email from auth.users where id = l.user_id), 'action', l.action, 'target', l.target) order by l.at desc)
    from (select * from public.staff_access_log order by at desc limit greatest(1, least(coalesce(p_limit, 100), 300))) l), '[]'::jsonb);
end $$;

-- permissions: only signed-in users may call them (each function checks the role itself)
do $$ declare f text; begin
  foreach f in array array['staff_role()', '_need(text[])', 'admin_whoami()', 'admin_dashboard()', 'admin_day(text)', 'admin_members(text,integer)', 'admin_member_bookings(uuid)',
    'admin_member_health(uuid)', 'admin_enquiries(text)', 'admin_set_enquiry(uuid,text,text)', 'admin_emails(integer)', 'admin_marketing()', 'admin_staff_list()',
    'admin_staff_set(text,text)', 'admin_staff_remove(uuid)', 'admin_audit(integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public._need(text[]) from authenticated;
