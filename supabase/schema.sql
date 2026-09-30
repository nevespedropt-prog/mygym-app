-- ============================================================
-- MY GYM London — member app schema (Supabase / Postgres)
-- Paste this whole file into: Supabase Dashboard → SQL Editor → Run
-- Safe to re-run pieces; first run creates everything.
-- ============================================================

-- ---------- tables ----------
create table if not exists public.classes (
  id bigint generated always as identity primary key,
  day_name text not null,              -- 'Monday'..'Sunday'
  start_time text not null,            -- '07:00'
  name text not null,
  coach text default '',
  info text default '',
  capacity int not null default 8,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  phone text default '',
  weight_kg numeric,
  goal text default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  class_id bigint not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,                  -- 'YYYY-MM-DD'
  created_at timestamptz not null default now(),
  unique (class_id, user_id, date)     -- no double-booking the same slot
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  kg numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  title text default '',
  exercise text not null,
  sets int,
  reps text,
  weight_kg numeric,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text default 'All levels',
  goal text default '',
  description text default '',
  exercises jsonb not null default '[]',
  created_by uuid references auth.users(id) on delete set null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- row level security ----------
alter table public.classes          enable row level security;
alter table public.profiles         enable row level security;
alter table public.class_bookings   enable row level security;
alter table public.weight_logs      enable row level security;
alter table public.workout_logs     enable row level security;
alter table public.workout_templates enable row level security;

-- helper: is the current user an admin (gym owner/staff)?
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

-- classes: everyone can read the timetable (even logged out); only admins write
drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select using (true);
drop policy if exists classes_admin_write on public.classes;
create policy classes_admin_write on public.classes for all
  using (public.is_admin()) with check (public.is_admin());

-- profiles: own row only (admin flag can't be self-set — no insert policy for it beyond trigger)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- bookings: any signed-in member can see booking counts (needed for free spots),
-- but only insert/delete their own
drop policy if exists bookings_select on public.class_bookings;
create policy bookings_select on public.class_bookings for select
  using (auth.role() = 'authenticated');
drop policy if exists bookings_insert_own on public.class_bookings;
create policy bookings_insert_own on public.class_bookings for insert
  with check (user_id = auth.uid());
drop policy if exists bookings_delete_own on public.class_bookings;
create policy bookings_delete_own on public.class_bookings for delete
  using (user_id = auth.uid() or public.is_admin());

-- weight + workout logs: strictly private, own rows only
drop policy if exists weight_own on public.weight_logs;
create policy weight_own on public.weight_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists workouts_own on public.workout_logs;
create policy workouts_own on public.workout_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- templates: everyone signed in reads; anyone can create their own; public ones readable by all
drop policy if exists templates_read on public.workout_templates;
create policy templates_read on public.workout_templates for select
  using (is_public or created_by = auth.uid());
drop policy if exists templates_insert on public.workout_templates;
create policy templates_insert on public.workout_templates for insert
  with check (created_by = auth.uid());
drop policy if exists templates_delete on public.workout_templates;
create policy templates_delete on public.workout_templates for delete
  using (created_by = auth.uid() or public.is_admin());

-- ---------- seed: weekly timetable ----------
insert into public.classes (day_name, start_time, name, coach, info, capacity, sort) values
('Monday','07:00','Morning Blast','Team MY GYM','45 min full-body class',8,1),
('Monday','09:30','Over 50s Strength & Mobility','','gentle, friendly, effective',10,2),
('Monday','18:00','Circuit Training','','all levels',8,3),
('Monday','19:00','Small Group PT','','max 4 people',4,4),
('Tuesday','07:00','Sunrise HIIT','','30 min, coffee after',8,1),
('Tuesday','16:30','Kids Class','','ages 6-11, fun first',10,2),
('Tuesday','18:30','Gym + Classes Open Session','','coach on floor',12,3),
('Wednesday','07:00','Morning Blast','','45 min full-body class',8,1),
('Wednesday','09:30','Over 50s Circuit','','strength + balance',10,2),
('Wednesday','18:00','Boxing Fit','','no contact, all fitness levels',8,3),
('Wednesday','19:00','1-2-1 PT slots','','book at reception',1,4),
('Thursday','07:00','Sunrise HIIT','','30 min',8,1),
('Thursday','16:30','Kids Class','','ages 6-11',10,2),
('Thursday','18:30','Strength Basics','','perfect for beginners',8,3),
('Friday','07:00','Morning Blast','','45 min',8,1),
('Friday','09:30','Over 50s Class','','finish the week strong',10,2),
('Friday','17:30','Friday Finisher','','team workout, great vibes',12,3),
('Saturday','09:00','Weekend Warrior','','60 min mixed class',12,1),
('Saturday','10:30','Family Session','','bring the kids',12,2);

-- ---------- seed: workout templates ----------
insert into public.workout_templates (name, level, goal, description, exercises) values
('Beginner Full-Body','Beginner','General fitness','Your first month at MY GYM — everything guided, nothing intimidating.',
 '[{"name":"Treadmill warm-up walk","sets":1,"reps":"5 min","note":"easy pace"},{"name":"Goblet squat","sets":3,"reps":"10","note":"light kettlebell"},{"name":"Chest press machine","sets":3,"reps":"10","note":""},{"name":"Seated row","sets":3,"reps":"10","note":""},{"name":"Plank","sets":3,"reps":"20 sec","note":"knees down is fine"},{"name":"Stretch cool-down","sets":1,"reps":"5 min","note":""}]'),
('Over 50s Strength & Mobility','Over 50s','Strength + mobility','Bone strength, balance and mobility — kind to joints, big on benefits.',
 '[{"name":"Marching warm-up","sets":1,"reps":"3 min","note":""},{"name":"Sit-to-stand","sets":3,"reps":"8","note":"from a bench"},{"name":"Wall press-up","sets":3,"reps":"10","note":""},{"name":"Resistance band row","sets":3,"reps":"10","note":""},{"name":"Heel raises","sets":3,"reps":"12","note":"hold wall for balance"},{"name":"Chair yoga stretch","sets":1,"reps":"8 min","note":""}]'),
('Fat-Burn Circuit','All levels','Fat loss','40 sec work / 20 sec rest, 3 rounds. Bring water and a towel.',
 '[{"name":"Jumping jacks (or step jacks)","sets":3,"reps":"40 sec","note":""},{"name":"Kettlebell swing","sets":3,"reps":"40 sec","note":""},{"name":"Push-up (any incline)","sets":3,"reps":"40 sec","note":""},{"name":"Mountain climbers","sets":3,"reps":"40 sec","note":""},{"name":"Goblet squat","sets":3,"reps":"40 sec","note":""},{"name":"Bicycle crunch","sets":3,"reps":"40 sec","note":""}]'),
('Strength Builder (45 min)','Intermediate','Build muscle','Classic push/pull/legs essentials for members who want to get strong.',
 '[{"name":"Barbell squat or leg press","sets":4,"reps":"6-8","note":""},{"name":"Bench press or chest press","sets":4,"reps":"6-8","note":""},{"name":"Lat pulldown","sets":3,"reps":"8-10","note":""},{"name":"Romanian deadlift","sets":3,"reps":"8-10","note":""},{"name":"Shoulder press","sets":3,"reps":"8-10","note":""},{"name":"Farmer carry finisher","sets":3,"reps":"30 m","note":""}]'),
('Home Workout — No Equipment','All levels','Stay active anywhere','Travelling or stuck at home? 20 minutes, no kit needed.',
 '[{"name":"Bodyweight squat","sets":3,"reps":"15","note":""},{"name":"Push-up (wall/knee/full)","sets":3,"reps":"10","note":""},{"name":"Reverse lunge","sets":3,"reps":"10 each leg","note":""},{"name":"Superman hold","sets":3,"reps":"20 sec","note":""},{"name":"Glute bridge","sets":3,"reps":"15","note":""},{"name":"Dead bug","sets":3,"reps":"10 each side","note":""}]'),
('Kids Fun Fitness (ages 6-11)','Kids','Confidence + coordination','Games-based session — sneaky exercise, maximum giggles.',
 '[{"name":"Animal walk warm-up","sets":1,"reps":"3 min","note":"bear crawl, crab walk"},{"name":"Bean bag balance relay","sets":3,"reps":"1 min","note":""},{"name":"Star jumps challenge","sets":3,"reps":"10","note":""},{"name":"Obstacle course","sets":3,"reps":"1 lap","note":""},{"name":"Freeze dance cool-down","sets":1,"reps":"5 min","note":""}]');

-- ---------- make YOUR account admin (after you sign up in the app once) ----------
-- Run this once with your signup email to unlock class editing rights:
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'you@example.com');
