-- MY GYM London: admin back end part 2 (weekly timetable and analytics). Written and APPLIED to the live database on 2026-10-28 (migration admin_backend_timetable_analytics).
-- Needs migration-admin-backend.sql first. Read-only functions; each checks the caller's role (timetable: all staff; analytics: admin and manager).

create or replace function public.admin_timetable() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
  today date := (now() at time zone 'Europe/London')::date;
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'day', c.day_name, 'time', c.start_time, 'name', c.name, 'coach', c.coach, 'kind', c.kind, 'capacity', c.capacity, 'active', c.active, 'source', c.source, 'info', c.info,
      'avg', round(((select count(*) from public.class_bookings b where b.class_id = c.id and b.date::date between today - 27 and today)
                  + (select count(*) from public.wix_other_bookings w where w.class_id = c.id and w.date::date between today - 27 and today))::numeric / 4, 1)) order by c.sort, c.start_time)
    from public.classes c), '[]'::jsonb);
end $$;

create or replace function public.admin_analytics() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
  today date := (now() at time zone 'Europe/London')::date;
  mon date := (now() at time zone 'Europe/London')::date - ((extract(isodow from (now() at time zone 'Europe/London')::date)::int) - 1);
begin
  return jsonb_build_object(
    'weekly', (select jsonb_agg(jsonb_build_object('week', w::date,
        'bookings', (select count(*) from public.class_bookings b where b.date::date >= w::date and b.date::date < w::date + 7) + (select count(*) from public.wix_other_bookings x where x.date::date >= w::date and x.date::date < w::date + 7),
        'signups', (select count(*) from auth.users u where (u.created_at at time zone 'Europe/London')::date >= w::date and (u.created_at at time zone 'Europe/London')::date < w::date + 7)) order by w)
      from generate_series(mon - 77, mon, interval '7 days') w),
    'by_weekday', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'n', n)) from (select c.day_name d, count(*) n from public.class_bookings b join public.classes c on c.id = b.class_id where b.date::date between today - 90 and today group by c.day_name) q), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(jsonb_build_object('hour', hh, 'n', n) order by hh) from (select left(c.start_time, 2) hh, count(*) n from public.class_bookings b join public.classes c on c.id = b.class_id where b.date::date between today - 90 and today group by left(c.start_time, 2)) q), '[]'::jsonb),
    'top_classes_90d', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc) from (select c.name, count(*) n from public.class_bookings b join public.classes c on c.id = b.class_id where c.kind = 'class' and b.date::date between today - 90 and today group by c.name order by count(*) desc limit 8) q), '[]'::jsonb),
    'members_booked_30d', (select count(distinct user_id) from public.class_bookings where date::date between today - 30 and today),
    'members_repeat_30d', (select count(*) from (select user_id from public.class_bookings where date::date between today - 30 and today group by user_id having count(*) >= 2) q),
    'bookings_by_source_90d', coalesce((select jsonb_agg(jsonb_build_object('source', s, 'n', n)) from (select coalesce(source, 'app') s, count(*) n from public.class_bookings where date::date between today - 90 and today group by 1) q), '[]'::jsonb));
end $$;

revoke all on function public.admin_timetable() from public, anon;
revoke all on function public.admin_analytics() from public, anon;
grant execute on function public.admin_timetable() to authenticated;
grant execute on function public.admin_analytics() to authenticated;
