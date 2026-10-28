-- MY GYM London: admin back end part 3 (day-to-day tools: check-in, waitlist, staff rota, tasks, forms summary, system health). Written and APPLIED to the live database on 2026-10-28 (migration admin_backend_day_to_day).
-- Needs migration-admin-backend.sql (roles). New tables are closed to everyone; the back office reaches them only through these functions, which check the caller's role.

create table if not exists public.checkins (
  booking_id uuid primary key references public.class_bookings(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_by uuid references auth.users(id) on delete set null
);
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  class_id bigint not null references public.classes(id) on delete cascade,
  date text not null,
  name text not null check (length(name) between 1 and 80),
  phone text check (length(phone) <= 25),
  email text check (length(email) <= 120),
  note text check (length(note) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  person text not null check (length(person) between 1 and 60),
  date date not null,
  start_time text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  note text check (length(note) <= 120),
  created_by uuid references auth.users(id) on delete set null
);
create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  assigned text check (length(assigned) <= 60),
  due date,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.checkins enable row level security;
alter table public.waitlist enable row level security;
alter table public.staff_shifts enable row level security;
alter table public.staff_tasks enable row level security;
revoke all on public.checkins, public.waitlist, public.staff_shifts, public.staff_tasks from anon, authenticated;

-- check-in
create or replace function public.admin_checkin_roster(p_class bigint, p_date text) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  return jsonb_build_object(
    'people', coalesce((select jsonb_agg(jsonb_build_object('booking_id', b.id, 'name', coalesce(nullif(trim(pr.full_name), ''), 'Member'), 'source', coalesce(b.source, 'app'),
        'checked', exists (select 1 from public.checkins k where k.booking_id = b.id),
        'health', exists (select 1 from public.member_health h where h.user_id = b.user_id and h.consent_health is true)) order by pr.full_name)
      from public.class_bookings b left join public.profiles pr on pr.id = b.user_id where b.class_id = p_class and b.date = p_date), '[]'::jsonb),
    'other_wix', (select count(*) from public.wix_other_bookings w where w.class_id = p_class and w.date = p_date));
end $$;
create or replace function public.admin_checkin_set(p_booking uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  if p_on then insert into public.checkins (booking_id, checked_by) values (p_booking, auth.uid()) on conflict (booking_id) do nothing;
  else delete from public.checkins where booking_id = p_booking; end if;
end $$;
create or replace function public.admin_attendance() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
  today date := (now() at time zone 'Europe/London')::date;
begin
  return jsonb_build_object(
    'past_30d', (select count(*) from public.class_bookings b where b.date::date between today - 30 and today - 1),
    'checked_30d', (select count(*) from public.class_bookings b join public.checkins k on k.booking_id = b.id where b.date::date between today - 30 and today),
    'checked_today', (select count(*) from public.class_bookings b join public.checkins k on k.booking_id = b.id where b.date = today::text),
    'days_used', (select count(distinct b.date) from public.class_bookings b join public.checkins k on k.booking_id = b.id where b.date::date between today - 30 and today));
end $$;

-- waitlist (kept by hand at the desk)
create or replace function public.admin_waitlist() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
  today date := (now() at time zone 'Europe/London')::date;
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'class_id', w.class_id, 'class', c.name, 'time', c.start_time, 'date', w.date, 'name', w.name, 'phone', w.phone, 'email', w.email, 'note', w.note, 'added', w.created_at,
      'booked', (select count(*) from public.class_bookings b where b.class_id = c.id and b.date = w.date) + (select count(*) from public.wix_other_bookings x where x.class_id = c.id and x.date = w.date), 'capacity', c.capacity) order by w.date, c.start_time, w.created_at)
    from public.waitlist w join public.classes c on c.id = w.class_id where w.date::date >= today), '[]'::jsonb);
