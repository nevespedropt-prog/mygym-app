-- MY GYM London - migration: exercise library table
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run)
-- Signed-in members can read exercises. Add or edit rows in Table Editor (the dashboard bypasses row security).
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text not null,
  equipment text not null default 'Bodyweight',
  how_to text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;
drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises for select to authenticated using (true);

revoke all on public.exercises from anon, authenticated;
grant select on public.exercises to authenticated;

-- Equipment at the gym: 2 cable machines (one with a bar, one with pulleys), a Smith bar,
-- barbells, dumbbells, kettlebells and a pull-up bar. No other machines.
insert into public.exercises (name, muscle_group, equipment, how_to, sort) values
('Barbell back squat', 'Legs', 'Barbell', 'Bar on upper back, brace, sit down between the hips, drive up through mid-foot.', 1),
('Goblet squat', 'Legs', 'Kettlebell', 'Hold a kettlebell at the chest, elbows inside the knees, squat to depth with an upright torso.', 2),
('Smith squat', 'Legs', 'Smith bar', 'Feet slightly forward of the bar, brace, sit down between the hips and drive up through mid-foot.', 3),
('Smith split squat', 'Legs', 'Smith bar', 'Back foot on a bench or the floor, lower the back knee towards the floor, push through the front heel.', 4),
('Romanian deadlift', 'Legs', 'Barbell', 'Soft knees, push hips back with a flat back until the hamstrings stretch, then stand tall.', 5),
('Walking lunge', 'Legs', 'Dumbbell', 'Long step, back knee towards the floor, push through the front heel into the next step.', 6),
('Calf raise', 'Legs', 'Dumbbell', 'Hold dumbbells, rise onto the balls of the feet, pause at the top, lower slowly.', 7),
('Hip thrust', 'Glutes', 'Barbell', 'Upper back on a bench, bar over hips, drive hips up and squeeze at the top.', 8),
('Smith hip thrust', 'Glutes', 'Smith bar', 'Upper back on a bench, bar across the hips, drive up and squeeze the glutes at the top.', 9),
('Cable pull-through', 'Glutes', 'Cable', 'Face away from a low pulley, rope between the legs, hinge back and snap the hips forward.', 10),
('Glute bridge', 'Glutes', 'Bodyweight', 'Lie on your back, feet flat, lift hips until shoulders, hips and knees line up.', 11),
('Conventional deadlift', 'Back', 'Barbell', 'Bar over mid-foot, flat back, push the floor away and stand up with the bar close to the legs.', 12),
('Pull-up', 'Back', 'Pull-up bar', 'Hang with hands just wider than shoulders, pull the chest to the bar, lower under control.', 13),
('Lat pulldown', 'Back', 'Cable', 'Pull the bar to the upper chest, elbows down and back, control the way up.', 14),
('Bent-over row', 'Back', 'Barbell', 'Hinge to a flat back, pull the bar to the lower ribs, squeeze the shoulder blades.', 15),
('Seated cable row', 'Back', 'Cable', 'Sit tall, pull the handle to the stomach, keep shoulders down, pause, then return slowly.', 16),
('Single-arm cable row', 'Back', 'Cable', 'Stand or kneel facing a low or mid pulley, pull the handle to the hip, keep the torso still.', 17),
('Single-arm dumbbell row', 'Back', 'Dumbbell', 'Hand and knee on a bench, pull the dumbbell to the hip without twisting.', 18),
('Face pull', 'Shoulders', 'Cable', 'Rope at face height, pull towards the eyes with elbows high and hands apart.', 19),
('Bench press', 'Chest', 'Barbell', 'Shoulder blades tucked, lower the bar to the mid-chest, press up over the shoulders.', 20),
('Smith bench press', 'Chest', 'Smith bar', 'Bench under the bar, shoulder blades tucked, lower to the mid-chest and press up.', 21),
('Incline dumbbell press', 'Chest', 'Dumbbell', 'Bench at 30 degrees, lower to chest level, press up and slightly together.', 22),
('Push-up', 'Chest', 'Bodyweight', 'Hands under shoulders, body in a straight line, chest to the floor, push back up.', 23),
('Cable fly', 'Chest', 'Cable', 'Slight elbow bend, bring the handles together in a wide arc, stretch slowly on the way back.', 24),
('Overhead press', 'Shoulders', 'Barbell', 'Brace the core, press the bar straight overhead, head through at the top.', 25),
('Smith shoulder press', 'Shoulders', 'Smith bar', 'Seated bench under the bar, lower to chin height, press straight up without locking out hard.', 26),
('Lateral raise', 'Shoulders', 'Dumbbell', 'Lift dumbbells out to the sides to shoulder height, lead with the elbows, lower slowly.', 27),
('Cable lateral raise', 'Shoulders', 'Cable', 'Stand side-on to a low pulley, raise the handle out to shoulder height, lower under control.', 28),
('Biceps curl', 'Arms', 'Dumbbell', 'Elbows pinned to the sides, curl up, squeeze, lower for a count of three.', 29),
('Cable biceps curl', 'Arms', 'Cable', 'Low pulley with the bar or handle, elbows pinned, curl up and lower slowly.', 30),
('Hammer curl', 'Arms', 'Dumbbell', 'Palms facing in, curl without swinging, keep wrists neutral.', 31),
('Triceps pushdown', 'Arms', 'Cable', 'Elbows tight to the ribs, push the handle down until the arms are straight.', 32),
('Overhead triceps extension', 'Arms', 'Dumbbell', 'Hold one dumbbell overhead with both hands, lower behind the head, extend.', 33),
('Plank', 'Core', 'Bodyweight', 'Forearms down, body in a straight line, squeeze glutes and abs, breathe steadily.', 34),
('Dead bug', 'Core', 'Bodyweight', 'On your back, lower opposite arm and leg while the lower back stays flat to the floor.', 35),
('Hanging knee raise', 'Core', 'Pull-up bar', 'Hang from a bar, lift the knees to the chest without swinging, lower slowly.', 36),
('Cable crunch', 'Core', 'Cable', 'Kneel under a high pulley with the rope at the head, curl the ribs towards the hips, return slowly.', 37),
('Cable woodchop', 'Core', 'Cable', 'Pulley set high or low, rotate through the torso and pull the handle across the body with straight arms.', 38),
('Russian twist', 'Core', 'Dumbbell', 'Lean back slightly, feet raised or down, rotate the weight side to side.', 39),
('Kettlebell swing', 'Full body', 'Kettlebell', 'Hinge, snap the hips forward and float the bell to chest height, let it fall back between the legs.', 40),
('Farmer carry', 'Full body', 'Dumbbell', 'Hold heavy dumbbells at your sides, stand tall and walk with short, steady steps.', 41)
on conflict (name) do update set muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  how_to = excluded.how_to, sort = excluded.sort;
