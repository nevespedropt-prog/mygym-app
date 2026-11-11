-- MY GYM London: admin back end part 4 (timetable editor). Written 2026-11-11. NOT APPLIED to the live database yet.
-- Needs migration-admin-backend.sql (roles, _need, staff_access_log), migration-gym.sql (classes.kind), migration-timetable-sync.sql (classes.source),
-- migration-admin-backend-3.sql (waitlist) and migration-book-class.sql (app_flags). Additive only; safe to run twice. Deletes nothing it does not own.
--
-- What it gives the back office:
--   admin_timetable_edit()                    read: every class and gym hour, who is booked ahead, which are Wix-made, and who controls the timetable
--   admin_class_save(jsonb)                   add or edit one class or gym hour (day, time, name, coach, length text, capacity, on/off)
--   admin_class_set_active(id, on, force)     switch one on or off (asks for force when people are booked ahead)
--   admin_class_remove(id, force)             delete a class that was never booked; otherwise switch it off (never deletes bookings)
--   admin_timetable_control_get() / _set(mode)   who controls the timetable: 'wix' (today) or 'backoffice' (launch day, owner only)
-- Roles: admin and manager may change things; reception and coach may only read. Every change is written to staff_access_log.
--
-- THE WIX SYNC: while the flag is 'wix' (default), the sync-timetable function keeps overwriting rows with source = 'wix'
-- every 10 minutes, so edits to those rows are put back. Rows added here are source = 'manual' and are never touched.
-- At launch the owner switches control to 'backoffice': that turns the sync off (the function checks app_flags key timetable_backoffice)
-- and turns every active Wix row into a manual row so the edits stay.
-- Deleting a class cascades to its bookings, which is why remove() only deletes a class that has no booking, wix booking or waitlist row at all.
--
-- To undo:  select cron.unschedule is NOT needed. To go back to the website sync:  update public.app_flags set mode = 'off' where key = 'timetable_backoffice';
--           (rows that were turned into manual stay manual; the sync will then add the website versions beside them, so check for doubles).
--           To remove everything this file adds: drop the admin_class_*, admin_timetable_* and _tt_* functions below, and delete the app_flags row.

insert into public.app_flags (key, mode, test_emails)
values ('timetable_backoffice', 'off', '{}')   -- 'off' = the website (Wix) still drives the timetable, exactly as today
on conflict (key) do nothing;

-- helpers (internal; not callable by members)
create or replace function public._tt_mode() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when exists (select 1 from public.app_flags where key = 'timetable_backoffice' and mode = 'on') then 'backoffice' else 'wix' end
$$;

create or replace function public._tt_future(p_id bigint) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select ((select count(*) from public.class_bookings b where b.class_id = p_id and b.date >= to_char((now() at time zone 'Europe/London')::date, 'YYYY-MM-DD'))
        + (select count(*) from public.wix_other_bookings w where w.class_id = p_id and w.date >= to_char((now() at time zone 'Europe/London')::date, 'YYYY-MM-DD')))::integer
$$;

create or replace function public._tt_booked_on(p_id bigint, p_date date) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_date is null then 0 else
    ((select count(*) from public.class_bookings b where b.class_id = p_id and b.date = to_char(p_date, 'YYYY-MM-DD'))
   + (select count(*) from public.wix_other_bookings w where w.class_id = p_id and w.date = to_char(p_date, 'YYYY-MM-DD')))::integer end
$$;

-- the next date this weekly class actually runs (today if it has not started yet)
create or replace function public._tt_next(p_day text, p_time text) returns date
language plpgsql stable set search_path = public, pg_temp as $$
declare now_l timestamp := now() at time zone 'Europe/London';
  today date := (now() at time zone 'Europe/London')::date;
  target integer := array_position(array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], p_day);
  d date;
begin
  if target is null then return null; end if;
  d := today + ((target - extract(isodow from today)::integer + 7) % 7);
  if d = today and p_time <= to_char(now_l, 'HH24:MI') then d := d + 7; end if;
  return d;
end $$;

create or replace function public._tt_ever(p_id bigint) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.class_bookings where class_id = p_id)
      or exists (select 1 from public.wix_other_bookings where class_id = p_id)
      or exists (select 1 from public.waitlist where class_id = p_id)
$$;

-- 1. read everything the editor needs (all staff may look)
create or replace function public.admin_timetable_edit() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
  today date := (now() at time zone 'Europe/London')::date;
