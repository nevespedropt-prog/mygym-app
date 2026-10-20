-- MY GYM London: a class or gym hour that has already started (London time) can't be booked (written 2026-10-20). NOT APPLIED YET.
-- Before this, only gym hours were checked; classes could still be booked after they started if someone bypassed the app.
-- Run in the Supabase SQL editor (paste the statement only, without these comment lines). Safe to run more than once.
-- It replaces the body of enforce_booking_rules(); permissions on the function stay as they are.
-- To undo: re-run the previous version (the same statement without the "has already started" block for classes).

create or replace function public.enforce_booking_rules() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
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

  -- a class or gym hour that has already started (London time) can't be booked
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
end $function$;
