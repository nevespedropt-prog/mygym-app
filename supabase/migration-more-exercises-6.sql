-- MY GYM London - 40 more exercises: 20 Plate + 20 Landmine
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run).

with new_rows (name, muscle_group, equipment, how_to, sort) as (values
  -- Plate (20) ----------------------------------------------------------
  ('Plate overhead squat',        'Legs',       'Plate',    'Advanced. Hold a plate overhead with arms locked, feet shoulder-width. Squat deep, keeping the plate centred above you.',       675),
  ('Plate lateral raise',         'Shoulders',  'Plate',    'Beginner. Hold a plate at the rim, raise it out to the side to shoulder height, pause, lower slowly.',                          676),
  ('Plate curl',                  'Arms',       'Plate',    'Beginner. Hold a plate by the rim, curl it up toward the shoulder, squeeze the biceps at the top and lower.',                   677),
  ('Plate halo',                  'Shoulders',  'Plate',    'Intermediate. Hold a plate at the sides, circle it slowly around your head keeping the elbows slightly bent.',                  678),
  ('Plate chest squeeze press',   'Chest',      'Plate',    'Beginner. Squeeze a plate between both palms and press it straight out from the chest, maintaining the squeeze throughout.',    679),
  ('Plate wood chop',             'Core',       'Plate',    'Intermediate. Hold a plate overhead, swing it diagonally to the opposite hip, rotating the core and pivoting the back foot.',   680),
  ('Plate sit-up',                'Core',       'Plate',    'Beginner. Hold a plate at the chest or overhead, perform a full sit-up keeping the arms steady and the feet flat.',             681),
  ('Plate side bend',             'Core',       'Plate',    'Beginner. Hold a plate in one hand at the side, bend laterally toward the floor and return under control.',                     682),
  ('Plate Romanian deadlift',     'Lower back', 'Plate',    'Intermediate. Hold a plate with both hands, hinge at the hips with a flat back and lower the plate along the thighs.',         683),
  ('Plate sumo squat',            'Legs',       'Plate',    'Beginner. Hold a plate with both hands between the legs, stand wide and squat deep keeping the chest tall.',                   684),
  ('Plate lunge',                 'Legs',       'Plate',    'Beginner. Hold a plate at the chest and step into a forward lunge, alternating legs each rep.',                                 685),
  ('Plate overhead lunge',        'Legs',       'Plate',    'Intermediate. Hold a plate overhead with arms straight, step forward into a lunge and keep the plate stable.',                  686),
  ('Plate hip thrust',            'Glutes',     'Plate',    'Beginner. Sit against a bench with a plate on the hips, drive the hips up and squeeze the glutes at the top.',                 687),
  ('Plate good morning',          'Lower back', 'Plate',    'Intermediate. Hold a plate behind the head on the upper traps, hinge forward with a flat back until near parallel.',           688),
  ('Plate around the world',      'Shoulders',  'Plate',    'Intermediate. Hold a plate at the bottom, arc it in a full circle from the hips to overhead and back, alternating direction.', 689),
  ('Plate push-up',               'Chest',      'Plate',    'Intermediate. Place both hands on a plate, perform a push-up keeping the core braced and the plate stable on the floor.',      690),
  ('Plate overhead press',        'Shoulders',  'Plate',    'Beginner. Hold a plate at the chest with both hands, press it straight overhead until the arms are locked, lower slowly.',     691),
  ('Plate pinch carry',           'Arms',       'Plate',    'Intermediate. Pinch a plate between the fingers and thumb of each hand, hold at the sides and walk with an upright torso.',    692),
  ('Plate oblique crunch',        'Core',       'Plate',    'Beginner. Lie on your back holding a plate, crunch and twist to bring one elbow toward the opposite knee.',                    693),
  ('Plate toe touch',             'Core',       'Plate',    'Beginner. Lie on your back with legs raised straight, hold a plate and crunch up to reach the toes, lower slowly.',            694),
  -- Landmine (20) -------------------------------------------------------
  ('Landmine goblet squat',       'Legs',       'Landmine', 'Beginner. Cup the bar end at the chest, feet shoulder-width, squat deep keeping the torso upright and the elbows high.',      695),
  ('Landmine split squat',        'Legs',       'Landmine', 'Intermediate. Hold the bar end at the chest, step into a split squat and lower the back knee toward the floor.',               696),
  ('Landmine Romanian deadlift',  'Lower back', 'Landmine', 'Intermediate. Hold bar end in both hands, hinge back with a flat back, lower until you feel the hamstrings load.',             697),
  ('Landmine push press',         'Shoulders',  'Landmine', 'Intermediate. Hold the bar end at the shoulder, dip the knees and drive it up overhead in one explosive movement.',            698),
  ('Landmine single-arm press',   'Shoulders',  'Landmine', 'Intermediate. Hold the bar end at one shoulder, press it up and forward until the arm is fully extended, lower slowly.',      699),
  ('Landmine front squat',        'Legs',       'Landmine', 'Intermediate. Cup the bar end at the chest with both hands, squat deep keeping the elbows high and the torso upright.',       700),
  ('Landmine reverse lunge',      'Legs',       'Landmine', 'Beginner. Hold the bar end at the chest, step back into a reverse lunge and lower the back knee to the floor.',               701),
  ('Landmine lateral squat',      'Legs',       'Landmine', 'Intermediate. Hold the bar end at the chest, shift your weight to one side into a deep lateral squat, keeping the other leg straight.',  702),
  ('Landmine deadlift',           'Back',       'Landmine', 'Beginner. Stand over the bar end, hinge and grip it with both hands, drive the hips forward to stand tall.',                  703),
  ('Landmine hip hinge',          'Lower back', 'Landmine', 'Beginner. Hold bar end with both hands at the hips, hinge with a flat back and feel the hamstrings load, then stand.',        704),
  ('Landmine chest press',        'Chest',      'Landmine', 'Intermediate. Lie on the floor, hold bar end at the chest with one hand, press it up and forward until the arm is straight.', 705),
  ('Landmine anti-rotation press','Core',       'Landmine', 'Intermediate. Hold bar end with both hands, arms extended, step sideways and resist rotation as you press and hold.',         706),
  ('Landmine rotational press',   'Shoulders',  'Landmine', 'Advanced. Hold bar end at the hip, sweep it up in an arc and press overhead, rotating through the hips and core.',            707),
  ('Landmine good morning',       'Lower back', 'Landmine', 'Intermediate. Rest the bar end on the upper traps, hinge forward with a flat back to near parallel, drive the hips forward.', 708),
  ('Landmine biceps curl',        'Arms',       'Landmine', 'Beginner. Hold the bar end with an underhand grip, curl it toward the shoulder keeping the elbow fixed at the side.',         709),
  ('Landmine triceps extension',  'Arms',       'Landmine', 'Intermediate. Hold bar end overhead with both hands, lower it behind the head by bending the elbows, press back up.',         710),
  ('Landmine windmill',           'Core',       'Landmine', 'Advanced. Press bar end overhead in one arm, hinge to the side and reach the free hand toward the foot, eyes on the bar.',    711),
  ('Landmine hip thrust',         'Glutes',     'Landmine', 'Intermediate. Sit against a bench, place the bar end on the hips, drive up explosively and squeeze the glutes at the top.',   712),
  ('Landmine lateral raise',      'Shoulders',  'Landmine', 'Intermediate. Hold bar end in one hand at the side, raise the arm out to shoulder height in a controlled arc, lower slowly.', 713),
  ('Landmine 180',                'Core',       'Landmine', 'Intermediate. Hold bar end with both hands, swing it side to side in a wide arc, pivoting the feet and rotating the core.',   714)
)
insert into public.exercises (name, muscle_group, equipment, how_to, sort)
select n.name, n.muscle_group, n.equipment, n.how_to, n.sort
from new_rows n
where not exists (select 1 from public.exercises e where lower(e.name) = lower(n.name));
