-- MY GYM London - migration: gym-equipment-only workouts + a few more exercises
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run).
-- The gym has: 2 cable machines (one with a bar, one with pulleys), a Smith bar, barbells,
-- dumbbells, kettlebells and a pull-up bar. No other machines, so every plan below uses only those.
-- Replaces the built-in plans (created_by is null; this also removes the duplicate copies the
-- original seed left behind). Plans members saved themselves are not touched.

begin;

-- ---------- more exercises for the library ----------
insert into public.exercises (name, muscle_group, equipment, how_to, sort) values
('Dumbbell bench press', 'Chest', 'Dumbbell', 'Lie on a bench, lower the dumbbells to the sides of the chest, press up over the shoulders.', 42),
('Standing cable chest press', 'Chest', 'Cable', 'Stand in a split stance between two high or mid pulleys, press the handles forward until the arms are straight.', 43),
('Wall push-up', 'Chest', 'Bodyweight', 'Hands on a wall at chest height, lower the chest towards the wall and push back.', 44),
('Dumbbell shoulder press', 'Shoulders', 'Dumbbell', 'Sit or stand tall, press the dumbbells from shoulder height to overhead without arching the back.', 45),
('Cable reverse fly', 'Shoulders', 'Cable', 'Cross the pulleys, pull the handles out and back with soft elbows, squeezing the rear shoulders.', 46),
('Kettlebell halo', 'Shoulders', 'Kettlebell', 'Hold the kettlebell upside down at the chest and circle it around the head, keeping the ribs down.', 47),
('Smith bent-over row', 'Back', 'Smith bar', 'Hinge to a flat back with the bar below the knees, pull to the lower ribs and lower slowly.', 48),
('Chin-up', 'Back', 'Pull-up bar', 'Palms facing you, hang with straight arms, pull the chin over the bar and lower under control.', 49),
('Superman hold', 'Back', 'Bodyweight', 'Lie face down, lift arms and legs a few centimetres and hold, squeezing the back and glutes.', 50),
('Dumbbell Romanian deadlift', 'Legs', 'Dumbbell', 'Soft knees, push the hips back with the dumbbells close to the legs until the hamstrings stretch, then stand tall.', 51),
('Smith Romanian deadlift', 'Legs', 'Smith bar', 'Soft knees, slide the bar down the thighs as the hips go back, flat back, then drive the hips forward.', 52),
('Kettlebell deadlift', 'Legs', 'Kettlebell', 'Kettlebell between the feet, hinge with a flat back, push the floor away and stand tall.', 53),
('Bulgarian split squat', 'Legs', 'Dumbbell', 'Back foot on a bench, dumbbells at the sides, lower the back knee towards the floor and drive up through the front heel.', 54),
('Dumbbell step-up', 'Legs', 'Dumbbell', 'Place one foot fully on a bench, drive up through that heel, lower slowly and repeat on both legs.', 55),
('Reverse lunge', 'Legs', 'Bodyweight', 'Step back, lower the back knee towards the floor, push through the front heel to return.', 56),
('Sit-to-stand', 'Legs', 'Bodyweight', 'Sit on a bench, lean slightly forward and stand up without using the hands, then sit back slowly.', 57),
('Pallof press', 'Core', 'Cable', 'Stand side-on to a mid pulley, handle at the chest, press straight out and resist the twist.', 58),
('Mountain climbers', 'Core', 'Bodyweight', 'In a high plank, drive the knees in quickly one at a time, hips low and steady.', 59),
('Bicycle crunch', 'Core', 'Bodyweight', 'Lie on your back, bring opposite elbow to knee while the other leg extends, alternate slowly.', 60),
('Kettlebell clean and press', 'Full body', 'Kettlebell', 'Swing the bell to the shoulder in one smooth pull, then press it overhead and lower with control.', 61),
('Dumbbell thruster', 'Full body', 'Dumbbell', 'Squat with the dumbbells at the shoulders, then stand and press them overhead in one movement.', 62)
on conflict (name) do update set muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  how_to = excluded.how_to, sort = excluded.sort;

-- ---------- workout plans ----------
delete from public.workout_templates where created_by is null;

