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

-- ============================================================
-- GYM ACCESS: only members on a "Gym & Exercise Class" plan can book gym hours
-- The list of allowed Wix plans lives in the table below, so you can add or
-- remove a plan later without touching any code.
-- ============================================================

create table if not exists public.gym_access_plans (
  plan_id text primary key,            -- Wix Pricing Plans plan id
  name text not null
);
alter table public.gym_access_plans enable row level security;   -- no policies: only the server can read or change it

insert into public.gym_access_plans (plan_id, name) values
  ('fc8df227-f234-4b82-a6c2-2e674a369305', 'Gym & Exercise Class Membership (2026)'),
  ('8f33a3ff-f531-4a05-b007-d5a98143003f', 'Gym & Exercise Class Membership (Annual)'),
  ('e38b0fa1-6129-47ca-9503-64e4901b4e3b', 'Gym & Exercise Class Membership (Black Friday)')
on conflict (plan_id) do nothing;

-- one row per member, written ONLY by the check-gym-access function (service role)
create table if not exists public.member_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gym_access boolean not null default false,
  checked_at timestamptz not null default now()
);
alter table public.member_access enable row level security;
drop policy if exists member_access_select_own on public.member_access;
create policy member_access_select_own on public.member_access for select using (user_id = auth.uid());
-- (no insert/update/delete policy on purpose: members can never grant themselves access)

-- booking rules: the existing checks plus the gym rules
--   * gym hours need a recent (24h) positive plan check, or an admin
--   * an hour that has already started today can't be booked
create or replace function public.enforce_booking_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.classes%rowtype;
  d date;
  today date := (now() at time zone 'Europe/London')::date;
  now_hm text := to_char(now() at time zone 'Europe/London', 'HH24:MI');
  taken int;
begin
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

  if c.kind = 'gym' then
    if d = today and c.start_time <= now_hm then
      raise exception 'That hour has already started' using errcode = 'P0001';
    end if;
    if not public.is_admin() and not exists (
      select 1 from public.member_access m
      where m.user_id = new.user_id and m.gym_access and m.checked_at > now() - interval '24 hours'
    ) then
      raise exception 'Gym booking is for Gym & Exercise Class members' using errcode = 'P0001';
    end if;
  end if;

  select count(*) into taken from public.class_bookings where class_id = new.class_id and date = new.date;
  if taken >= c.capacity then raise exception 'This class is full' using errcode = 'P0001'; end if;
  return new;
end $$;