end $$;
create or replace function public.admin_waitlist_add(p_class bigint, p_date text, p_name text, p_phone text default null, p_email text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  insert into public.waitlist (class_id, date, name, phone, email, note, created_by) values (p_class, p_date, left(trim(p_name), 80), left(nullif(trim(p_phone), ''), 25), left(nullif(trim(p_email), ''), 120), left(nullif(trim(p_note), ''), 200), auth.uid());
end $$;
create or replace function public.admin_waitlist_remove(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin delete from public.waitlist where id = p_id; end $$;

-- staff rota
create or replace function public.admin_rota(p_from date) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
  m0 date := date_trunc('month', (now() at time zone 'Europe/London')::date)::date;
begin
  return jsonb_build_object(
    'shifts', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'person', person, 'date', date, 'start', start_time, 'end', end_time, 'note', note) order by date, start_time) from public.staff_shifts where date between p_from and p_from + 6), '[]'::jsonb),
    'month_hours', coalesce((select jsonb_agg(jsonb_build_object('person', person, 'hours', round(h::numeric, 1)) order by person) from (
        select person, sum(extract(epoch from (end_time::time - start_time::time)) / 3600.0) h from public.staff_shifts where date >= m0 and date < (m0 + interval '1 month')::date group by person) q), '[]'::jsonb));
end $$;
create or replace function public.admin_shift_add(p_person text, p_date date, p_start text, p_end text, p_note text default null) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  if p_end <= p_start then raise exception 'The end time must be after the start time'; end if;
  insert into public.staff_shifts (person, date, start_time, end_time, note, created_by) values (left(trim(p_person), 60), p_date, p_start, p_end, left(nullif(trim(p_note), ''), 120), auth.uid());
end $$;
create or replace function public.admin_shift_remove(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin delete from public.staff_shifts where id = p_id; end $$;

-- tasks
create or replace function public.admin_tasks() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'assigned', assigned, 'due', due, 'done', done, 'done_at', done_at, 'created_at', created_at) order by done, due nulls last, created_at desc)
    from (select * from public.staff_tasks where not done or done_at > now() - interval '7 days' order by created_at desc limit 200) t), '[]'::jsonb);
end $$;
create or replace function public.admin_task_add(p_title text, p_assigned text default null, p_due date default null) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception 'Please type the task'; end if;
  insert into public.staff_tasks (title, assigned, due, created_by) values (left(trim(p_title), 200), left(nullif(trim(p_assigned), ''), 60), p_due, auth.uid());
end $$;
create or replace function public.admin_task_toggle(p_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin update public.staff_tasks set done = p_done, done_at = case when p_done then now() end where id = p_id; end $$;
create or replace function public.admin_task_remove(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  delete from public.staff_tasks where id = p_id and (r in ('admin', 'manager') or created_by = auth.uid());
end $$;

-- forms summary and system health
create or replace function public.admin_forms_summary() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('form_id', form_id, 'total', total, 'last_30d', l30, 'new', nw, 'last_at', last_at) order by total desc)
    from (select form_id, count(*) total, count(*) filter (where created_at > now() - interval '30 days') l30, count(*) filter (where status = 'new') nw, max(created_at) last_at from public.form_submissions group by form_id) q), '[]'::jsonb);
end $$;
create or replace function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  return jsonb_build_object(
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('job', j.jobname, 'schedule', j.schedule, 'active', j.active, 'status', d.status, 'at', d.start_time,
        'failed_7d', (select count(*) from cron.job_run_details x where x.jobid = j.jobid and x.status = 'failed' and x.start_time > now() - interval '7 days')) order by j.jobname)
      from cron.job j left join lateral (select status, start_time from cron.job_run_details x where x.jobid = j.jobid order by start_time desc limit 1) d on true), '[]'::jsonb),
    'flags', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'mode', mode)) from public.app_flags), '[]'::jsonb),
    'sync', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'last_run', last_run, 'last_call', last_call) order by id) from public.sync_log), '[]'::jsonb),
    'email_failed_7d', (select count(*) from public.email_events where status <> 'sent' and created_at > now() - interval '7 days'),
    'counts', jsonb_build_object('members', (select count(*) from auth.users), 'bookings', (select count(*) from public.class_bookings), 'enquiries', (select count(*) from public.form_submissions), 'emails', (select count(*) from public.email_events)));
end $$;

do $$ declare f text; begin
  foreach f in array array['admin_checkin_roster(bigint,text)', 'admin_checkin_set(uuid,boolean)', 'admin_attendance()', 'admin_waitlist()', 'admin_waitlist_add(bigint,text,text,text,text,text)', 'admin_waitlist_remove(uuid)',
    'admin_rota(date)', 'admin_shift_add(text,date,text,text,text)', 'admin_shift_remove(uuid)', 'admin_tasks()', 'admin_task_add(text,text,date)', 'admin_task_toggle(uuid,boolean)', 'admin_task_remove(uuid)', 'admin_forms_summary()', 'admin_health()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
