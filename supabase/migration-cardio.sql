-- MY GYM London - migration: cardio equipment (treadmill, exercise bike, rowing machine, air bike)
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run).
-- Adds cardio exercises to the library and puts them into the plans.

begin;

insert into public.exercises (name, muscle_group, equipment, how_to, sort) values
('Treadmill walk', 'Cardio', 'Treadmill', 'Walk at a brisk pace with a small incline, arms swinging naturally, stand tall and do not hold the rails.', 63),
('Treadmill incline walk', 'Cardio', 'Treadmill', 'Set a steep incline and a steady walking pace, keep the chest up and take full strides.', 64),
('Treadmill intervals', 'Cardio', 'Treadmill', 'Alternate 30 seconds of fast running with 60 seconds of easy walking, step off the sides if you need to stop.', 65),
('Exercise bike ride', 'Cardio', 'Exercise bike', 'Set the saddle at hip height, keep a smooth pace you can chat at, back straight and shoulders relaxed.', 66),
('Exercise bike intervals', 'Cardio', 'Exercise bike', 'Alternate 30 seconds of hard pedalling with 60 seconds of easy spinning.', 67),
('Rowing machine', 'Cardio', 'Rowing machine', 'Push with the legs first, then lean back and pull the handle to the ribs; return arms, body, then legs.', 68),
('Rowing intervals', 'Cardio', 'Rowing machine', 'Row hard for 1 minute at a strong, steady stroke rate, then row easily for 1 minute.', 69),
('Air bike sprints', 'Cardio', 'Air bike', 'Push and pull the handles while pedalling, go all out for the work time, then recover with easy pedalling.', 70)
on conflict (name) do update set muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  how_to = excluded.how_to, sort = excluded.sort;

delete from public.workout_templates where created_by is null and name in
 ('Beginner Full-Body', 'Over 50s Strength & Mobility', 'Fat-Burn Circuit', 'Strength Builder (45 min)',
  'Cardio Conditioning (30 min)', 'Rowing & Air Bike HIIT (20 min)');

insert into public.workout_templates (name, level, goal, description, exercises, is_public) values
('Beginner Full-Body', 'Beginner', 'General fitness',
 'Your first month at MY GYM: six simple moves with dumbbells, a kettlebell and the cable machine.',
 $j$[{"name":"Treadmill walk","sets":1,"reps":"5 min","note":"easy pace"},{"name":"Goblet squat","sets":3,"reps":"10","note":"light kettlebell"},{"name":"Dumbbell bench press","sets":3,"reps":"10","note":"light dumbbells"},{"name":"Seated cable row","sets":3,"reps":"10","note":""},{"name":"Plank","sets":3,"reps":"20 sec","note":"knees down is fine"},{"name":"Stretch cool-down","sets":1,"reps":"5 min","note":""}]$j$::jsonb, true),
('Over 50s Strength & Mobility', 'Over 50s', 'Strength + mobility',
 'Bone strength, balance and mobility. Kind to joints, big on benefits.',
 $j$[{"name":"Exercise bike ride","sets":1,"reps":"5 min","note":"easy, joint-friendly warm-up"},{"name":"Sit-to-stand","sets":3,"reps":"8","note":"from a bench"},{"name":"Wall push-up","sets":3,"reps":"10","note":""},{"name":"Seated cable row","sets":3,"reps":"10","note":"light weight"},{"name":"Calf raise","sets":3,"reps":"12","note":"hold a support for balance"},{"name":"Glute bridge","sets":2,"reps":"12","note":""},{"name":"Chair yoga stretch","sets":1,"reps":"8 min","note":""}]$j$::jsonb, true),
('Fat-Burn Circuit', 'All levels', 'Fat loss',
 '40 sec work / 20 sec rest, 3 rounds. Bring water and a towel.',
 $j$[{"name":"Jumping jacks (or step jacks)","sets":3,"reps":"40 sec","note":""},{"name":"Kettlebell swing","sets":3,"reps":"40 sec","note":""},{"name":"Push-up","sets":3,"reps":"40 sec","note":"any incline"},{"name":"Rowing machine","sets":3,"reps":"40 sec","note":"hard but smooth"},{"name":"Goblet squat","sets":3,"reps":"40 sec","note":""},{"name":"Mountain climbers","sets":3,"reps":"40 sec","note":""},{"name":"Air bike sprints","sets":3,"reps":"40 sec","note":""},{"name":"Bicycle crunch","sets":3,"reps":"40 sec","note":""}]$j$::jsonb, true),
('Strength Builder (45 min)', 'Intermediate', 'Build muscle',
 'Classic barbell strength essentials for members who want to get strong.',
 $j$[{"name":"Rowing machine","sets":1,"reps":"5 min","note":"easy warm-up"},{"name":"Barbell back squat","sets":4,"reps":"6-8","note":""},{"name":"Bench press","sets":4,"reps":"6-8","note":""},{"name":"Lat pulldown","sets":3,"reps":"8-10","note":"cable machine with the bar"},{"name":"Romanian deadlift","sets":3,"reps":"8-10","note":""},{"name":"Overhead press","sets":3,"reps":"8-10","note":""},{"name":"Farmer carry","sets":3,"reps":"30 m","note":"finisher"}]$j$::jsonb, true),
('Cardio Conditioning (30 min)', 'All levels', 'Fitness + stamina',
 'Move through the cardio kit at a pace that suits you. Steady effort, not a sprint.',
 $j$[{"name":"Treadmill walk","sets":1,"reps":"5 min","note":"warm-up"},{"name":"Rowing machine","sets":1,"reps":"5 min","note":"steady"},{"name":"Exercise bike ride","sets":1,"reps":"5 min","note":"steady"},{"name":"Treadmill intervals","sets":5,"reps":"30 sec fast / 60 sec easy","note":""},{"name":"Air bike sprints","sets":4,"reps":"20 sec hard / 40 sec easy","note":""},{"name":"Treadmill incline walk","sets":1,"reps":"5 min","note":"cool-down"}]$j$::jsonb, true),
('Rowing & Air Bike HIIT (20 min)', 'Intermediate', 'Fat loss',
 'Short, hard intervals on the rower and air bike. Warm up first and keep your form.',
 $j$[{"name":"Exercise bike ride","sets":1,"reps":"4 min","note":"warm-up"},{"name":"Rowing intervals","sets":4,"reps":"1 min hard / 1 min easy","note":""},{"name":"Air bike sprints","sets":6,"reps":"20 sec hard / 40 sec easy","note":""},{"name":"Rowing intervals","sets":2,"reps":"1 min hard / 1 min easy","note":""},{"name":"Stretch cool-down","sets":1,"reps":"3 min","note":""}]$j$::jsonb, true);

commit;