begin
  return jsonb_build_object('mode', public._tt_mode(), 'role', r, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'day', c.day_name, 'time', c.start_time, 'name', c.name, 'coach', c.coach, 'info', c.info, 'kind', c.kind,
      'capacity', c.capacity, 'active', c.active, 'source', c.source,
      'booked_ahead', public._tt_future(c.id),
      'next_date', n.d, 'booked_next', public._tt_booked_on(c.id, n.d),
      'ever', public._tt_ever(c.id),
      'avg', round(((select count(*) from public.class_bookings b where b.class_id = c.id and b.date::date between today - 27 and today)
                  + (select count(*) from public.wix_other_bookings w where w.class_id = c.id and w.date::date between today - 27 and today))::numeric / 4, 1))
      order by array_position(array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], c.day_name), c.start_time, c.name)
    from public.classes c cross join lateral (select public._tt_next(c.day_name, c.start_time) as d) n), '[]'::jsonb));
end $$;

-- 2. add or edit one class or gym hour. p: { id?, day_name, start_time, name, coach, info, capacity, kind, active? }
create or replace function public.admin_class_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
  v_days text[] := array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  v_id bigint := nullif(p->>'id', '')::bigint;
  v_day text := trim(coalesce(p->>'day_name', ''));
  v_time text := trim(coalesce(p->>'start_time', ''));
  v_kind text := coalesce(nullif(trim(p->>'kind'), ''), 'class');
  v_name text := trim(coalesce(p->>'name', ''));
  v_coach text := trim(coalesce(p->>'coach', ''));
  v_info text := trim(coalesce(p->>'info', ''));
  v_cap integer;
  v_active boolean := coalesce((p->>'active')::boolean, true);
  v_mode text := public._tt_mode();
  v_created boolean := false;
  old_row public.classes;
begin
  if not (v_day = any (v_days)) then raise exception 'Choose a day.' using errcode = '22023'; end if;
  if v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_time < '05:00' then raise exception 'Choose a start time between 05:00 and 23:59.' using errcode = '22023'; end if;
  if v_kind not in ('class', 'gym') then raise exception 'The type must be class or gym hour.' using errcode = '22023'; end if;
  if coalesce(p->>'capacity', '') !~ '^[0-9]{1,3}$' or (p->>'capacity')::integer > 100 then raise exception 'Capacity must be a whole number from 0 to 100.' using errcode = '22023'; end if;
  v_cap := (p->>'capacity')::integer;
  if v_kind = 'gym' then v_name := 'Open Gym'; v_info := ''; end if;
  if length(v_name) < 1 or length(v_name) > 60 then raise exception 'Give the class a name (up to 60 characters).' using errcode = '22023'; end if;
  if length(v_coach) > 60 or length(v_info) > 60 then raise exception 'Coach and length must be 60 characters or fewer.' using errcode = '22023'; end if;

  if v_id is not null then
    select * into old_row from public.classes where id = v_id;
    if not found then raise exception 'That class no longer exists. Refresh the page.' using errcode = '22023'; end if;
    if old_row.kind <> v_kind then raise exception 'The type of an existing class cannot be changed.' using errcode = '22023'; end if;
  end if;

  if v_active and exists (select 1 from public.classes c where c.active and c.id is distinct from v_id and c.kind = v_kind and c.day_name = v_day
       and c.start_time = v_time and (v_kind = 'gym' or lower(c.name) = lower(v_name))) then
    raise exception 'There is already one at that day and time.' using errcode = '23505';
  end if;

  if v_id is null then
    insert into public.classes (day_name, start_time, name, coach, info, capacity, active, sort, kind, source)
    values (v_day, v_time, v_name, v_coach, v_info, v_cap, v_active,
            case when v_kind = 'gym' then 100 + substring(v_time, 1, 2)::integer else substring(v_time, 1, 2)::integer * 60 + substring(v_time, 4, 2)::integer end, v_kind, 'manual')
    returning id into v_id;
    v_created := true;
  else
    update public.classes set day_name = v_day, start_time = v_time, name = v_name, coach = v_coach, info = v_info, capacity = v_cap, active = v_active,
      sort = case when v_kind = 'gym' then 100 + substring(v_time, 1, 2)::integer else substring(v_time, 1, 2)::integer * 60 + substring(v_time, 4, 2)::integer end
    where id = v_id;
  end if;

  insert into public.staff_access_log (user_id, action, target)
  values (auth.uid(), case when v_created then 'class_add' else 'class_edit' end, v_id::text || ': ' || v_day || ' ' || v_time || ' ' || v_name || ' (capacity ' || v_cap::text || ')');

  return jsonb_build_object('ok', true, 'id', v_id, 'created', v_created,
    'sync_will_revert', (v_mode = 'wix' and not v_created and old_row.source = 'wix'
      and (old_row.day_name, old_row.start_time, old_row.name, old_row.info, old_row.capacity, old_row.active) is distinct from (v_day, v_time, v_name, v_info, v_cap, v_active)),
    'booked_next', public._tt_booked_on(v_id, public._tt_next(v_day, v_time)));
