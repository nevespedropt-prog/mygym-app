-- MY GYM London: classes are booked with a class membership, or with a class credit (written 2026-11-20).
-- DORMANT: nothing changes until the switch app_flags 'class_plan_check' is set to 'on' (off = today's behaviour, test = owner's account only).
-- Rules when ON, for a member booking a class (the Open Gym keeps its own gym-access rule; Kids Gym is not affected; staff are not affected):
--   1. A member with an active membership that includes classes books freely. Credits are never touched and never shown to them.
--   2. Everyone else (pay as you go) needs a class credit. Booking spends one automatically.
--   3. Cancelling that booking before the class starts gives the credit back. If nobody has a credit: "Classes are for members...".
--   4. A no-show is not automatic: the owner grants the credit by hand in the back office (Members, open a member, Class credits).
-- Server side only: the booking trigger, so no app or website can get around it.
insert into public.app_flags (key, mode, test_emails) values ('class_plan_check', 'off', array['nevespedro.pt@gmail.com']) on conflict (key) do nothing;

alter table public.class_bookings add column if not exists credit_id uuid;

-- does this email hold an active membership that includes classes (Wix plan, or a member added by hand)?
create or replace function public._has_class_plan(p_email text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.wix_orders o where lower(o.email) = lower(coalesce(p_email, '')) and o.status = 'ACTIVE' and o.plan_name ~* 'class' and o.plan_name !~* 'payg|pay as you go')
      or exists (select 1 from public.manual_members m where lower(m.email) = lower(coalesce(p_email, '')) and m.plan_name ~* 'class' and m.plan_name !~* 'payg|pay as you go' and m.start_date <= current_date);
$$;
revoke all on function public._has_class_plan(text) from public, anon, authenticated;

create or replace function public.enforce_booking_rules() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  c public.classes%rowtype;
  d date;
  today date := (now() at time zone 'Europe/London')::date;
  now_hm text := to_char(now() at time zone 'Europe/London', 'HH24:MI');
  taken int;
  em text;
  cid uuid;
begin
  if auth.uid() is null and new.source = 'wix' then
    return new;
  end if;
  if auth.uid() is not null then
    new.source := 'app';
    new.wix_booking_id := null;
    new.credit_id := null;          -- a member can never choose this themselves
  end if;

  if new.date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid date' using errcode = 'P0001';
  end if;
  begin d := new.date::date; exception when others then
    raise exception 'Invalid date' using errcode = 'P0001';
  end;
  if d < today then raise exception 'You can''t book a past class' using errcode = 'P0001'; end if;
  if d > today + 60 then raise exception 'You can only book up to 60 days ahead' using errcode = 'P0001'; end if;

  select * into c from public.classes where id = new.class_id and active for update;
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

  -- classes: a class membership, or one class credit (only when the switch is on)
  if auth.uid() is not null and c.kind = 'class' and c.name <> 'Kids Gym' and not public.is_admin() then
    select lower(u.email) into em from auth.users u where u.id = new.user_id;
    if public._flag_on('class_plan_check', em) and not public._has_class_plan(em) then
      cid := public.consume_class_credit(em, c.name || ' on ' || new.date, null);
      if cid is null then
        raise exception 'Classes are for members. Join a plan, or use a class credit if you have one. Paid as you go? Book on our website.' using errcode = 'P0001';
      end if;
      new.credit_id := cid;
    end if;
  end if;
  return new;
end $function$;

-- used by the booking function BEFORE it touches Wix, so a refused booking never appears in Wix at all
create or replace function public._class_booking_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not public._flag_on('class_plan_check', p_email) or public._has_class_plan(p_email)
      or exists (select 1 from public.class_credits c where c.email = lower(coalesce(p_email, '')) and c.status = 'available' and (c.expires_at is null or c.expires_at >= now()));
$$;
revoke all on function public._class_booking_allowed(text) from public, anon, authenticated;

-- cancelling (or the gym cancelling) a credit booking before the class starts gives the credit back
create or replace function public.refund_booking_credit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare st text;
begin
  if old.credit_id is not null and old.date ~ '^\d{4}-\d{2}-\d{2}$' then
    select start_time::text into st from public.classes where id = old.class_id;
    if old.date::date > (now() at time zone 'Europe/London')::date
       or (old.date::date = (now() at time zone 'Europe/London')::date and coalesce(st, '00:00') > to_char(now() at time zone 'Europe/London', 'HH24:MI')) then
      update public.class_credits set status = 'available', used_at = null, used_for = null, used_booking_ref = null where id = old.credit_id and status = 'used';
    end if;
  end if;
  return old;
end $$;
drop trigger if exists refund_booking_credit on public.class_bookings;
create trigger refund_booking_credit after delete on public.class_bookings for each row execute function public.refund_booking_credit();

-- the app reads the switch (so it can ask before spending a credit) and whether the member holds a class plan
create or replace function public.my_features() returns jsonb
language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare uid uuid := auth.uid(); em text; fp boolean;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into em from auth.users where id = uid;
  fp := public._flag_on('friend_pass', em);
  return jsonb_build_object('waitlist', public._flag_on('member_waitlist', em), 'friend_pass', fp, 'referral_code', case when fp then public._my_ref_code(uid) end,
    'class_plan_check', public._flag_on('class_plan_check', em), 'class_plan', public._has_class_plan(em));
end $function$;
notify pgrst, 'reload schema';
