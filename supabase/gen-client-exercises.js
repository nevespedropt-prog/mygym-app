// One-off generator: builds migration-client-exercises.sql and patches DEMO_EXERCISES in db.js.
// Source: WORKOUT PICTURES/exercise_list.md (compiled from the gym's client workout sheets).
// Run from the app folder:  node supabase/gen-client-exercises.js
const fs = require('fs');

const X = [
  // ---- cardio / conditioning
  ['Sled push', 'Cardio', 'Sled', 'Hands on the uprights, low hips, drive the sled forward with short, powerful steps.'],
  ['Sled pull', 'Cardio', 'Sled', 'Hold the rope or straps, walk backwards or lean back and pull hand over hand to bring the sled to you.'],
  ['Battle rope waves', 'Cardio', 'Battle rope', 'Athletic stance, brace the core and whip both ends up and down in fast alternating waves.'],
  ['Medicine ball slam', 'Cardio', 'Medicine ball', 'Lift the ball overhead, then slam it down hard in front of your feet, squat to pick it up and repeat.'],
  ['Jumping jacks', 'Cardio', 'Bodyweight', 'Jump the feet wide while the arms go overhead, then jump back together. Step out one leg at a time for a low-impact version.'],
  ['Boxing rounds', 'Cardio', 'Boxing bag', 'Hands up, stay light on the feet and throw jab, cross and hook combinations for the full round.'],
  ['Treadmill run', 'Cardio', 'Treadmill', 'Run at a steady pace you can breathe at, land softly under the hips and keep the shoulders relaxed.'],
  ['Skipping', 'Cardio', 'Skipping rope', 'Turn the rope from the wrists and jump low on the balls of the feet, one jump per turn.'],
  ['Burpee', 'Cardio', 'Bodyweight', 'Squat down, kick the feet back to a plank, chest to the floor, jump the feet in and finish with a jump.'],
  ['Box jump', 'Cardio', 'Box', 'Swing the arms, jump up onto the box with both feet and land softly, then step back down.'],
  ['Broad jump', 'Cardio', 'Bodyweight', 'Swing the arms, jump forward as far as you can and land softly with bent knees.'],
  ['Jump squat', 'Cardio', 'Bodyweight', 'Squat down, then explode up into a jump and land softly straight into the next squat.'],
  ['High knees', 'Cardio', 'Bodyweight', 'Run on the spot driving the knees up to hip height, pumping the arms.'],
  ['Agility ladder drills', 'Cardio', 'Bodyweight', 'Move quickly through the agility ladder with fast, light foot patterns, one foot in each square.'],
  ['Side shuffles', 'Cardio', 'Bodyweight', 'In a half squat, shuffle sideways without crossing the feet, then return the same way.'],
  ['Landmine punch', 'Cardio', 'Landmine', 'Hold the end of the bar at the shoulder and punch it up and forward, rotating the hips.'],
  ['Power bag drag', 'Full body', 'Power bag', 'Grip the bag, stay low and drag or pull it across the floor in a straight line.'],
  // ---- lower body
  ['Bodyweight squat', 'Legs', 'Bodyweight', 'Feet shoulder-width apart, sit the hips back and down, chest tall, then stand up.'],
  ['TRX squat', 'Legs', 'TRX', 'Hold the TRX handles, lean back with straight arms and squat down, using the straps for balance.'],
  ['Dumbbell squat', 'Legs', 'Dumbbell', 'Hold dumbbells at the sides or shoulders, squat to depth with an upright chest and drive up.'],
  ['Kettlebell front squat', 'Legs', 'Kettlebell', 'Rack the kettlebell at the shoulder, elbow in, and squat down keeping the torso upright.'],
  ['Front squat', 'Legs', 'Barbell', 'Bar across the front of the shoulders, elbows high, squat to depth and drive up.'],
  ['Sumo squat', 'Legs', 'Dumbbell', 'Wide stance, toes out, hold one dumbbell between the legs and squat straight down.'],
  ['Bosu squat', 'Legs', 'Bosu', 'Stand on the Bosu, or on the flat side, and squat slowly while keeping the knees steady.'],
  ['Squat hold', 'Legs', 'Bodyweight', 'Sit into the bottom of a squat and hold it still, chest up, weight through the heels.'],
  ['Squat pulse', 'Legs', 'Bodyweight', 'Stay low in a squat and make small up-and-down pulses without standing all the way up.'],
  ['Wall sit', 'Legs', 'Bodyweight', 'Back flat on the wall, thighs parallel to the floor, hold the position.'],
  ['Side lunge', 'Legs', 'Bodyweight', 'Step wide to the side, sit back into that hip with the other leg straight, push back to the middle.'],
  ['Dumbbell side lunge', 'Legs', 'Dumbbell', 'Hold a dumbbell at the chest, step wide to the side and sit back into the hip, push back to the middle.'],
  ['TRX side lunge', 'Legs', 'TRX', 'Hold the TRX handles for balance, step to the side into a lunge and push back to the middle.'],
  ['Dumbbell lunge', 'Legs', 'Dumbbell', 'Dumbbells at the sides, step forward or back into a lunge, lower the back knee and return.'],
  ['Lunge and curl', 'Legs', 'Dumbbell', 'Lower into a lunge, and as you stand up curl the dumbbells to the shoulders.'],
  ['Lunge and press', 'Full body', 'Dumbbell', 'Lunge forward or to the side with the dumbbells at the shoulders, and press them overhead as you stand up.'],
  ['Reverse lunge with knee drive', 'Legs', 'Bodyweight', 'Step back into a lunge, then drive the back knee up to hip height as you stand.'],
  ['Smith lunge', 'Legs', 'Smith bar', 'Bar on the upper back, step forward or back into a lunge and push through the front heel.'],
  ['Smith deadlift', 'Legs', 'Smith bar', 'Feet under the bar, hinge with a flat back, grip and stand up, sliding the bar up the legs.'],
  ['Sumo deadlift', 'Legs', 'Barbell', 'Wide stance, toes out, grip inside the knees, push the floor away and stand tall.'],
  ['Shoulder bridge', 'Glutes', 'Bodyweight', 'Lie on your back, feet flat, lift the hips until shoulders, hips and knees line up and squeeze the glutes.'],
  ['Single-leg hip raise', 'Glutes', 'Bodyweight', 'Lie on your back with one foot on the floor and the other leg straight, lift the hips and lower slowly.'],
  ['Cable hamstring curl', 'Legs', 'Cable', 'Strap the cable to the ankle, face the machine and curl the heel towards the glute, return slowly.'],
  ['Side-lying inner thigh raise', 'Legs', 'Bodyweight', 'Lie on your side with the top leg bent in front and lift the bottom leg up and down.'],
  ['Donkey kick', 'Glutes', 'Bodyweight', 'On hands and knees, kick one heel up towards the ceiling, keeping the back flat, and lower slowly.'],
  ['Fire hydrant', 'Glutes', 'Bodyweight', 'On hands and knees, lift one knee out to the side to hip height without rotating the back.'],
  ['Glute kickback', 'Glutes', 'Bodyweight', 'On hands and knees, or standing, kick one leg back and squeeze the glute at the top.'],
  ['TRX squat and row', 'Full body', 'TRX', 'Lean back on the straps, squat down, then stand and row the handles to the chest in one movement.'],
  ['Good morning', 'Back', 'Barbell', 'Bar on the upper back, soft knees, push the hips back until the torso is near parallel, then stand.'],
  // ---- chest and pushing
  ['Incline Smith press', 'Chest', 'Smith bar', 'Bench at 30 degrees under the bar, lower to the upper chest and press up.'],
  ['Incline barbell press', 'Chest', 'Barbell', 'Bench at 30 degrees, lower the bar to the upper chest and press up over the shoulders.'],
  ['Reverse-grip dumbbell press', 'Chest', 'Dumbbell', 'Palms facing you, lower the dumbbells to the chest and press up, elbows tucked in.'],
  ['Close-grip dumbbell press', 'Chest', 'Dumbbell', 'Dumbbells touching, press them up from the chest with the elbows in, squeezing the chest and triceps.'],
  ['Dumbbell fly', 'Chest', 'Dumbbell', 'Lie on a bench, open the arms wide with soft elbows until you feel a stretch, then bring them together.'],
  ['Cable crossover', 'Chest', 'Cable', 'Stand between high pulleys, step forward and bring the handles down and together in front of the hips.'],
  ['Knee push-up', 'Chest', 'Bodyweight', 'Hands under shoulders and knees on the floor, body straight from knees to head, lower the chest and push back.'],
  ['TRX push-up', 'Chest', 'TRX', 'Hands in the TRX handles, body in a straight line, lower the chest between the hands and push back.'],
  ['Dip', 'Chest', 'Bodyweight', 'Grip the dip bars, lower until the elbows are at 90 degrees and press back up.'],
  ['Bench dip', 'Arms', 'Bodyweight', 'Hands on a bench behind you, lower the hips by bending the elbows, then press back up.'],
  ['Lying triceps extension', 'Arms', 'Dumbbell', 'Lie on a bench, bend the elbows to lower the weights beside the head, then extend the arms.'],
  ['Triceps kickback', 'Arms', 'Dumbbell', 'Hinge forward with the upper arm parallel to the floor and straighten the elbow behind you.'],
  ['Arnold press', 'Shoulders', 'Dumbbell', 'Start with palms facing you at the chest and rotate them forward as you press the dumbbells overhead.'],
  ['Dumbbell floor press', 'Chest', 'Dumbbell', 'Lie on the floor, lower the dumbbells until the upper arms touch the floor and press up.'],
  ['Plate press', 'Chest', 'Plate', 'Hold a plate at the chest and press it straight out in front, squeezing the chest.'],
  ['Glute bridge press', 'Chest', 'Dumbbell', 'Hold a bridge on your back and press the dumbbells up from the chest.'],
  ['Renegade row', 'Back', 'Dumbbell', 'In a push-up position on the dumbbells, row one dumbbell to the hip while keeping the hips still.'],
  // ---- back and pulling
  ['Straight-arm pulldown', 'Back', 'Cable', 'Stand facing a high pulley, arms straight, press the bar or rope down to the thighs and return slowly.'],
  ['TRX row', 'Back', 'TRX', 'Lean back holding the TRX handles, body straight, pull the chest to the hands and lower slowly.'],
  ['Landmine row', 'Back', 'Landmine', 'Straddle the bar, hinge to a flat back and row the end of the bar to the chest.'],
  ['Dumbbell bent-over row', 'Back', 'Dumbbell', 'Hinge to a flat back and row both dumbbells to the hips, squeezing the shoulder blades.'],
  ['Inverted row', 'Back', 'Smith bar', 'Lie under a low bar, grip it and pull the chest to the bar with the body straight.'],
  ['Dumbbell reverse fly', 'Shoulders', 'Dumbbell', 'Hinge forward, or lie on an incline bench, and raise the dumbbells out to the sides with soft elbows.'],
  ['TRX reverse fly', 'Shoulders', 'TRX', 'Lean back holding the TRX handles and open the arms wide, squeezing the shoulder blades.'],
  ['Back extension', 'Back', 'Bodyweight', 'Face down over a bench or bench edge, lift the chest until the body is straight and lower slowly.'],
  ['Dumbbell pullover', 'Back', 'Dumbbell', 'Lie across a bench holding one dumbbell, lower it back over the head with straight arms and pull it over the chest.'],
  ['Swimmers', 'Back', 'Bodyweight', 'Lie face down and alternate lifting opposite arm and leg in a flutter-style swimming motion.'],
  // ---- shoulders and arms
  ['Upright row', 'Shoulders', 'Barbell', 'Pull the bar up close to the body to chest height, elbows leading, and lower slowly.'],
  ['Dumbbell front raise', 'Shoulders', 'Dumbbell', 'Raise the dumbbell straight in front to shoulder height and lower slowly.'],
  ['Rotator cuff external rotation', 'Shoulders', 'Cable', 'Elbow at your side bent to 90 degrees, rotate the hand outwards against the light cable, then return.'],
  ['Dumbbell shrug', 'Shoulders', 'Dumbbell', 'Hold the dumbbells at the sides and lift the shoulders straight up to the ears, pause and lower.'],
  ['Incline dumbbell curl', 'Arms', 'Dumbbell', 'Sit back on an incline bench with the arms hanging, curl the dumbbells up and lower slowly.'],
  ['Barbell curl', 'Arms', 'Barbell', 'Elbows pinned to the sides, curl the bar to the shoulders and lower under control.'],
  ['Cable rope curl', 'Arms', 'Cable', 'Hold the rope at a low pulley and curl to the shoulders, keeping the elbows still.'],
  ['Cable forearm curl', 'Arms', 'Cable', 'Rest the forearm on the thigh or bench and curl the wrist up against the low cable.'],
  ['TRX biceps curl', 'Arms', 'TRX', 'Lean back holding the TRX handles with palms up and curl the hands to the head.'],
  ['Curl and press', 'Arms', 'Dumbbell', 'Curl the dumbbells to the shoulders and press straight into an overhead press, then lower.'],
  ['Dumbbell clean and press', 'Full body', 'Dumbbell', 'Pull the dumbbells from the floor to the shoulders in one move, then press them overhead.'],
  ['Barbell clean and press', 'Full body', 'Barbell', 'Pull the bar from the floor to the shoulders in one explosive move, then press it overhead.'],
  // ---- core
  ['Leg drop', 'Core', 'Bodyweight', 'Lie on your back with the legs straight up, lower them slowly towards the floor without arching the back.'],
  ['Medicine ball sit-up', 'Core', 'Medicine ball', 'Sit up holding the ball and bring it overhead or pass it to your feet at the top.'],
  ['Medicine ball crunch', 'Core', 'Medicine ball', 'Lie on your back with the knees bent and the ball over the knees, crunch up to meet the ball.'],
  ['Sit-up', 'Core', 'Bodyweight', 'Lie on your back with the knees bent, curl all the way up to sitting and lower with control.'],
  ['Side crunch', 'Core', 'Bodyweight', 'Lie on your side or on your back and bring the elbow towards the knee on the same side.'],
  ['Landmine twist', 'Core', 'Landmine', 'Hold the end of the bar at the chest and rotate it from side to side with straight arms, pivoting the feet.'],
  ['Bird dog', 'Core', 'Bodyweight', 'On hands and knees, reach one arm and the opposite leg out long, hold, and swap sides.'],
  ['Side plank', 'Core', 'Bodyweight', 'On one forearm, lift the hips so the body is a straight line and hold. Drop the bottom knee to make it easier.'],
  ['Plank shoulder tap', 'Core', 'Bodyweight', 'In a high plank, tap each shoulder in turn while keeping the hips from rocking.'],
  ['Ab rollout', 'Core', 'Barbell', 'Kneel holding the wheel or barbell, roll out with a braced core and pull back without sagging the hips.'],
  ['V-up', 'Core', 'Bodyweight', 'Lie flat and lift the legs and chest together to meet in a V, then lower slowly.'],
  ['Hanging leg raise', 'Core', 'Pull-up bar', 'Hang from the bar and raise straight legs to hip height or higher, lowering without swinging.'],
  ['Turkish get-up', 'Full body', 'Kettlebell', 'Lie on your back holding the kettlebell overhead and stand up in controlled steps, keeping the arm straight.'],
  ['Lying leg raise', 'Core', 'Bodyweight', 'Lie on your back and lift the straight legs to vertical, lowering slowly without arching.'],
  ['Butterfly sit-up', 'Core', 'Bodyweight', 'Lie with the soles of the feet together and the knees out, sit up and reach towards the feet.'],
  ['Crunch', 'Core', 'Bodyweight', 'Lie on your back with the knees bent, lift the shoulders off the floor and lower slowly.'],
  ['Flutter kicks', 'Core', 'Bodyweight', 'Lie on your back with the legs just off the floor and kick them up and down in small quick movements.'],
  ['Scissor kicks', 'Core', 'Bodyweight', 'Lie on your back with the legs raised and cross them over each other in a scissor motion.'],
  ['Dumbbell side bend', 'Core', 'Dumbbell', 'Hold a dumbbell in one hand and lean to that side, then return upright using the opposite side of the waist.'],
  ['TRX pike', 'Core', 'TRX', 'Feet in the TRX straps in a plank, lift the hips up towards the ceiling and lower back down.'],
  ['Ankle touches', 'Core', 'Bodyweight', 'Lie with the knees bent and reach each hand to the same-side ankle with a small side crunch.'],
  ['Swiss ball tuck', 'Core', 'Swiss ball', 'With the feet on the ball in a plank, pull the knees in towards the chest and roll back out.'],
  ['Knee tuck', 'Core', 'Bodyweight', 'Lie on your back and pull the knees up to the chest, lowering the feet without touching the floor.'],
];