end $$;

-- 3. switch one on or off. Switching off with people booked ahead needs p_force = true (the page asks first).
create or replace function public.admin_class_set_active(p_id bigint, p_on boolean, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
  c public.classes;
  n integer;
  v_mode text := public._tt_mode();
begin
  select * into c from public.classes where id = p_id;
  if not found then raise exception 'That class no longer exists. Refresh the page.' using errcode = '22023'; end if;
  if p_on then
    if exists (select 1 from public.classes x where x.active and x.id <> c.id and x.kind = c.kind and x.day_name = c.day_name and x.start_time = c.start_time
         and (c.kind = 'gym' or lower(x.name) = lower(c.name))) then
      raise exception 'There is already one at that day and time.' using errcode = '23505';
    end if;
    update public.classes set active = true where id = p_id;
    insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'class_on', p_id::text || ': ' || c.day_name || ' ' || c.start_time || ' ' || c.name);
    return jsonb_build_object('ok', true, 'active', true, 'sync_will_revert', v_mode = 'wix' and c.source = 'wix');
  end if;
  n := public._tt_future(p_id);
  if n > 0 and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'needs_force', true, 'booked_ahead', n);
  end if;
  update public.classes set active = false where id = p_id;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'class_off', p_id::text || ': ' || c.day_name || ' ' || c.start_time || ' ' || c.name);
  return jsonb_build_object('ok', true, 'active', false, 'booked_ahead', n, 'sync_will_revert', v_mode = 'wix' and c.source = 'wix');
end $$;

-- 4. remove. A class that was never booked is deleted; anything else is only switched off, so booking history is never lost.
create or replace function public.admin_class_remove(p_id bigint, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
  c public.classes;
  n integer;
  gone integer;
  v_mode text := public._tt_mode();
begin
  select * into c from public.classes where id = p_id;
  if not found then raise exception 'That class no longer exists. Refresh the page.' using errcode = '22023'; end if;
  n := public._tt_future(p_id);
  if n > 0 and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'needs_force', true, 'booked_ahead', n);
  end if;
  with d as (
    delete from public.classes x where x.id = p_id
      and not exists (select 1 from public.class_bookings b where b.class_id = x.id)
      and not exists (select 1 from public.wix_other_bookings w where w.class_id = x.id)
      and not exists (select 1 from public.waitlist q where q.class_id = x.id)
    returning 1)
  select count(*) into gone from d;
  if gone > 0 then
    insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'class_remove', p_id::text || ': ' || c.day_name || ' ' || c.start_time || ' ' || c.name);
    return jsonb_build_object('ok', true, 'deleted', true, 'sync_will_revert', v_mode = 'wix' and c.source = 'wix');
  end if;
  update public.classes set active = false where id = p_id;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'class_off', p_id::text || ': ' || c.day_name || ' ' || c.start_time || ' ' || c.name || ' (removed, has booking history)');
  return jsonb_build_object('ok', true, 'deleted', false, 'deactivated', true, 'booked_ahead', n, 'sync_will_revert', v_mode = 'wix' and c.source = 'wix');
end $$;

-- 5. who controls the timetable
create or replace function public.admin_timetable_control_get() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  return jsonb_build_object('mode', public._tt_mode());
end $$;

-- owner only. 'backoffice' turns the Wix sync off and turns every active Wix row into a manual row so the edits stay.
create or replace function public.admin_timetable_control_set(p_mode text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
  n integer := 0;
begin
  if p_mode not in ('wix', 'backoffice') then raise exception 'The mode must be wix or backoffice.' using errcode = '22023'; end if;
  if p_mode = 'backoffice' then
    insert into public.app_flags (key, mode, test_emails) values ('timetable_backoffice', 'on', '{}') on conflict (key) do update set mode = 'on';
    with u as (update public.classes set source = 'manual' where source = 'wix' and active returning 1) select count(*) into n from u;
  else
    insert into public.app_flags (key, mode, test_emails) values ('timetable_backoffice', 'off', '{}') on conflict (key) do update set mode = 'off';
  end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'timetable_control', p_mode || ' (' || n::text || ' rows now manual)');
  return jsonb_build_object('ok', true, 'mode', p_mode, 'converted', n);
end $$;

-- permissions: only signed-in users may call the admin ones (each checks the role itself); helpers are internal
do $$ declare f text; begin
  foreach f in array array['admin_timetable_edit()', 'admin_class_save(jsonb)', 'admin_class_set_active(bigint,boolean,boolean)', 'admin_class_remove(bigint,boolean)',
    'admin_timetable_control_get()', 'admin_timetable_control_set(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_tt_mode()', '_tt_future(bigint)', '_tt_booked_on(bigint,date)', '_tt_next(text,text)', '_tt_ever(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
