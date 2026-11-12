-- MY GYM London: cancel ONE date of a class or gym hour from the back office. Written 2026-11-12.
-- Needs migration-admin-backend.sql (roles, _need, staff_access_log) and the timetable tables (classes, class_bookings).
--
-- What it does (owner's decision 2026-11-12):
--   * the back office marks a date of a class as cancelled (table class_cancellations; the class itself stays on the weekly timetable)
--   * the member app shows that date as "Cancelled" and nobody can book it any more (database rule + the book-class function)
--   * members' existing bookings for that date are KEPT in the database (history) but the app hides them from the upcoming list
--   * class reminders (push and email) are not sent for a cancelled date
--   * the back office Schedule page shows the date as cancelled and can restore it
--   * emailing the people who were booked is a separate, optional step (admin-class-cancelled function)
-- Website bookings made in Wix are untouched: before launch the session must also be cancelled in Wix by hand, and the sync can still
-- copy Wix bookings in (the database rule only blocks app bookings), which the app then hides.
--
-- To undo: delete from public.class_cancellations; (restores every date), or drop the table and re-apply the older function versions
-- (enforce_booking_rules, due_class_reminders, send_class_reminder_emails, admin_day, admin_checkin_roster) from their earlier migrations.

create table if not exists public.class_cancellations (
  class_id bigint not null references public.classes(id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  reason text not null default '',
  cancelled_by uuid,
  created_at timestamptz not null default now(),
  primary key (class_id, date)
);
alter table public.class_cancellations enable row level security;
revoke all on public.class_cancellations from anon, authenticated;
-- the app (signed in or not) may see WHICH dates are cancelled, never the reason or who cancelled
grant select (class_id, date) on public.class_cancellations to anon, authenticated;
drop policy if exists class_cancellations_read on public.class_cancellations;
create policy class_cancellations_read on public.class_cancellations for select to anon, authenticated using (true);

-- 1. nobody can book a cancelled date (Wix-synced bookings are not blocked: they come in with no signed-in user and are hidden by the app)
create or replace function public.enforce_booking_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.classes%rowtype;
  d date;
  today date := (now() at time zone 'Europe/London')::date;
  now_hm text := to_char(now() at time zone 'Europe/London', 'HH24:MI');
  taken int;
begin
  if auth.uid() is null and new.source = 'wix' then
    return new;
  end if;
  if auth.uid() is not null then
    new.source := 'app';
    new.wix_booking_id := null;
  end if;

  if new.date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid date' using errcode = 'P0001';
  end if;
  begin d := new.date::date; exception when others then
    raise exception 'Invalid date' using errcode = 'P0001';
  end;
  if d < today then raise exception 'You can''t book a past class' using errcode = 'P0001'; end if;
  if d > today + 60 then raise exception 'You can only book up to 60 days ahead' using errcode = 'P0001'; end if;

  select * into c from public.classes where id = new.class_id and active for update;  -- row lock: no two people take the last spot
  if not found then raise exception 'Class not available' using errcode = 'P0001'; end if;
  if trim(to_char(d, 'Day')) <> c.day_name then
    raise exception 'That class doesn''t run on this date' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.class_cancellations x where x.class_id = new.class_id and x.date = new.date) then
    raise exception '%', case when c.kind = 'gym' then 'That hour has been cancelled' else 'That class has been cancelled' end using errcode = 'P0001';
  end if;

  if d = today and c.start_time <= now_hm then
    raise exception '%', case when c.kind = 'gym' then 'That hour has already started' else 'That class has already started' end
      using errcode = 'P0001';
  end if;

  if c.kind = 'gym' then
    if not public.is_admin() and not exists (
      select 1 from public.member_access m
      where m.user_id = new.user_id and m.gym_access and m.checked_at > now() - interval '24 hours'
    ) then
      raise exception 'Gym booking is for Gym & Exercise Class members' using errcode = 'P0001';
    end if;
  end if;

  select (select count(*) from public.class_bookings where class_id = new.class_id and date = new.date)
       + (select count(*) from public.wix_other_bookings where class_id = new.class_id and date = new.date)
    into taken;
  if taken >= c.capacity then raise exception 'This class is full' using errcode = 'P0001'; end if;
  return new;
end $$;

-- 2. no reminders for a cancelled date
create or replace function public.due_class_reminders()
returns table (booking_id uuid, user_id uuid, kind text, class_name text, start_hhmm text, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select b.id, b.user_id, c.kind, c.name, c.start_time, s.endpoint, s.p256dh, s.auth
  from public.class_bookings b
  join public.classes c on c.id = b.class_id
  join public.push_subscriptions s on s.user_id = b.user_id
  where not exists (select 1 from public.booking_reminders r where r.booking_id = b.id)
    and not exists (select 1 from public.class_cancellations x where x.class_id = b.class_id and x.date = b.date)
    and ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London')
        between now() + interval '55 minutes' and now() + interval '65 minutes'
    and b.created_at < ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London') - interval '60 minutes';
$$;

create or replace function public.send_class_reminder_emails(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in
    select b.id, b.user_id, b.date, c.name, c.kind, c.coach, left(c.start_time, 5) as hhmm
    from public.class_bookings b
    join public.classes c on c.id = b.class_id
    where coalesce(b.source, 'app') = 'app'
      and not exists (select 1 from public.class_cancellations x where x.class_id = b.class_id and x.date = b.date)
      and ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London') between p_now + interval '115 minutes' and p_now + interval '125 minutes'
      and b.created_at < ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London') - interval '120 minutes'
      and not exists (select 1 from public.email_events e where e.dedupe_key = 'reminder-' || b.id::text)
  loop
    perform public.queue_email('class-reminder', r.user_id, null, jsonb_build_object(
      'first_name', coalesce(nullif(split_part(trim(coalesce((select full_name from public.profiles where id = r.user_id), '')), ' ', 1), ''), 'there'),
      'class_name', case when r.kind = 'gym' then 'Gym session' else r.name end,
      'time', r.hhmm,
      'when', trim(to_char(r.date::date, 'FMDay')) || ' ' || to_char(r.date::date, 'FMDD') || ' ' || trim(to_char(r.date::date, 'FMMonth')) || ' at ' || r.hhmm,
      'coach', case when r.kind <> 'gym' then coalesce(r.coach, '') else '' end), 'reminder-' || r.id::text);
    n := n + 1;
  end loop;
  return n;
exception when others then
  return n;
end $$;

-- 3. the back office Schedule page: say which sessions are cancelled
create or replace function public.admin_day(p_date text) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
  d date := p_date::date;
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'start', c.start_time, 'coach', c.coach, 'kind', c.kind, 'capacity', c.capacity, 'info', c.info,
      'cancelled', exists (select 1 from public.class_cancellations x where x.class_id = c.id and x.date = d::text),
      'cancel_reason', (select x.reason from public.class_cancellations x where x.class_id = c.id and x.date = d::text),
      'booked', (select count(*) from public.class_bookings b where b.class_id = c.id and b.date = d::text) + (select count(*) from public.wix_other_bookings w where w.class_id = c.id and w.date = d::text),
      'other_wix', (select count(*) from public.wix_other_bookings w where w.class_id = c.id and w.date = d::text),
      'people', coalesce((select jsonb_agg(jsonb_build_object('name', public._short_name(pr.full_name), 'source', coalesce(b.source, 'app')) order by b.created_at)
                          from public.class_bookings b left join public.profiles pr on pr.id = b.user_id where b.class_id = c.id and b.date = d::text), '[]'::jsonb)) order by c.start_time)
    from public.classes c where c.active and c.day_name = trim(to_char(d, 'FMDay'))), '[]'::jsonb);
