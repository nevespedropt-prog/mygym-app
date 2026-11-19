-- MY GYM London: member waitlist and "bring a friend" link. Written 2026-11-19.
-- Both are built but only switched on for the owner's own account while we test: the switches app_flags 'member_waitlist' and 'friend_pass' are in TEST mode
-- (only the listed test emails see the feature in the app). Set mode = 'on' at the move to show them to every member.
-- The "a space has opened" email is a one-off service email (notice layout) and follows the same switch.
-- To stop: update public.app_flags set mode = 'off' where key in ('member_waitlist', 'friend_pass');

insert into public.app_flags (key, mode, test_emails) values ('member_waitlist', 'test', array['nevespedro.pt@gmail.com']), ('friend_pass', 'test', array['nevespedro.pt@gmail.com']) on conflict (key) do nothing;

create or replace function public._flag_on(p_key text, p_email text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select f.mode = 'on' or (f.mode = 'test' and lower(coalesce(p_email, '')) = any (select lower(x) from unnest(coalesce(f.test_emails, '{}'::text[])) x)) from public.app_flags f where f.key = p_key), false);
$$;
revoke all on function public._flag_on(text, text) from public, anon, authenticated;

-- ---------- friend link ----------
alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code) where referral_code is not null;
create or replace function public._my_ref_code(p_uid uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text; i int := 0; chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select referral_code into c from public.profiles where id = p_uid;
  if c is not null then return c; end if;
  loop
    c := ''; for k in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    begin update public.profiles set referral_code = c where id = p_uid and referral_code is null; exit when found; exception when unique_violation then null; end;
    i := i + 1; exit when i > 20;
  end loop;
  select referral_code into c from public.profiles where id = p_uid; return c;
end $$;
revoke all on function public._my_ref_code(uuid) from public, anon, authenticated;

-- what this member may see (the app asks once after sign-in)
create or replace function public.my_features() returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); em text; fp boolean;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into em from auth.users where id = uid;
  fp := public._flag_on('friend_pass', em);
  return jsonb_build_object('waitlist', public._flag_on('member_waitlist', em), 'friend_pass', fp, 'referral_code', case when fp then public._my_ref_code(uid) end);
end $$;
revoke all on function public.my_features() from public, anon;
grant execute on function public.my_features() to authenticated;

-- the back office shows who referred an enquiry
create or replace function public.admin_referrers(p_codes text[]) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  return coalesce((select jsonb_object_agg(p.referral_code, coalesce(nullif(btrim(p.full_name), ''), 'a member')) from public.profiles p where p.referral_code = any (p_codes)), '{}'::jsonb);
end $$;
revoke all on function public.admin_referrers(text[]) from public, anon;
grant execute on function public.admin_referrers(text[]) to authenticated;

-- ---------- waitlist ----------
create table if not exists public.class_waitlist (
  id uuid primary key default gen_random_uuid(),
  class_id bigint not null references public.classes(id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), notified_at timestamptz,
  unique (class_id, date, user_id)
);
alter table public.class_waitlist enable row level security;
revoke all on public.class_waitlist from anon, authenticated;

create or replace function public.waitlist_join(p_class bigint, p_date text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); em text; c public.classes%rowtype; pos int; today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD');
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into em from auth.users where id = uid;
  if not public._flag_on('member_waitlist', em) then raise exception 'The waiting list is not open yet.'; end if;
  select * into c from public.classes where id = p_class and active;
  if not found then raise exception 'That class is not available.'; end if;
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' or p_date < today then raise exception 'That date has passed.'; end if;
  if exists (select 1 from public.class_bookings where class_id = p_class and date = p_date and user_id = uid) then raise exception 'You are already booked into this class.'; end if;
  insert into public.class_waitlist (class_id, date, user_id) values (p_class, p_date, uid) on conflict (class_id, date, user_id) do nothing;
  select count(*) into pos from public.class_waitlist w where w.class_id = p_class and w.date = p_date and w.created_at <= (select created_at from public.class_waitlist where class_id = p_class and date = p_date and user_id = uid);
  return jsonb_build_object('ok', true, 'position', pos);
end $$;
revoke all on function public.waitlist_join(bigint, text) from public, anon;
grant execute on function public.waitlist_join(bigint, text) to authenticated;

create or replace function public.waitlist_leave(p_class bigint, p_date text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  delete from public.class_waitlist where class_id = p_class and date = p_date and user_id = auth.uid();
end $$;
revoke all on function public.waitlist_leave(bigint, text) from public, anon;
grant execute on function public.waitlist_leave(bigint, text) to authenticated;

create or replace function public.my_waitlist() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD');
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('class_id', w.class_id, 'date', w.date, 'name', c.name, 'start_time', c.start_time, 'notified', w.notified_at is not null,
      'position', (select count(*) from public.class_waitlist x where x.class_id = w.class_id and x.date = w.date and x.created_at <= w.created_at)) order by w.date, c.start_time)
    from public.class_waitlist w join public.classes c on c.id = w.class_id where w.user_id = auth.uid() and w.date >= today), '[]'::jsonb);
end $$;
revoke all on function public.my_waitlist() from public, anon;
grant execute on function public.my_waitlist() to authenticated;

-- when a booking is cancelled, tell the first person waiting (they still have to book it: first come, first served)
create or replace function public._waitlist_notify() returns trigger
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare w record; c public.classes%rowtype; em text; fn text; m text; t text[]; today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD');
begin
  if old.date < today then return old; end if;
  select * into w from public.class_waitlist where class_id = old.class_id and date = old.date and notified_at is null order by created_at limit 1;
  if not found then return old; end if;
  select lower(u.email), coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'there') into em, fn from auth.users u left join public.profiles p on p.id = u.id where u.id = w.user_id;
  select * into c from public.classes where id = old.class_id;
  update public.class_waitlist set notified_at = now() where id = w.id;
  if em is null or not public._flag_on('member_waitlist', em) then return old; end if;
  perform public.queue_email('notice', w.user_id, em, jsonb_build_object('first_name', fn, 'campaign_subject', 'A space opened: ' || c.name || ' on ' || to_char(old.date::date, 'FMDay FMDD FMMonth'), 'campaign_preheader', 'It goes to the first person to book.',
    'campaign_title', 'A space has opened up', 'campaign_body', 'Good news: a space has just opened in ' || c.name || ' on ' || to_char(old.date::date, 'FMDay FMDD FMMonth') || ' at ' || left(c.start_time, 5) || '.' || E'\n\nSpaces go to the first person to book, so open the app now to take it. If you no longer need it, you can ignore this email.',
    'campaign_button', 'Book now', 'campaign_url', 'https://app.mygymlondon.co.uk/#timetable'), 'waitlist:' || w.id::text);
  return old;
exception when others then
  return old;
end $$;
drop trigger if exists class_bookings_waitlist on public.class_bookings;
create trigger class_bookings_waitlist after delete on public.class_bookings for each row execute function public._waitlist_notify();

-- keep the list tidy: when someone books the class themselves, they leave its waiting list
create or replace function public._waitlist_clear_on_book() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.class_waitlist where class_id = new.class_id and date = new.date and user_id = new.user_id;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists class_bookings_waitlist_clear on public.class_bookings;
create trigger class_bookings_waitlist_clear after insert on public.class_bookings for each row execute function public._waitlist_clear_on_book();
notify pgrst, 'reload schema';
