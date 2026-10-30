-- MY GYM London - 30 more exercises: plyometrics (22, new group "Plyometrics", jump box and bodyweight) and sled work (8, filed as strength: Legs, Full body or Back)
-- Each how-to starts with the level: Beginner, Intermediate or Advanced.
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run: skips any name already in the library, any capitals).
with new_rows(name, muscle_group, equipment, how_to, sort) as (values
-- Plyometrics on the jump box (8)
('Single-leg box jump','Plyometrics','Box','Advanced. Jump onto the box off one leg, land softly on the same foot, then step down.',465),
('Lateral box jump','Plyometrics','Box','Intermediate. Stand side-on to the box, jump sideways onto it with both feet, land softly and step down.',466),
('Depth drop','Plyometrics','Box','Intermediate. Step off the box, land softly on both feet with bent knees, and hold the landing.',467),
('Depth jump','Plyometrics','Box','Advanced. Step off the box and as soon as the feet touch the floor, jump up as high as you can.',468),
('Box jump over','Plyometrics','Box','Advanced. Jump up onto the box and straight over it, landing softly on the other side.',469),
('Explosive step-up','Plyometrics','Box','Intermediate. Step onto the box and drive the back knee up so the foot comes off the floor, land softly.',470),
('Box squat jump','Plyometrics','Box','Intermediate. Sit back to the box, then explode up into a jump and land softly back on the box.',471),
('Burpee box jump','Plyometrics','Box','Advanced. Do a burpee, then jump up onto the box and step down.',472),
-- Plyometrics, bodyweight and light weights (14)
('Pogo jumps','Plyometrics','Bodyweight','Beginner. Stay tall with straight legs and bounce quickly on the balls of the feet, using only the ankles.',473),
('Jumping lunge','Plyometrics','Bodyweight','Intermediate. From a lunge, jump and switch legs in the air, landing softly in the opposite lunge.',474),
('Skater jump','Plyometrics','Bodyweight','Intermediate. Bound sideways from one foot to the other, landing softly and holding the balance.',475),
('Lateral bound','Plyometrics','Bodyweight','Intermediate. Push off one leg and jump sideways as far as you can, landing on the other leg and holding.',476),
('Single-leg hop','Plyometrics','Bodyweight','Intermediate. Hop forward on one leg, landing softly with a bent knee each time.',477),
('Star jump','Plyometrics','Bodyweight','Intermediate. Squat, then jump up spreading the arms and legs wide like a star, and land softly.',478),
('Pike jump','Plyometrics','Bodyweight','Advanced. Jump up and bring straight legs up in front to touch the toes, then land softly.',479),
('Frog jump','Plyometrics','Bodyweight','Intermediate. From a deep squat, jump forward as far as you can, landing back in the squat.',480),
('Bounding','Plyometrics','Bodyweight','Intermediate. Take long, springy strides, driving the knee up and pushing off hard on each step.',481),
('180 jump squat','Plyometrics','Bodyweight','Advanced. Squat, jump and turn half a circle in the air, land softly and repeat the other way.',482),
('High skips','Plyometrics','Bodyweight','Beginner. Skip forward driving one knee up high and the opposite arm forward on each step.',483),
('Explosive push-up','Plyometrics','Bodyweight','Intermediate. Lower to the floor and push up hard so the hands leave the floor, landing with soft elbows.',484),
('Dumbbell jump squat','Plyometrics','Dumbbell','Advanced. Hold light dumbbells at the sides, squat and jump up, landing softly.',485),
('Double unders','Plyometrics','Skipping rope','Advanced. Swing the rope twice under the feet on every jump, staying tall and relaxed.',486),
-- Sled work (8): strength exercises, not cardio (the existing Sled push and Sled pull were moved to Legs too with: update public.exercises set muscle_group = 'Legs' where name in ('Sled push','Sled pull');)
('Heavy sled push','Legs','Sled','Advanced. Load the sled heavy, lean into the handles with a flat back and push with short, powerful steps.',487),
('Light sled sprint push','Legs','Sled','Intermediate. Load the sled lightly and push it as fast as you can with long, driving steps.',488),
('Low-handle sled push','Legs','Sled','Intermediate. Hold the low handles with the body leaning forward, and push with a flat back.',489),
('High-handle sled push','Legs','Sled','Intermediate. Hold the high handles with a more upright body and push with steady strides.',490),
('Single-arm sled push','Full body','Sled','Advanced. Push the sled with one hand on the handle, keeping the hips and shoulders square.',491),
('Backward sled drag','Legs','Sled','Beginner. Face the sled holding the straps or handles, and walk backwards with small steps, pulling it towards you.',492),
('Sled lateral drag','Legs','Sled','Intermediate. Strap on or hold the rope, and side-step with the sled following, keeping the hips low.',493),
('Sled rope pull-in','Back','Sled','Intermediate. Stand facing the sled with a rope attached, and pull it in hand over hand, keeping the chest tall.',494)
)
insert into public.exercises (name, muscle_group, equipment, how_to, sort)
select n.name, n.muscle_group, n.equipment, n.how_to, n.sort
from new_rows n
where not exists (select 1 from public.exercises e where lower(e.name) = lower(n.name));