insert into public.workout_templates (name, level, goal, description, exercises, is_public) values
('Beginner Full-Body', 'Beginner', 'General fitness',
 'Your first month at MY GYM: six simple moves with dumbbells, a kettlebell and the cable machine.',
 $j$[{"name":"Marching warm-up","sets":1,"reps":"3 min","note":"easy pace"},{"name":"Goblet squat","sets":3,"reps":"10","note":"light kettlebell"},{"name":"Dumbbell bench press","sets":3,"reps":"10","note":"light dumbbells"},{"name":"Seated cable row","sets":3,"reps":"10","note":""},{"name":"Plank","sets":3,"reps":"20 sec","note":"knees down is fine"},{"name":"Stretch cool-down","sets":1,"reps":"5 min","note":""}]$j$::jsonb, true),
('Over 50s Strength & Mobility', 'Over 50s', 'Strength + mobility',
 'Bone strength, balance and mobility. Kind to joints, big on benefits.',
 $j$[{"name":"Marching warm-up","sets":1,"reps":"3 min","note":""},{"name":"Sit-to-stand","sets":3,"reps":"8","note":"from a bench"},{"name":"Wall push-up","sets":3,"reps":"10","note":""},{"name":"Seated cable row","sets":3,"reps":"10","note":"light weight"},{"name":"Calf raise","sets":3,"reps":"12","note":"hold a support for balance"},{"name":"Glute bridge","sets":2,"reps":"12","note":""},{"name":"Chair yoga stretch","sets":1,"reps":"8 min","note":""}]$j$::jsonb, true),
('Fat-Burn Circuit', 'All levels', 'Fat loss',
 '40 sec work / 20 sec rest, 3 rounds. Bring water and a towel.',
 $j$[{"name":"Jumping jacks (or step jacks)","sets":3,"reps":"40 sec","note":""},{"name":"Kettlebell swing","sets":3,"reps":"40 sec","note":""},{"name":"Push-up","sets":3,"reps":"40 sec","note":"any incline"},{"name":"Mountain climbers","sets":3,"reps":"40 sec","note":""},{"name":"Goblet squat","sets":3,"reps":"40 sec","note":""},{"name":"Bicycle crunch","sets":3,"reps":"40 sec","note":""}]$j$::jsonb, true),
('Strength Builder (45 min)', 'Intermediate', 'Build muscle',
 'Classic barbell strength essentials for members who want to get strong.',
 $j$[{"name":"Barbell back squat","sets":4,"reps":"6-8","note":""},{"name":"Bench press","sets":4,"reps":"6-8","note":""},{"name":"Lat pulldown","sets":3,"reps":"8-10","note":"cable machine with the bar"},{"name":"Romanian deadlift","sets":3,"reps":"8-10","note":""},{"name":"Overhead press","sets":3,"reps":"8-10","note":""},{"name":"Farmer carry","sets":3,"reps":"30 m","note":"finisher"}]$j$::jsonb, true),
('Upper Body Strength', 'Intermediate', 'Build muscle',
 'Push and pull for a strong chest, back and arms using barbells, the pull-up bar and cables.',
 $j$[{"name":"Bench press","sets":4,"reps":"6-8","note":""},{"name":"Pull-up","sets":3,"reps":"6-8","note":"use a slow lowering phase if needed"},{"name":"Overhead press","sets":3,"reps":"8","note":""},{"name":"Seated cable row","sets":3,"reps":"10","note":""},{"name":"Cable lateral raise","sets":3,"reps":"12","note":""},{"name":"Triceps pushdown","sets":3,"reps":"12","note":""},{"name":"Biceps curl","sets":3,"reps":"12","note":"dumbbells"}]$j$::jsonb, true),
('Lower Body & Glutes', 'Intermediate', 'Legs + glutes',
 'Smith bar and dumbbell work for strong legs and glutes.',
 $j$[{"name":"Smith squat","sets":4,"reps":"8","note":""},{"name":"Dumbbell Romanian deadlift","sets":3,"reps":"10","note":""},{"name":"Bulgarian split squat","sets":3,"reps":"10 each leg","note":""},{"name":"Smith hip thrust","sets":4,"reps":"10","note":""},{"name":"Cable pull-through","sets":3,"reps":"12","note":""},{"name":"Calf raise","sets":3,"reps":"15","note":""}]$j$::jsonb, true),