// ---- checks: no duplicates inside the list, none against the current library
const names = X.map((r) => r[0].toLowerCase());
const dup = names.filter((n, i) => names.indexOf(n) !== i);
if (dup.length) throw new Error('duplicates in list: ' + dup.join(', '));
const db = fs.readFileSync('db.js', 'utf8');
const existing = [...db.matchAll(/\{"name": ?"([^"]+)", "muscle_group"/g)].map((m) => m[1].toLowerCase());
const clash = names.filter((n) => existing.includes(n));
if (clash.length) throw new Error('already in library: ' + clash.join(', '));
const maxSort = Math.max(...[...db.matchAll(/"sort": ?(\d+)\}/g)].map((m) => +m[1]));

const rows = X.map((r, i) => ({ name: r[0], muscle_group: r[1], equipment: r[2], how_to: r[3], sort: maxSort + 1 + i }));
const q = (s) => "'" + s.replace(/'/g, "''") + "'";

const sql = `-- MY GYM London - migration: exercises from the client workout sheets
-- Source: WORKOUT PICTURES/exercise_list.md. Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run).
-- Adds ${rows.length} exercises (no repeats of the ones already in the library) and uses the plain
-- name "Jumping jacks" in the Fat-Burn Circuit so it links to the library.

begin;

insert into public.exercises (name, muscle_group, equipment, how_to, sort) values
${rows.map((r) => `(${q(r.name)}, ${q(r.muscle_group)}, ${q(r.equipment)}, ${q(r.how_to)}, ${r.sort})`).join(',\n')}
on conflict (name) do update set muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  how_to = excluded.how_to, sort = excluded.sort;

update public.workout_templates
  set exercises = replace(exercises::text, 'Jumping jacks (or step jacks)', 'Jumping jacks')::jsonb
  where created_by is null and exercises::text like '%Jumping jacks (or step jacks)%';

commit;
`;
fs.writeFileSync('supabase/migration-client-exercises.sql', sql);

// ---- patch db.js
const nl = db.includes('\r\n') ? '\r\n' : '\n';
const last = rows.length ? /(\{"name":\s*"Air bike sprints"[^\r\n]*"sort":\s*70\})(\r?\n)/ : null;
if (!last.test(db)) throw new Error('anchor not found in db.js');
let out = db.replace(last, (m, a) => a + ',' + nl + rows.map((r) => '    ' + JSON.stringify(r)).join(',' + nl) + nl);
out = out.replace(/Jumping jacks \(or step jacks\)/g, 'Jumping jacks');
fs.writeFileSync('db.js', out);
console.log('added', rows.length, 'exercises; sorts', rows[0].sort, '-', rows[rows.length - 1].sort);
