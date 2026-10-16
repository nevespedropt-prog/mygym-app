-- ============================================================
-- MY GYM London: count EVERY booking in the app, including website bookings by people with no app account
-- APPLIED 2026-10-16 in the Supabase SQL editor (Success. No rows returned).
-- Safe to run more than once. It adds one table and replaces two functions. It deletes nothing.
--
-- 1. public.wix_other_bookings: anonymous rows for confirmed Wix bookings whose booker is not an app member
--    (class, date and the Wix booking id only: NO name, NO email). Only the server can read or write it.
-- 2. booking_counts(): the spaces-left count now adds those rows to the app's own bookings.
-- 3. enforce_booking_rules(): the "class is full" check counts them too, so a member cannot take a space that is
--    already gone. Also: rows inserted by the server for Wix bookings skip the checks (Wix already decided), and a
--    member can never mark their own booking as a Wix one (source and wix_booking_id are forced for member inserts).
-- To undo:  re-run migration-gym.sql's enforce_booking_rules and migration-security-hardening.sql's booking_counts,
--           then: drop table if exists public.wix_other_bookings;
-- ============================================================
create table if not exists public.wix_other_bookings (
  wix_booking_id text primary key,
  class_id bigint not null references public.classes(id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at timestamptz not null default now()
);
create index if not exists wix_other_bookings_class_date on public.wix_other_bookings (class_id, date);
alter table public.wix_other_bookings enable row level security;   -- no policies: only the server can use it
revoke all on public.wix_other_bookings from anon, authenticated;

create or replace function public.booking_counts(dates text[])
returns table (class_id bigint, date text, n int)
language sql security definer set search_path = public stable as $$
  select t.class_id, t.date, sum(t.n)::int
  from (
    select b.class_id, b.date, count(*)::int as n
    from public.class_bookings b
    where b.date = any(dates)
    group by b.class_id, b.date
    union all
    select o.class_id, o.date, count(*)::int
    from public.wix_other_bookings o
    where o.date = any(dates)
    group by o.class_id, o.date
  ) t
  group by t.class_id, t.date;
$$;
revoke all on function public.booking_counts(text[]) from public, anon;
grant execute on function public.booking_counts(text[]) to authenticated;

create or replace function public.enforce_booking_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.classes%rowtype;
  d date;
  today date := (now() at time zone 'Europe/London')::date;
  now_hm text := to_char(now() at time zone 'Europe/London', 'HH24:MI');
  taken int;
begin
  -- the server (no signed-in member) mirroring a booking Wix already accepted: no checks, Wix is the boss
  if auth.uid() is null and new.source = 'wix' then
    return new;
  end if;
  -- a signed-in member can never mark their own booking as a Wix one
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

  select (select count(*) from public.class_bookings where class_id = new.class_id and date = new.date)
       + (select count(*) from public.wix_other_bookings where class_id = new.class_id and date = new.date)
    into taken;
  if taken >= c.capacity then raise exception 'This class is full' using errcode = 'P0001'; end if;
  return new;
end $$;