('Dumbbell & Kettlebell Full-Body', 'All levels', 'Strength + fitness',
 'A full-body session with just dumbbells and a kettlebell. Choose weights that make the last reps hard.',
 $j$[{"name":"Goblet squat","sets":3,"reps":"10","note":""},{"name":"Dumbbell bench press","sets":3,"reps":"10","note":""},{"name":"Single-arm dumbbell row","sets":3,"reps":"10 each side","note":""},{"name":"Dumbbell shoulder press","sets":3,"reps":"10","note":""},{"name":"Kettlebell swing","sets":3,"reps":"15","note":""},{"name":"Farmer carry","sets":3,"reps":"30 m","note":""}]$j$::jsonb, true),
('Cable Machine Sculpt', 'All levels', 'Tone + shape',
 'Do these as a circuit: 12 reps each, 3 rounds, using the two cable machines.',
 $j$[{"name":"Cable pull-through","sets":3,"reps":"12","note":""},{"name":"Standing cable chest press","sets":3,"reps":"12","note":""},{"name":"Seated cable row","sets":3,"reps":"12","note":""},{"name":"Cable lateral raise","sets":3,"reps":"12","note":""},{"name":"Cable biceps curl","sets":3,"reps":"12","note":""},{"name":"Triceps pushdown","sets":3,"reps":"12","note":""},{"name":"Cable woodchop","sets":3,"reps":"10 each side","note":""}]$j$::jsonb, true),
('Smith Bar Basics', 'Beginner', 'Learn the lifts',
 'The Smith bar guides the bar for you, which makes it a good place to learn squat, press and row.',
 $j$[{"name":"Smith squat","sets":3,"reps":"10","note":""},{"name":"Smith bench press","sets":3,"reps":"10","note":""},{"name":"Smith bent-over row","sets":3,"reps":"10","note":""},{"name":"Smith shoulder press","sets":3,"reps":"10","note":""},{"name":"Smith hip thrust","sets":3,"reps":"12","note":""},{"name":"Plank","sets":3,"reps":"30 sec","note":""}]$j$::jsonb, true),
('Core & Abs (20 min)', 'All levels', 'Core strength',
 'A short core session using the floor, the pull-up bar and a cable.',
 $j$[{"name":"Plank","sets":3,"reps":"30 sec","note":""},{"name":"Dead bug","sets":3,"reps":"10 each side","note":""},{"name":"Cable crunch","sets":3,"reps":"12","note":""},{"name":"Hanging knee raise","sets":3,"reps":"10","note":""},{"name":"Pallof press","sets":3,"reps":"10 each side","note":""},{"name":"Russian twist","sets":3,"reps":"20","note":""}]$j$::jsonb, true),
('Home Workout - No Equipment', 'All levels', 'Stay active anywhere',
 'Travelling or stuck at home? 20 minutes, no kit needed.',
 $j$[{"name":"Bodyweight squat","sets":3,"reps":"15","note":""},{"name":"Push-up","sets":3,"reps":"10","note":"wall, knee or full"},{"name":"Reverse lunge","sets":3,"reps":"10 each leg","note":""},{"name":"Superman hold","sets":3,"reps":"20 sec","note":""},{"name":"Glute bridge","sets":3,"reps":"15","note":""},{"name":"Dead bug","sets":3,"reps":"10 each side","note":""}]$j$::jsonb, true),
('Kids Fun Fitness (ages 6-11)', 'Kids', 'Confidence + coordination',
 'Games-based session: sneaky exercise, maximum giggles.',
 $j$[{"name":"Animal walk warm-up","sets":1,"reps":"3 min","note":"bear crawl, crab walk"},{"name":"Bean bag balance relay","sets":3,"reps":"1 min","note":""},{"name":"Star jumps challenge","sets":3,"reps":"10","note":""},{"name":"Obstacle course","sets":3,"reps":"1 lap","note":""},{"name":"Freeze dance cool-down","sets":1,"reps":"5 min","note":""}]$j$::jsonb, true);

commit;
