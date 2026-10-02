-- MY GYM London: security hardening (2026-10-03). Idempotent; safe to re-run.

-- ============ #3 members see only their own bookings; counts via function ============
drop policy if exists bookings_select on public.class_bookings;
drop policy if exists bookings_select_own on public.class_bookings;
create policy bookings_select_own on public.class_bookings for select
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.booking_counts(dates text[])
returns table (class_id bigint, date text, n int)
language sql security definer set search_path = public stable as $$
  select b.class_id, b.date, count(*)::int
  from public.class_bookings b
  where b.date = any(dates)
  group by b.class_id, b.date;
$$;
revoke all on function public.booking_counts(text[]) from public, anon;
grant execute on function public.booking_counts(text[]) to authenticated;

-- ============ #2 server-side booking rules (capacity, real date, right weekday) ============
create or replace function public.enforce_booking_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.classes%rowtype;
  d date;
  today date := (now() at time zone 'Europe/London')::date;
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

  select count(*) into taken from public.class_bookings where class_id = new.class_id and date = new.date;
  if taken >= c.capacity then raise exception 'This class is full' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists booking_rules on public.class_bookings;
create trigger booking_rules before insert on public.class_bookings
  for each row execute function public.enforce_booking_rules();

-- ============ #5 member templates are private; only admins can publish ============
alter table public.workout_templates alter column is_public set default false;
drop policy if exists templates_insert on public.workout_templates;
create policy templates_insert on public.workout_templates for insert
  with check (created_by = auth.uid() and (is_public = false or public.is_admin()));

-- ============ #7 size / format limits on saved data (new and edited rows) ============
alter table public.class_bookings drop constraint if exists chk_bk_date;
alter table public.class_bookings add constraint chk_bk_date check (date ~ '^\d{4}-\d{2}-\d{2}$') not valid;

alter table public.weight_logs drop constraint if exists chk_wl;
alter table public.weight_logs add constraint chk_wl check (
  date ~ '^\d{4}-\d{2}-\d{2}$'
  and (kg is null or kg between 20 and 500)
  and (body_fat_pct is null or body_fat_pct between 1 and 80)) not valid;

alter table public.workout_logs drop constraint if exists chk_wo;
alter table public.workout_logs add constraint chk_wo check (
  date ~ '^\d{4}-\d{2}-\d{2}$'
  and char_length(coalesce(title, '')) <= 100
  and char_length(coalesce(exercise, '')) <= 100
  and (sets is null or sets between 0 and 100)
  and char_length(coalesce(reps, '')) <= 30
  and (weight_kg is null or weight_kg between 0 and 1000)
  and char_length(coalesce(notes, '')) <= 1000
  and (exercises is null or (jsonb_typeof(exercises) = 'array'
       and jsonb_array_length(exercises) <= 50
       and pg_column_size(exercises) <= 20000))) not valid;

alter table public.workout_templates drop constraint if exists chk_tpl;
alter table public.workout_templates add constraint chk_tpl check (
  char_length(name) <= 100
  and char_length(coalesce(description, '')) <= 500
  and char_length(coalesce(goal, '')) <= 100
  and char_length(coalesce(level, '')) <= 50
  and jsonb_typeof(exercises) = 'array'
  and jsonb_array_length(exercises) <= 50
  and pg_column_size(exercises) <= 20000) not valid;

alter table public.profiles drop constraint if exists chk_prof;
alter table public.profiles add constraint chk_prof check (
  char_length(coalesce(full_name, '')) <= 100
  and char_length(coalesce(phone, '')) <= 30
  and char_length(coalesce(goal, '')) <= 100
  and (weight_kg is null or weight_kg between 20 and 500)) not valid;

-- ============ #4 signup attempt log (used by the member-signup function for rate limiting) ============
create table if not exists public.signup_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  email_hash text not null,
  at timestamptz not null default now()
);
create index if not exists signup_attempts_ip_at on public.signup_attempts (ip, at);
create index if not exists signup_attempts_email_at on public.signup_attempts (email_hash, at);
alter table public.signup_attempts enable row level security;   -- no policies: only the server (service role) can use it