end $$;

-- the check-in roster also says so (so reception does not check people into a cancelled class)
create or replace function public.admin_checkin_roster(p_class bigint, p_date text) returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  return jsonb_build_object(
    'cancelled', exists (select 1 from public.class_cancellations x where x.class_id = p_class and x.date = p_date),
    'people', coalesce((select jsonb_agg(jsonb_build_object('booking_id', b.id, 'name', coalesce(nullif(trim(pr.full_name), ''), 'Member'), 'source', coalesce(b.source, 'app'),
        'checked', exists (select 1 from public.checkins k where k.booking_id = b.id),
        'health', exists (select 1 from public.member_health h where h.user_id = b.user_id and h.consent_health is true)) order by pr.full_name)
      from public.class_bookings b left join public.profiles pr on pr.id = b.user_id where b.class_id = p_class and b.date = p_date), '[]'::jsonb),
    'other_wix', (select count(*) from public.wix_other_bookings w where w.class_id = p_class and w.date = p_date));
end $$;

-- 4. cancel / restore one date (admin and manager). The email to the people booked is a separate step.
create or replace function public.admin_class_date_cancel(p_class bigint, p_date text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
  c public.classes%rowtype; d date; today date := (now() at time zone 'Europe/London')::date;
begin
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Pick a date.'; end if;
  begin d := p_date::date; exception when others then raise exception 'Pick a date.'; end;
  select * into c from public.classes where id = p_class;
  if not found then raise exception 'Class not found.'; end if;
  if trim(to_char(d, 'FMDay')) <> c.day_name then raise exception '% runs on %s. Pick a %.', c.name, c.day_name, c.day_name; end if;
  if d < today then raise exception 'That date has already passed.'; end if;
  insert into public.class_cancellations (class_id, date, reason, cancelled_by) values (p_class, p_date, left(trim(coalesce(p_reason, '')), 200), auth.uid())
    on conflict (class_id, date) do nothing;
  if not found then raise exception 'That class is already cancelled on this date.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'class_date_cancelled', p_class || ':' || p_date);
  return jsonb_build_object('cancelled', true, 'booked', (select count(*) from public.class_bookings b where b.class_id = p_class and b.date = p_date));
end $$;

create or replace function public.admin_class_date_restore(p_class bigint, p_date text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  delete from public.class_cancellations where class_id = p_class and date = p_date and date >= to_char((now() at time zone 'Europe/London')::date, 'YYYY-MM-DD');
  if not found then raise exception 'That date is not cancelled (or has already passed).'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'class_date_restored', p_class || ':' || p_date);
  return jsonb_build_object('restored', true);
end $$;

do $$ declare f text; begin
  foreach f in array array['admin_class_date_cancel(bigint,text,text)', 'admin_class_date_restore(bigint,text)', 'admin_day(text)', 'admin_checkin_roster(bigint,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
