-- ============================================================
-- MY GYM London — "Book the gym" (open gym hourly slots)
-- NOT RUN YET. Run once in: Supabase Dashboard -> SQL Editor.
-- Safe to re-run: the column is added only if missing and the slots
-- are only inserted if no gym slots exist yet.
--
-- How it works: gym hours are stored as rows in public.classes with
-- kind = 'gym' (one row per hour per weekday). Members book them with
-- the same class_bookings table, so the existing security rules still
-- apply: capacity is enforced by the server, no double-booking, no past
-- dates, the right weekday only, members see only their own bookings.
--
-- The app hides the "Book the gym" switch until gym rows exist, so
-- deploying the app before running this changes nothing for members.
-- ============================================================

alter table public.classes add column if not exists kind text not null default 'class';
alter table public.classes drop constraint if exists classes_kind_check;
alter table public.classes add constraint classes_kind_check check (kind in ('class', 'gym'));

-- hourly slots matching the opening hours:
--   Mon-Fri 07:00-21:00 (last slot starts 20:00)
--   Saturday 07:00-17:00 (last slot starts 16:00)
--   Sunday   07:00-16:00 (last slot starts 15:00)
-- capacity 6 per hour (same as the website). Change the 6 below to adjust.
insert into public.classes (day_name, start_time, name, coach, info, capacity, sort, kind)
select d.day_name, to_char(make_time(h, 0, 0), 'HH24:MI'), 'Open Gym', '', '', 6, 100 + h, 'gym'
from (values
  ('Monday', 7, 20), ('Tuesday', 7, 20), ('Wednesday', 7, 20), ('Thursday', 7, 20), ('Friday', 7, 20),
  ('Saturday', 7, 16), ('Sunday', 7, 15)
) as d(day_name, first_h, last_h)
cross join lateral generate_series(d.first_h, d.last_h) as h
where not exists (select 1 from public.classes where kind = 'gym');
