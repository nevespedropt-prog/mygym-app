/* MY GYM London — data layer
   One API, two backends: real Supabase (when config.js is filled in)
   or on-device demo mode (localStorage) so the app is testable/previewable
   before the backend is connected. */
(function () {
  'use strict';

  const CFG = window.MYGYM_CONFIG || {};
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const sb = LIVE ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  /* ================= demo backend (localStorage) ================= */
  const DK = 'mygym_demo_';
  const dGet = (k, d) => { try { return JSON.parse(localStorage.getItem(DK + k)) ?? d; } catch (e) { return d; } };
  const dSet = (k, v) => localStorage.setItem(DK + k, JSON.stringify(v));
  const uid = () => 'demo-' + Math.random().toString(36).slice(2, 10);

  const DEMO_CLASSES = [
    { id: 1, day_name: 'Monday', start_time: '07:00', name: 'Cardio n Abs', coach: '', info: '30 min', capacity: 10 },
    { id: 2, day_name: 'Monday', start_time: '07:30', name: 'HIIT', coach: '', info: '30 min', capacity: 10 },
    { id: 3, day_name: 'Monday', start_time: '09:00', name: 'BoxFit', coach: '', info: '30 min', capacity: 10 },
    { id: 4, day_name: 'Monday', start_time: '09:30', name: 'Strength', coach: '', info: '30 min', capacity: 10 },
    { id: 5, day_name: 'Monday', start_time: '10:00', name: 'Vitality 50+ Circuit', coach: '', info: '1 hr', capacity: 10 },
    { id: 6, day_name: 'Monday', start_time: '18:00', name: 'Cardio n Abs', coach: '', info: '1 hr', capacity: 10 },
    { id: 7, day_name: 'Monday', start_time: '18:30', name: 'Pilates', coach: '', info: '1 hr', capacity: 15 },
    { id: 8, day_name: 'Monday', start_time: '19:00', name: 'Strength', coach: '', info: '1 hr', capacity: 10 },
    { id: 9, day_name: 'Tuesday', start_time: '09:00', name: 'HIIT', coach: '', info: '30 min', capacity: 10 },
    { id: 10, day_name: 'Tuesday', start_time: '09:30', name: 'Cardio n Abs', coach: '', info: '30 min', capacity: 10 },
    { id: 11, day_name: 'Tuesday', start_time: '18:00', name: 'Abs Attack', coach: '', info: '1 hr', capacity: 10 },
    { id: 12, day_name: 'Wednesday', start_time: '07:00', name: 'HIIT Glow', coach: '', info: '30 min', capacity: 10 },
    { id: 13, day_name: 'Wednesday', start_time: '07:30', name: 'Cardio n Abs', coach: '', info: '30 min', capacity: 10 },
    { id: 14, day_name: 'Wednesday', start_time: '09:00', name: 'BoxFit', coach: '', info: '30 min', capacity: 10 },
    { id: 15, day_name: 'Wednesday', start_time: '09:30', name: 'Strength', coach: '', info: '30 min', capacity: 10 },
    { id: 16, day_name: 'Wednesday', start_time: '18:00', name: 'Strength', coach: '', info: '1 hr', capacity: 10 },
    { id: 17, day_name: 'Wednesday', start_time: '19:00', name: 'BoxFit', coach: '', info: '30 min', capacity: 10 },
    { id: 18, day_name: 'Thursday', start_time: '09:00', name: 'HIIT', coach: '', info: '30 min', capacity: 10 },
    { id: 19, day_name: 'Thursday', start_time: '09:30', name: 'Cardio n Abs', coach: '', info: '30 min', capacity: 10 },
    { id: 20, day_name: 'Thursday', start_time: '18:00', name: 'HIIT', coach: '', info: '1 hr', capacity: 10 },
    { id: 21, day_name: 'Friday', start_time: '07:00', name: 'Strength', coach: '', info: '30 min', capacity: 10 },
    { id: 22, day_name: 'Friday', start_time: '07:30', name: 'Abs Attack', coach: '', info: '30 min', capacity: 10 },
    { id: 23, day_name: 'Friday', start_time: '09:00', name: 'Cardio n Abs', coach: '', info: '30 min', capacity: 10 },
    { id: 24, day_name: 'Friday', start_time: '09:30', name: 'Strength', coach: '', info: '30 min', capacity: 10 },
    { id: 25, day_name: 'Friday', start_time: '10:00', name: 'Vitality 50+ Circuit', coach: '', info: '1 hr', capacity: 10 },
    { id: 26, day_name: 'Friday', start_time: '18:30', name: 'Body Conditioning', coach: '', info: '1 hr', capacity: 10 },
    { id: 27, day_name: 'Friday', start_time: '19:00', name: 'Body Conditioning', coach: '', info: '1 hr', capacity: 10 },
    { id: 28, day_name: 'Saturday', start_time: '10:00', name: 'Strength', coach: '', info: '1 hr', capacity: 10 },
    { id: 29, day_name: 'Sunday', start_time: '09:00', name: 'Strength', coach: '', info: '1 hr', capacity: 10 }
  ];
  /* demo open-gym hours: one-hour slots, 6 spaces each (Mon-Fri 7am-9pm, Sat 7am-5pm, Sun 7am-4pm) */
  (function () {
    const hours = { Monday: [7, 20], Tuesday: [7, 20], Wednesday: [7, 20], Thursday: [7, 20], Friday: [7, 20], Saturday: [7, 16], Sunday: [7, 15] };
    let id = 1000;
    Object.keys(hours).forEach((day) => {
      for (let h = hours[day][0]; h <= hours[day][1]; h++) {
        DEMO_CLASSES.push({ id: id++, kind: 'gym', day_name: day, start_time: String(h).padStart(2, '0') + ':00', name: 'Open Gym', coach: '', info: '', capacity: 6 });
      }
    });
  })();
  const DEMO_EXERCISES = [
    {"name": "Barbell back squat", "muscle_group": "Legs", "equipment": "Barbell", "how_to": "Bar on upper back, brace, sit down between the hips, drive up through mid-foot.", "sort": 1},
    {"name": "Goblet squat", "muscle_group": "Legs", "equipment": "Kettlebell", "how_to": "Hold a kettlebell at the chest, elbows inside the knees, squat to depth with an upright torso.", "sort": 2},
    {"name": "Smith squat", "muscle_group": "Legs", "equipment": "Smith bar", "how_to": "Feet slightly forward of the bar, brace, sit down between the hips and drive up through mid-foot.", "sort": 3},
    {"name": "Smith split squat", "muscle_group": "Legs", "equipment": "Smith bar", "how_to": "Back foot on a bench or the floor, lower the back knee towards the floor, push through the front heel.", "sort": 4},
    {"name": "Romanian deadlift", "muscle_group": "Legs", "equipment": "Barbell", "how_to": "Soft knees, push hips back with a flat back until the hamstrings stretch, then stand tall.", "sort": 5},
    {"name": "Walking lunge", "muscle_group": "Legs", "equipment": "Dumbbell", "how_to": "Long step, back knee towards the floor, push through the front heel into the next step.", "sort": 6},
    {"name": "Calf raise", "muscle_group": "Legs", "equipment": "Dumbbell", "how_to": "Hold dumbbells, rise onto the balls of the feet, pause at the top, lower slowly.", "sort": 7},
    {"name": "Hip thrust", "muscle_group": "Glutes", "equipment": "Barbell", "how_to": "Upper back on a bench, bar over hips, drive hips up and squeeze at the top.", "sort": 8},
    {"name": "Smith hip thrust", "muscle_group": "Glutes", "equipment": "Smith bar", "how_to": "Upper back on a bench, bar across the hips, drive up and squeeze the glutes at the top.", "sort": 9},
    {"name": "Cable pull-through", "muscle_group": "Glutes", "equipment": "Cable", "how_to": "Face away from a low pulley, rope between the legs, hinge back and snap the hips forward.", "sort": 10},
    {"name": "Glute bridge", "muscle_group": "Glutes", "equipment": "Bodyweight", "how_to": "Lie on your back, feet flat, lift hips until shoulders, hips and knees line up.", "sort": 11},
    {"name": "Conventional deadlift", "muscle_group": "Back", "equipment": "Barbell", "how_to": "Bar over mid-foot, flat back, push the floor away and stand up with the bar close to the legs.", "sort": 12},
    {"name": "Pull-up", "muscle_group": "Back", "equipment": "Pull-up bar", "how_to": "Hang with hands just wider than shoulders, pull the chest to the bar, lower under control.", "sort": 13},
    {"name": "Lat pulldown", "muscle_group": "Back", "equipment": "Cable", "how_to": "Pull the bar to the upper chest, elbows down and back, control the way up.", "sort": 14},
    {"name": "Bent-over row", "muscle_group": "Back", "equipment": "Barbell", "how_to": "Hinge to a flat back, pull the bar to the lower ribs, squeeze the shoulder blades.", "sort": 15},
    {"name": "Seated cable row", "muscle_group": "Back", "equipment": "Cable", "how_to": "Sit tall, pull the handle to the stomach, keep shoulders down, pause, then return slowly.", "sort": 16},
    {"name": "Single-arm cable row", "muscle_group": "Back", "equipment": "Cable", "how_to": "Stand or kneel facing a low or mid pulley, pull the handle to the hip, keep the torso still.", "sort": 17},
    {"name": "Single-arm dumbbell row", "muscle_group": "Back", "equipment": "Dumbbell", "how_to": "Hand and knee on a bench, pull the dumbbell to the hip without twisting.", "sort": 18},
    {"name": "Face pull", "muscle_group": "Shoulders", "equipment": "Cable", "how_to": "Rope at face height, pull towards the eyes with elbows high and hands apart.", "sort": 19},
    {"name": "Bench press", "muscle_group": "Chest", "equipment": "Barbell", "how_to": "Shoulder blades tucked, lower the bar to the mid-chest, press up over the shoulders.", "sort": 20},
    {"name": "Smith bench press", "muscle_group": "Chest", "equipment": "Smith bar", "how_to": "Bench under the bar, shoulder blades tucked, lower to the mid-chest and press up.", "sort": 21},
    {"name": "Incline dumbbell press", "muscle_group": "Chest", "equipment": "Dumbbell", "how_to": "Bench at 30 degrees, lower to chest level, press up and slightly together.", "sort": 22},
    {"name": "Push-up", "muscle_group": "Chest", "equipment": "Bodyweight", "how_to": "Hands under shoulders, body in a straight line, chest to the floor, push back up.", "sort": 23},
    {"name": "Cable fly", "muscle_group": "Chest", "equipment": "Cable", "how_to": "Slight elbow bend, bring the handles together in a wide arc, stretch slowly on the way back.", "sort": 24},
    {"name": "Overhead press", "muscle_group": "Shoulders", "equipment": "Barbell", "how_to": "Brace the core, press the bar straight overhead, head through at the top.", "sort": 25},
    {"name": "Smith shoulder press", "muscle_group": "Shoulders", "equipment": "Smith bar", "how_to": "Seated bench under the bar, lower to chin height, press straight up without locking out hard.", "sort": 26},
    {"name": "Lateral raise", "muscle_group": "Shoulders", "equipment": "Dumbbell", "how_to": "Lift dumbbells out to the sides to shoulder height, lead with the elbows, lower slowly.", "sort": 27},
    {"name": "Cable lateral raise", "muscle_group": "Shoulders", "equipment": "Cable", "how_to": "Stand side-on to a low pulley, raise the handle out to shoulder height, lower under control.", "sort": 28},
    {"name": "Biceps curl", "muscle_group": "Arms", "equipment": "Dumbbell", "how_to": "Elbows pinned to the sides, curl up, squeeze, lower for a count of three.", "sort": 29},
    {"name": "Cable biceps curl", "muscle_group": "Arms", "equipment": "Cable", "how_to": "Low pulley with the bar or handle, elbows pinned, curl up and lower slowly.", "sort": 30},
    {"name": "Hammer curl", "muscle_group": "Arms", "equipment": "Dumbbell", "how_to": "Palms facing in, curl without swinging, keep wrists neutral.", "sort": 31},
    {"name": "Triceps pushdown", "muscle_group": "Arms", "equipment": "Cable", "how_to": "Elbows tight to the ribs, push the handle down until the arms are straight.", "sort": 32},
    {"name": "Overhead triceps extension", "muscle_group": "Arms", "equipment": "Dumbbell", "how_to": "Hold one dumbbell overhead with both hands, lower behind the head, extend.", "sort": 33},
    {"name": "Plank", "muscle_group": "Core", "equipment": "Bodyweight", "how_to": "Forearms down, body in a straight line, squeeze glutes and abs, breathe steadily.", "sort": 34},
    {"name": "Dead bug", "muscle_group": "Core", "equipment": "Bodyweight", "how_to": "On your back, lower opposite arm and leg while the lower back stays flat to the floor.", "sort": 35},
    {"name": "Hanging knee raise", "muscle_group": "Core", "equipment": "Pull-up bar", "how_to": "Hang from a bar, lift the knees to the chest without swinging, lower slowly.", "sort": 36},
    {"name": "Cable crunch", "muscle_group": "Core", "equipment": "Cable", "how_to": "Kneel under a high pulley with the rope at the head, curl the ribs towards the hips, return slowly.", "sort": 37},
    {"name": "Cable woodchop", "muscle_group": "Core", "equipment": "Cable", "how_to": "Pulley set high or low, rotate through the torso and pull the handle across the body with straight arms.", "sort": 38},
    {"name": "Russian twist", "muscle_group": "Core", "equipment": "Dumbbell", "how_to": "Lean back slightly, feet raised or down, rotate the weight side to side.", "sort": 39},
    {"name": "Kettlebell swing", "muscle_group": "Full body", "equipment": "Kettlebell", "how_to": "Hinge, snap the hips forward and float the bell to chest height, let it fall back between the legs.", "sort": 40},
    {"name": "Farmer carry", "muscle_group": "Full body", "equipment": "Dumbbell", "how_to": "Hold heavy dumbbells at your sides, stand tall and walk with short, steady steps.", "sort": 41},
    {"name":"Dumbbell bench press","muscle_group":"Chest","equipment":"Dumbbell","how_to":"Lie on a bench, lower the dumbbells to the sides of the chest, press up over the shoulders.","sort":42},
    {"name":"Standing cable chest press","muscle_group":"Chest","equipment":"Cable","how_to":"Stand in a split stance between two high or mid pulleys, press the handles forward until the arms are straight.","sort":43},
    {"name":"Wall push-up","muscle_group":"Chest","equipment":"Bodyweight","how_to":"Hands on a wall at chest height, lower the chest towards the wall and push back.","sort":44},
    {"name":"Dumbbell shoulder press","muscle_group":"Shoulders","equipment":"Dumbbell","how_to":"Sit or stand tall, press the dumbbells from shoulder height to overhead without arching the back.","sort":45},
    {"name":"Cable reverse fly","muscle_group":"Shoulders","equipment":"Cable","how_to":"Cross the pulleys, pull the handles out and back with soft elbows, squeezing the rear shoulders.","sort":46},
    {"name":"Kettlebell halo","muscle_group":"Shoulders","equipment":"Kettlebell","how_to":"Hold the kettlebell upside down at the chest and circle it around the head, keeping the ribs down.","sort":47},
    {"name":"Smith bent-over row","muscle_group":"Back","equipment":"Smith bar","how_to":"Hinge to a flat back with the bar below the knees, pull to the lower ribs and lower slowly.","sort":48},
    {"name":"Chin-up","muscle_group":"Back","equipment":"Pull-up bar","how_to":"Palms facing you, hang with straight arms, pull the chin over the bar and lower under control.","sort":49},
    {"name":"Superman hold","muscle_group":"Back","equipment":"Bodyweight","how_to":"Lie face down, lift arms and legs a few centimetres and hold, squeezing the back and glutes.","sort":50},
    {"name":"Dumbbell Romanian deadlift","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Soft knees, push the hips back with the dumbbells close to the legs until the hamstrings stretch, then stand tall.","sort":51},
    {"name":"Smith Romanian deadlift","muscle_group":"Legs","equipment":"Smith bar","how_to":"Soft knees, slide the bar down the thighs as the hips go back, flat back, then drive the hips forward.","sort":52},
    {"name":"Kettlebell deadlift","muscle_group":"Legs","equipment":"Kettlebell","how_to":"Kettlebell between the feet, hinge with a flat back, push the floor away and stand tall.","sort":53},
    {"name":"Bulgarian split squat","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Back foot on a bench, dumbbells at the sides, lower the back knee towards the floor and drive up through the front heel.","sort":54},
    {"name":"Dumbbell step-up","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Place one foot fully on a bench, drive up through that heel, lower slowly and repeat on both legs.","sort":55},
    {"name":"Reverse lunge","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Step back, lower the back knee towards the floor, push through the front heel to return.","sort":56},
    {"name":"Sit-to-stand","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Sit on a bench, lean slightly forward and stand up without using the hands, then sit back slowly.","sort":57},
    {"name":"Pallof press","muscle_group":"Core","equipment":"Cable","how_to":"Stand side-on to a mid pulley, handle at the chest, press straight out and resist the twist.","sort":58},
    {"name":"Mountain climbers","muscle_group":"Core","equipment":"Bodyweight","how_to":"In a high plank, drive the knees in quickly one at a time, hips low and steady.","sort":59},
    {"name":"Bicycle crunch","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back, bring opposite elbow to knee while the other leg extends, alternate slowly.","sort":60},
    {"name":"Kettlebell clean and press","muscle_group":"Full body","equipment":"Kettlebell","how_to":"Swing the bell to the shoulder in one smooth pull, then press it overhead and lower with control.","sort":61},
    {"name":"Dumbbell thruster","muscle_group":"Full body","equipment":"Dumbbell","how_to":"Squat with the dumbbells at the shoulders, then stand and press them overhead in one movement.","sort":62},
    {"name":"Treadmill walk","muscle_group":"Cardio","equipment":"Treadmill","how_to":"Walk at a brisk pace with a small incline, arms swinging naturally, stand tall and do not hold the rails.","sort":63},
    {"name":"Treadmill incline walk","muscle_group":"Cardio","equipment":"Treadmill","how_to":"Set a steep incline and a steady walking pace, keep the chest up and take full strides.","sort":64},
    {"name":"Treadmill intervals","muscle_group":"Cardio","equipment":"Treadmill","how_to":"Alternate 30 seconds of fast running with 60 seconds of easy walking, step off the sides if you need to stop.","sort":65},
    {"name":"Exercise bike ride","muscle_group":"Cardio","equipment":"Exercise bike","how_to":"Set the saddle at hip height, keep a smooth pace you can chat at, back straight and shoulders relaxed.","sort":66},
    {"name":"Exercise bike intervals","muscle_group":"Cardio","equipment":"Exercise bike","how_to":"Alternate 30 seconds of hard pedalling with 60 seconds of easy spinning.","sort":67},
    {"name":"Rowing machine","muscle_group":"Cardio","equipment":"Rowing machine","how_to":"Push with the legs first, then lean back and pull the handle to the ribs; return arms, body, then legs.","sort":68},
    {"name":"Rowing intervals","muscle_group":"Cardio","equipment":"Rowing machine","how_to":"Row hard for 1 minute at a strong, steady stroke rate, then row easily for 1 minute.","sort":69},
    {"name":"Air bike sprints","muscle_group":"Cardio","equipment":"Air bike","how_to":"Push and pull the handles while pedalling, go all out for the work time, then recover with easy pedalling.","sort":70},
    {"name":"Sled push","muscle_group":"Cardio","equipment":"Sled","how_to":"Hands on the uprights, low hips, drive the sled forward with short, powerful steps.","sort":71},
    {"name":"Sled pull","muscle_group":"Cardio","equipment":"Sled","how_to":"Hold the rope or straps, walk backwards or lean back and pull hand over hand to bring the sled to you.","sort":72},
    {"name":"Battle rope waves","muscle_group":"Cardio","equipment":"Battle rope","how_to":"Athletic stance, brace the core and whip both ends up and down in fast alternating waves.","sort":73},
    {"name":"Medicine ball slam","muscle_group":"Cardio","equipment":"Medicine ball","how_to":"Lift the ball overhead, then slam it down hard in front of your feet, squat to pick it up and repeat.","sort":74},
    {"name":"Jumping jacks","muscle_group":"Cardio","equipment":"Bodyweight","how_to":"Jump the feet wide while the arms go overhead, then jump back together. Step out one leg at a time for a low-impact version.","sort":75},
    {"name":"Boxing rounds","muscle_group":"Cardio","equipment":"Boxing bag","how_to":"Hands up, stay light on the feet and throw jab, cross and hook combinations for the full round.","sort":76},
    {"name":"Treadmill run","muscle_group":"Cardio","equipment":"Treadmill","how_to":"Run at a steady pace you can breathe at, land softly under the hips and keep the shoulders relaxed.","sort":77},
    {"name":"Skipping","muscle_group":"Cardio","equipment":"Skipping rope","how_to":"Turn the rope from the wrists and jump low on the balls of the feet, one jump per turn.","sort":78},
    {"name":"Burpee","muscle_group":"Cardio","equipment":"Bodyweight","how_to":"Squat down, kick the feet back to a plank, chest to the floor, jump the feet in and finish with a jump.","sort":79},
    {"name":"Box jump","muscle_group":"Cardio","equipment":"Box","how_to":"Swing the arms, jump up onto the box with both feet and land softly, then step back down.","sort":80},
    {"name":"Broad jump","muscle_group":"Cardio","equipment":"Bodyweight","how_to":"Swing the arms, jump forward as far as you can and land softly with bent knees.","sort":81},
    {"name":"Jump squat","muscle_group":"Cardio","equipment":"Bodyweight","how_to":"Squat down, then explode up into a jump and land softly straight into the next squat.","sort":82},
    {"name":"High knees","muscle_group":"Cardio","equipment":"Bodyweight","how_to":"Run on the spot driving the knees up to hip height, pumping the arms.","sort":83},
    {"name":"Agility ladder drills","muscle_group":"Cardio","equipment":"Bodyweight","how_to":"Move quickly through the agility ladder with fast, light foot patterns, one foot in each square.","sort":84},
    {"name":"Side shuffles","muscle_group":"Cardio","equipment":"Bodyweight","how_to":"In a half squat, shuffle sideways without crossing the feet, then return the same way.","sort":85},
    {"name":"Landmine punch","muscle_group":"Cardio","equipment":"Landmine","how_to":"Hold the end of the bar at the shoulder and punch it up and forward, rotating the hips.","sort":86},
    {"name":"Power bag drag","muscle_group":"Full body","equipment":"Power bag","how_to":"Grip the bag, stay low and drag or pull it across the floor in a straight line.","sort":87},
    {"name":"Bodyweight squat","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Feet shoulder-width apart, sit the hips back and down, chest tall, then stand up.","sort":88},
    {"name":"TRX squat","muscle_group":"Legs","equipment":"TRX","how_to":"Hold the TRX handles, lean back with straight arms and squat down, using the straps for balance.","sort":89},
    {"name":"Dumbbell squat","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Hold dumbbells at the sides or shoulders, squat to depth with an upright chest and drive up.","sort":90},
    {"name":"Kettlebell front squat","muscle_group":"Legs","equipment":"Kettlebell","how_to":"Rack the kettlebell at the shoulder, elbow in, and squat down keeping the torso upright.","sort":91},
    {"name":"Front squat","muscle_group":"Legs","equipment":"Barbell","how_to":"Bar across the front of the shoulders, elbows high, squat to depth and drive up.","sort":92},
    {"name":"Sumo squat","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Wide stance, toes out, hold one dumbbell between the legs and squat straight down.","sort":93},
    {"name":"Bosu squat","muscle_group":"Legs","equipment":"Bosu","how_to":"Stand on the Bosu, or on the flat side, and squat slowly while keeping the knees steady.","sort":94},
    {"name":"Squat hold","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Sit into the bottom of a squat and hold it still, chest up, weight through the heels.","sort":95},
    {"name":"Squat pulse","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Stay low in a squat and make small up-and-down pulses without standing all the way up.","sort":96},
    {"name":"Wall sit","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Back flat on the wall, thighs parallel to the floor, hold the position.","sort":97},
    {"name":"Side lunge","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Step wide to the side, sit back into that hip with the other leg straight, push back to the middle.","sort":98},
    {"name":"Dumbbell side lunge","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Hold a dumbbell at the chest, step wide to the side and sit back into the hip, push back to the middle.","sort":99},
    {"name":"TRX side lunge","muscle_group":"Legs","equipment":"TRX","how_to":"Hold the TRX handles for balance, step to the side into a lunge and push back to the middle.","sort":100},
    {"name":"Dumbbell lunge","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Dumbbells at the sides, step forward or back into a lunge, lower the back knee and return.","sort":101},
    {"name":"Lunge and curl","muscle_group":"Legs","equipment":"Dumbbell","how_to":"Lower into a lunge, and as you stand up curl the dumbbells to the shoulders.","sort":102},
    {"name":"Lunge and press","muscle_group":"Full body","equipment":"Dumbbell","how_to":"Lunge forward or to the side with the dumbbells at the shoulders, and press them overhead as you stand up.","sort":103},
    {"name":"Reverse lunge with knee drive","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Step back into a lunge, then drive the back knee up to hip height as you stand.","sort":104},
    {"name":"Smith lunge","muscle_group":"Legs","equipment":"Smith bar","how_to":"Bar on the upper back, step forward or back into a lunge and push through the front heel.","sort":105},
    {"name":"Smith deadlift","muscle_group":"Legs","equipment":"Smith bar","how_to":"Feet under the bar, hinge with a flat back, grip and stand up, sliding the bar up the legs.","sort":106},
    {"name":"Sumo deadlift","muscle_group":"Legs","equipment":"Barbell","how_to":"Wide stance, toes out, grip inside the knees, push the floor away and stand tall.","sort":107},
    {"name":"Shoulder bridge","muscle_group":"Glutes","equipment":"Bodyweight","how_to":"Lie on your back, feet flat, lift the hips until shoulders, hips and knees line up and squeeze the glutes.","sort":108},
    {"name":"Single-leg hip raise","muscle_group":"Glutes","equipment":"Bodyweight","how_to":"Lie on your back with one foot on the floor and the other leg straight, lift the hips and lower slowly.","sort":109},
    {"name":"Cable hamstring curl","muscle_group":"Legs","equipment":"Cable","how_to":"Strap the cable to the ankle, face the machine and curl the heel towards the glute, return slowly.","sort":110},
    {"name":"Side-lying inner thigh raise","muscle_group":"Legs","equipment":"Bodyweight","how_to":"Lie on your side with the top leg bent in front and lift the bottom leg up and down.","sort":111},
    {"name":"Donkey kick","muscle_group":"Glutes","equipment":"Bodyweight","how_to":"On hands and knees, kick one heel up towards the ceiling, keeping the back flat, and lower slowly.","sort":112},
    {"name":"Fire hydrant","muscle_group":"Glutes","equipment":"Bodyweight","how_to":"On hands and knees, lift one knee out to the side to hip height without rotating the back.","sort":113},
    {"name":"Glute kickback","muscle_group":"Glutes","equipment":"Bodyweight","how_to":"On hands and knees, or standing, kick one leg back and squeeze the glute at the top.","sort":114},
    {"name":"TRX squat and row","muscle_group":"Full body","equipment":"TRX","how_to":"Lean back on the straps, squat down, then stand and row the handles to the chest in one movement.","sort":115},
    {"name":"Good morning","muscle_group":"Back","equipment":"Barbell","how_to":"Bar on the upper back, soft knees, push the hips back until the torso is near parallel, then stand.","sort":116},
    {"name":"Incline Smith press","muscle_group":"Chest","equipment":"Smith bar","how_to":"Bench at 30 degrees under the bar, lower to the upper chest and press up.","sort":117},
    {"name":"Incline barbell press","muscle_group":"Chest","equipment":"Barbell","how_to":"Bench at 30 degrees, lower the bar to the upper chest and press up over the shoulders.","sort":118},
    {"name":"Reverse-grip dumbbell press","muscle_group":"Chest","equipment":"Dumbbell","how_to":"Palms facing you, lower the dumbbells to the chest and press up, elbows tucked in.","sort":119},
    {"name":"Close-grip dumbbell press","muscle_group":"Chest","equipment":"Dumbbell","how_to":"Dumbbells touching, press them up from the chest with the elbows in, squeezing the chest and triceps.","sort":120},
    {"name":"Dumbbell fly","muscle_group":"Chest","equipment":"Dumbbell","how_to":"Lie on a bench, open the arms wide with soft elbows until you feel a stretch, then bring them together.","sort":121},
    {"name":"Cable crossover","muscle_group":"Chest","equipment":"Cable","how_to":"Stand between high pulleys, step forward and bring the handles down and together in front of the hips.","sort":122},
    {"name":"Knee push-up","muscle_group":"Chest","equipment":"Bodyweight","how_to":"Hands under shoulders and knees on the floor, body straight from knees to head, lower the chest and push back.","sort":123},
    {"name":"TRX push-up","muscle_group":"Chest","equipment":"TRX","how_to":"Hands in the TRX handles, body in a straight line, lower the chest between the hands and push back.","sort":124},
    {"name":"Dip","muscle_group":"Chest","equipment":"Bodyweight","how_to":"Grip the dip bars, lower until the elbows are at 90 degrees and press back up.","sort":125},
    {"name":"Bench dip","muscle_group":"Arms","equipment":"Bodyweight","how_to":"Hands on a bench behind you, lower the hips by bending the elbows, then press back up.","sort":126},
    {"name":"Lying triceps extension","muscle_group":"Arms","equipment":"Dumbbell","how_to":"Lie on a bench, bend the elbows to lower the weights beside the head, then extend the arms.","sort":127},
    {"name":"Triceps kickback","muscle_group":"Arms","equipment":"Dumbbell","how_to":"Hinge forward with the upper arm parallel to the floor and straighten the elbow behind you.","sort":128},
    {"name":"Arnold press","muscle_group":"Shoulders","equipment":"Dumbbell","how_to":"Start with palms facing you at the chest and rotate them forward as you press the dumbbells overhead.","sort":129},
    {"name":"Dumbbell floor press","muscle_group":"Chest","equipment":"Dumbbell","how_to":"Lie on the floor, lower the dumbbells until the upper arms touch the floor and press up.","sort":130},
    {"name":"Plate press","muscle_group":"Chest","equipment":"Plate","how_to":"Hold a plate at the chest and press it straight out in front, squeezing the chest.","sort":131},
    {"name":"Glute bridge press","muscle_group":"Chest","equipment":"Dumbbell","how_to":"Hold a bridge on your back and press the dumbbells up from the chest.","sort":132},
    {"name":"Renegade row","muscle_group":"Back","equipment":"Dumbbell","how_to":"In a push-up position on the dumbbells, row one dumbbell to the hip while keeping the hips still.","sort":133},
    {"name":"Straight-arm pulldown","muscle_group":"Back","equipment":"Cable","how_to":"Stand facing a high pulley, arms straight, press the bar or rope down to the thighs and return slowly.","sort":134},
    {"name":"TRX row","muscle_group":"Back","equipment":"TRX","how_to":"Lean back holding the TRX handles, body straight, pull the chest to the hands and lower slowly.","sort":135},
    {"name":"Landmine row","muscle_group":"Back","equipment":"Landmine","how_to":"Straddle the bar, hinge to a flat back and row the end of the bar to the chest.","sort":136},
    {"name":"Dumbbell bent-over row","muscle_group":"Back","equipment":"Dumbbell","how_to":"Hinge to a flat back and row both dumbbells to the hips, squeezing the shoulder blades.","sort":137},
    {"name":"Inverted row","muscle_group":"Back","equipment":"Smith bar","how_to":"Lie under a low bar, grip it and pull the chest to the bar with the body straight.","sort":138},
    {"name":"Dumbbell reverse fly","muscle_group":"Shoulders","equipment":"Dumbbell","how_to":"Hinge forward, or lie on an incline bench, and raise the dumbbells out to the sides with soft elbows.","sort":139},
    {"name":"TRX reverse fly","muscle_group":"Shoulders","equipment":"TRX","how_to":"Lean back holding the TRX handles and open the arms wide, squeezing the shoulder blades.","sort":140},
    {"name":"Back extension","muscle_group":"Back","equipment":"Bodyweight","how_to":"Face down over a bench or bench edge, lift the chest until the body is straight and lower slowly.","sort":141},
    {"name":"Dumbbell pullover","muscle_group":"Back","equipment":"Dumbbell","how_to":"Lie across a bench holding one dumbbell, lower it back over the head with straight arms and pull it over the chest.","sort":142},
    {"name":"Swimmers","muscle_group":"Back","equipment":"Bodyweight","how_to":"Lie face down and alternate lifting opposite arm and leg in a flutter-style swimming motion.","sort":143},
    {"name":"Upright row","muscle_group":"Shoulders","equipment":"Barbell","how_to":"Pull the bar up close to the body to chest height, elbows leading, and lower slowly.","sort":144},
    {"name":"Dumbbell front raise","muscle_group":"Shoulders","equipment":"Dumbbell","how_to":"Raise the dumbbell straight in front to shoulder height and lower slowly.","sort":145},
    {"name":"Rotator cuff external rotation","muscle_group":"Shoulders","equipment":"Cable","how_to":"Elbow at your side bent to 90 degrees, rotate the hand outwards against the light cable, then return.","sort":146},
    {"name":"Dumbbell shrug","muscle_group":"Shoulders","equipment":"Dumbbell","how_to":"Hold the dumbbells at the sides and lift the shoulders straight up to the ears, pause and lower.","sort":147},
    {"name":"Incline dumbbell curl","muscle_group":"Arms","equipment":"Dumbbell","how_to":"Sit back on an incline bench with the arms hanging, curl the dumbbells up and lower slowly.","sort":148},
    {"name":"Barbell curl","muscle_group":"Arms","equipment":"Barbell","how_to":"Elbows pinned to the sides, curl the bar to the shoulders and lower under control.","sort":149},
    {"name":"Cable rope curl","muscle_group":"Arms","equipment":"Cable","how_to":"Hold the rope at a low pulley and curl to the shoulders, keeping the elbows still.","sort":150},
    {"name":"Cable forearm curl","muscle_group":"Arms","equipment":"Cable","how_to":"Rest the forearm on the thigh or bench and curl the wrist up against the low cable.","sort":151},
    {"name":"TRX biceps curl","muscle_group":"Arms","equipment":"TRX","how_to":"Lean back holding the TRX handles with palms up and curl the hands to the head.","sort":152},
    {"name":"Curl and press","muscle_group":"Arms","equipment":"Dumbbell","how_to":"Curl the dumbbells to the shoulders and press straight into an overhead press, then lower.","sort":153},
    {"name":"Dumbbell clean and press","muscle_group":"Full body","equipment":"Dumbbell","how_to":"Pull the dumbbells from the floor to the shoulders in one move, then press them overhead.","sort":154},
    {"name":"Barbell clean and press","muscle_group":"Full body","equipment":"Barbell","how_to":"Pull the bar from the floor to the shoulders in one explosive move, then press it overhead.","sort":155},
    {"name":"Leg drop","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back with the legs straight up, lower them slowly towards the floor without arching the back.","sort":156},
    {"name":"Medicine ball sit-up","muscle_group":"Core","equipment":"Medicine ball","how_to":"Sit up holding the ball and bring it overhead or pass it to your feet at the top.","sort":157},
    {"name":"Medicine ball crunch","muscle_group":"Core","equipment":"Medicine ball","how_to":"Lie on your back with the knees bent and the ball over the knees, crunch up to meet the ball.","sort":158},
    {"name":"Sit-up","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back with the knees bent, curl all the way up to sitting and lower with control.","sort":159},
    {"name":"Side crunch","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your side or on your back and bring the elbow towards the knee on the same side.","sort":160},
    {"name":"Landmine twist","muscle_group":"Core","equipment":"Landmine","how_to":"Hold the end of the bar at the chest and rotate it from side to side with straight arms, pivoting the feet.","sort":161},
    {"name":"Bird dog","muscle_group":"Core","equipment":"Bodyweight","how_to":"On hands and knees, reach one arm and the opposite leg out long, hold, and swap sides.","sort":162},
    {"name":"Side plank","muscle_group":"Core","equipment":"Bodyweight","how_to":"On one forearm, lift the hips so the body is a straight line and hold. Drop the bottom knee to make it easier.","sort":163},
    {"name":"Plank shoulder tap","muscle_group":"Core","equipment":"Bodyweight","how_to":"In a high plank, tap each shoulder in turn while keeping the hips from rocking.","sort":164},
    {"name":"Ab rollout","muscle_group":"Core","equipment":"Barbell","how_to":"Kneel holding the wheel or barbell, roll out with a braced core and pull back without sagging the hips.","sort":165},
    {"name":"V-up","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie flat and lift the legs and chest together to meet in a V, then lower slowly.","sort":166},
    {"name":"Hanging leg raise","muscle_group":"Core","equipment":"Pull-up bar","how_to":"Hang from the bar and raise straight legs to hip height or higher, lowering without swinging.","sort":167},
    {"name":"Turkish get-up","muscle_group":"Full body","equipment":"Kettlebell","how_to":"Lie on your back holding the kettlebell overhead and stand up in controlled steps, keeping the arm straight.","sort":168},
    {"name":"Lying leg raise","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back and lift the straight legs to vertical, lowering slowly without arching.","sort":169},
    {"name":"Butterfly sit-up","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie with the soles of the feet together and the knees out, sit up and reach towards the feet.","sort":170},
    {"name":"Crunch","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back with the knees bent, lift the shoulders off the floor and lower slowly.","sort":171},
    {"name":"Flutter kicks","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back with the legs just off the floor and kick them up and down in small quick movements.","sort":172},
    {"name":"Scissor kicks","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back with the legs raised and cross them over each other in a scissor motion.","sort":173},
    {"name":"Dumbbell side bend","muscle_group":"Core","equipment":"Dumbbell","how_to":"Hold a dumbbell in one hand and lean to that side, then return upright using the opposite side of the waist.","sort":174},
    {"name":"TRX pike","muscle_group":"Core","equipment":"TRX","how_to":"Feet in the TRX straps in a plank, lift the hips up towards the ceiling and lower back down.","sort":175},
    {"name":"Ankle touches","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie with the knees bent and reach each hand to the same-side ankle with a small side crunch.","sort":176},
    {"name":"Swiss ball tuck","muscle_group":"Core","equipment":"Swiss ball","how_to":"With the feet on the ball in a plank, pull the knees in towards the chest and roll back out.","sort":177},
    {"name":"Knee tuck","muscle_group":"Core","equipment":"Bodyweight","how_to":"Lie on your back and pull the knees up to the chest, lowering the feet without touching the floor.","sort":178}
  ];

  const DEMO_TEMPLATES = [
    {"id":"t1","name":"Beginner Full-Body","level":"Beginner","goal":"General fitness","description":"Your first month at MY GYM: six simple moves with dumbbells, a kettlebell and the cable machine.","exercises":[{"name":"Treadmill walk","sets":1,"reps":"5 min"},{"name":"Goblet squat","sets":3,"reps":"10"},{"name":"Dumbbell bench press","sets":3,"reps":"10"},{"name":"Seated cable row","sets":3,"reps":"10"},{"name":"Plank","sets":3,"reps":"20 sec"},{"name":"Stretch cool-down","sets":1,"reps":"5 min"}]},
    {"id":"t2","name":"Over 50s Strength & Mobility","level":"Over 50s","goal":"Strength + mobility","description":"Bone strength, balance and mobility. Kind to joints, big on benefits.","exercises":[{"name":"Exercise bike ride","sets":1,"reps":"5 min"},{"name":"Sit-to-stand","sets":3,"reps":"8"},{"name":"Wall push-up","sets":3,"reps":"10"},{"name":"Seated cable row","sets":3,"reps":"10"},{"name":"Calf raise","sets":3,"reps":"12"},{"name":"Glute bridge","sets":2,"reps":"12"},{"name":"Chair yoga stretch","sets":1,"reps":"8 min"}]},
    {"id":"t3","name":"Fat-Burn Circuit","level":"All levels","goal":"Fat loss","description":"40 sec work / 20 sec rest, 3 rounds. Bring water and a towel.","exercises":[{"name":"Jumping jacks","sets":3,"reps":"40 sec"},{"name":"Kettlebell swing","sets":3,"reps":"40 sec"},{"name":"Push-up","sets":3,"reps":"40 sec"},{"name":"Rowing machine","sets":3,"reps":"40 sec"},{"name":"Goblet squat","sets":3,"reps":"40 sec"},{"name":"Mountain climbers","sets":3,"reps":"40 sec"},{"name":"Air bike sprints","sets":3,"reps":"40 sec"},{"name":"Bicycle crunch","sets":3,"reps":"40 sec"}]},
    {"id":"t4","name":"Strength Builder (45 min)","level":"Intermediate","goal":"Build muscle","description":"Classic barbell strength essentials for members who want to get strong.","exercises":[{"name":"Rowing machine","sets":1,"reps":"5 min"},{"name":"Barbell back squat","sets":4,"reps":"6-8"},{"name":"Bench press","sets":4,"reps":"6-8"},{"name":"Lat pulldown","sets":3,"reps":"8-10"},{"name":"Romanian deadlift","sets":3,"reps":"8-10"},{"name":"Overhead press","sets":3,"reps":"8-10"},{"name":"Farmer carry","sets":3,"reps":"30 m"}]},
    {"id":"t5","name":"Upper Body Strength","level":"Intermediate","goal":"Build muscle","description":"Push and pull for a strong chest, back and arms using barbells, the pull-up bar and cables.","exercises":[{"name":"Bench press","sets":4,"reps":"6-8"},{"name":"Pull-up","sets":3,"reps":"6-8"},{"name":"Overhead press","sets":3,"reps":"8"},{"name":"Seated cable row","sets":3,"reps":"10"},{"name":"Cable lateral raise","sets":3,"reps":"12"},{"name":"Triceps pushdown","sets":3,"reps":"12"},{"name":"Biceps curl","sets":3,"reps":"12"}]},
    {"id":"t6","name":"Lower Body & Glutes","level":"Intermediate","goal":"Legs + glutes","description":"Smith bar and dumbbell work for strong legs and glutes.","exercises":[{"name":"Smith squat","sets":4,"reps":"8"},{"name":"Dumbbell Romanian deadlift","sets":3,"reps":"10"},{"name":"Bulgarian split squat","sets":3,"reps":"10 each leg"},{"name":"Smith hip thrust","sets":4,"reps":"10"},{"name":"Cable pull-through","sets":3,"reps":"12"},{"name":"Calf raise","sets":3,"reps":"15"}]},
    {"id":"t7","name":"Dumbbell & Kettlebell Full-Body","level":"All levels","goal":"Strength + fitness","description":"A full-body session with just dumbbells and a kettlebell. Choose weights that make the last reps hard.","exercises":[{"name":"Goblet squat","sets":3,"reps":"10"},{"name":"Dumbbell bench press","sets":3,"reps":"10"},{"name":"Single-arm dumbbell row","sets":3,"reps":"10 each side"},{"name":"Dumbbell shoulder press","sets":3,"reps":"10"},{"name":"Kettlebell swing","sets":3,"reps":"15"},{"name":"Farmer carry","sets":3,"reps":"30 m"}]},
    {"id":"t8","name":"Cable Machine Sculpt","level":"All levels","goal":"Tone + shape","description":"Do these as a circuit: 12 reps each, 3 rounds, using the two cable machines.","exercises":[{"name":"Cable pull-through","sets":3,"reps":"12"},{"name":"Standing cable chest press","sets":3,"reps":"12"},{"name":"Seated cable row","sets":3,"reps":"12"},{"name":"Cable lateral raise","sets":3,"reps":"12"},{"name":"Cable biceps curl","sets":3,"reps":"12"},{"name":"Triceps pushdown","sets":3,"reps":"12"},{"name":"Cable woodchop","sets":3,"reps":"10 each side"}]},
    {"id":"t9","name":"Smith Bar Basics","level":"Beginner","goal":"Learn the lifts","description":"The Smith bar guides the bar for you, which makes it a good place to learn squat, press and row.","exercises":[{"name":"Smith squat","sets":3,"reps":"10"},{"name":"Smith bench press","sets":3,"reps":"10"},{"name":"Smith bent-over row","sets":3,"reps":"10"},{"name":"Smith shoulder press","sets":3,"reps":"10"},{"name":"Smith hip thrust","sets":3,"reps":"12"},{"name":"Plank","sets":3,"reps":"30 sec"}]},
    {"id":"t10","name":"Core & Abs (20 min)","level":"All levels","goal":"Core strength","description":"A short core session using the floor, the pull-up bar and a cable.","exercises":[{"name":"Plank","sets":3,"reps":"30 sec"},{"name":"Dead bug","sets":3,"reps":"10 each side"},{"name":"Cable crunch","sets":3,"reps":"12"},{"name":"Hanging knee raise","sets":3,"reps":"10"},{"name":"Pallof press","sets":3,"reps":"10 each side"},{"name":"Russian twist","sets":3,"reps":"20"}]},
    {"id":"t11","name":"Home Workout - No Equipment","level":"All levels","goal":"Stay active anywhere","description":"Travelling or stuck at home? 20 minutes, no kit needed.","exercises":[{"name":"Bodyweight squat","sets":3,"reps":"15"},{"name":"Push-up","sets":3,"reps":"10"},{"name":"Reverse lunge","sets":3,"reps":"10 each leg"},{"name":"Superman hold","sets":3,"reps":"20 sec"},{"name":"Glute bridge","sets":3,"reps":"15"},{"name":"Dead bug","sets":3,"reps":"10 each side"}]},
    {"id":"t12","name":"Kids Fun Fitness (ages 6-11)","level":"Kids","goal":"Confidence + coordination","description":"Games-based session: sneaky exercise, maximum giggles.","exercises":[{"name":"Animal walk warm-up","sets":1,"reps":"3 min"},{"name":"Bean bag balance relay","sets":3,"reps":"1 min"},{"name":"Star jumps challenge","sets":3,"reps":"10"},{"name":"Obstacle course","sets":3,"reps":"1 lap"},{"name":"Freeze dance cool-down","sets":1,"reps":"5 min"}]},
    {"id":"t13","name":"Cardio Conditioning (30 min)","level":"All levels","goal":"Fitness + stamina","description":"Move through the cardio kit at a pace that suits you. Steady effort, not a sprint.","exercises":[{"name":"Treadmill walk","sets":1,"reps":"5 min"},{"name":"Rowing machine","sets":1,"reps":"5 min"},{"name":"Exercise bike ride","sets":1,"reps":"5 min"},{"name":"Treadmill intervals","sets":5,"reps":"30 sec fast / 60 sec easy"},{"name":"Air bike sprints","sets":4,"reps":"20 sec hard / 40 sec easy"},{"name":"Treadmill incline walk","sets":1,"reps":"5 min"}]},
    {"id":"t14","name":"Rowing & Air Bike HIIT (20 min)","level":"Intermediate","goal":"Fat loss","description":"Short, hard intervals on the rower and air bike. Warm up first and keep your form.","exercises":[{"name":"Exercise bike ride","sets":1,"reps":"4 min"},{"name":"Rowing intervals","sets":4,"reps":"1 min hard / 1 min easy"},{"name":"Air bike sprints","sets":6,"reps":"20 sec hard / 40 sec easy"},{"name":"Rowing intervals","sets":2,"reps":"1 min hard / 1 min easy"},{"name":"Stretch cool-down","sets":1,"reps":"3 min"}]}
  ];

  /* ================= unified API ================= */
  const DB = {
    isLive: () => LIVE,

    /* ---- auth ---- */
    async signUp(email, password, fullName) {
      if (!LIVE) {
        const users = dGet('users', {});
        if (users[email]) throw new Error('An account with this email already exists');
        users[email] = { id: uid(), password, full_name: fullName || '' };
        dSet('users', users);
        dSet('session', { email });
        dSet('profile_' + email, { full_name: fullName || '', phone: '', weight_kg: null, goal: '', is_admin: false });
        return { email };
      }
      const r = await fetch(CFG.SUPABASE_URL + '/functions/v1/member-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, name: fullName || '' })
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'Could not create the account. Please try again.');
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      return { email, session: data.session };
    },

    async signIn(email, password) {
      if (!LIVE) {
        const users = dGet('users', {});
        if (!users[email] || users[email].password !== password) throw new Error('Wrong email or password');
        dSet('session', { email });
        return { email };
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { email };
    },

    async signOut() {
      if (!LIVE) { localStorage.removeItem(DK + 'session'); return; }
      await sb.auth.signOut();
    },

    async getUser() {
      if (!LIVE) { const s = dGet('session', null); return s ? { email: s.email, id: s.email } : null; }
      const { data } = await sb.auth.getUser();
      return data.user ? { email: data.user.email, id: data.user.id } : null;
    },

    async sendReset(email) {
      if (!LIVE) return;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
      if (error) throw error;
    },

    async updatePassword(password) {
      if (!LIVE) return;
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
    },

    onRecovery(cb) {
      if (!LIVE) return;
      sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') cb(); });
    },

    onAuthChange(cb) {
      if (!LIVE) { window.addEventListener('mygym-demo-auth', () => cb()); return () => {}; }
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    /* ---- profile ---- */
    async getProfile() {
      const u = await DB.getUser(); if (!u) return null;
      if (!LIVE) return Object.assign({ id: u.id, email: u.email }, dGet('profile_' + u.email, {}));
      const { data } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
      return data ? Object.assign({ email: u.email }, data) : { id: u.id, email: u.email };
    },

    async saveProfile(patch) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        const p = Object.assign(dGet('profile_' + u.email, {}), patch);
        dSet('profile_' + u.email, p); return p;
      }
      patch.updated_at = new Date().toISOString();
      const { error } = await sb.from('profiles').update(patch).eq('id', u.id);
      if (error) throw error;
      return patch;
    },

    /* ---- classes & bookings ---- */
    async getClasses() {
      if (!LIVE) return DEMO_CLASSES;
      const { data, error } = await sb.from('classes').select('*').eq('active', true).order('sort');
      if (error) throw error;
      return data;
    },

    async getBookingsForDates(dates) {
      const u = await DB.getUser();
      if (!LIVE) {
        const all = dGet('bookings_' + (u ? u.email : ''), []);
        return all.filter(b => dates.includes(b.date));
      }
      if (!u) return [];
      /* own bookings (real rows) + anonymous placeholders for everyone else's, so spot counts still work */
      const [mine, counts] = await Promise.all([
        sb.from('class_bookings').select('id,class_id,date,user_id').in('date', dates),
        sb.rpc('booking_counts', { dates })
      ]);
      if (mine.error) throw mine.error;
      if (counts.error) throw counts.error;
      const rows = mine.data.slice();
      (counts.data || []).forEach((c) => {
        const own = mine.data.filter((b) => b.class_id === c.class_id && b.date === c.date).length;
        for (let i = 0; i < c.n - own; i++) rows.push({ id: null, class_id: c.class_id, date: c.date, user_id: null });
      });
      return rows;
    },

    /* does this member have a Gym & Exercise Class plan? (the server decides; this only asks) */
    async refreshGymAccess() {
      const u = await DB.getUser(); if (!u) return false;
      if (!LIVE) return !/classonly/i.test(u.email);   // demo: any email containing "classonly" is a class-only member
      const { data } = await sb.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (!token) throw new Error('Not signed in');
      const r = await fetch(CFG.SUPABASE_URL + '/functions/v1/check-gym-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
      });
      if (!r.ok) throw new Error('check failed');
      const out = await r.json().catch(() => ({}));
      return !!out.gym_access;
    },

    async book(classId, date) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        const key = 'bookings_' + u.email;
        const all = dGet(key, []);
        if (all.some(b => b.class_id === classId && b.date === date)) throw new Error('Already booked');
        all.push({ id: uid(), class_id: classId, date, user_id: u.id });
        dSet(key, all); return;
      }
      const { error } = await sb.from('class_bookings').insert({ class_id: classId, date, user_id: u.id });
      if (error) throw error.code === '23505' ? new Error('Already booked') : error;
    },

    async cancel(bookingId) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        const key = 'bookings_' + u.email;
        dSet(key, dGet(key, []).filter(b => b.id !== bookingId)); return;
      }
      const { error } = await sb.from('class_bookings').delete().eq('id', bookingId).eq('user_id', u.id);
      if (error) throw error;
    },

    async getPastBookings(days = 30) {
      const u = await DB.getUser(); if (!u) return [];
      const today = DB._iso(new Date());
      const start = new Date(); start.setDate(start.getDate() - days);
      const startISO = DB._iso(start);
      if (!LIVE) {
        return dGet('bookings_' + u.email, [])
          .filter(b => b.date < today && b.date >= startISO)
          .sort((a, b) => b.date.localeCompare(a.date));
      }
      const { data, error } = await sb.from('class_bookings')
        .select('id,class_id,date').eq('user_id', u.id)
        .lt('date', today).gte('date', startISO)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },

    /* ---- workouts ---- */
    async addWorkout(entry) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        const all = dGet('workouts_' + u.email, []);
        all.unshift(Object.assign({ id: uid(), created_at: new Date().toISOString() }, entry));
        dSet('workouts_' + u.email, all); return;
      }
      const { error } = await sb.from('workout_logs').insert(Object.assign({ user_id: u.id }, entry));
      if (error) throw error;
    },

    async getWorkouts(limit = 50) {
      const u = await DB.getUser(); if (!u) return [];
      if (!LIVE) return dGet('workouts_' + u.email, []).slice(0, limit);
      const { data, error } = await sb.from('workout_logs').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data;
    },

    async deleteWorkout(id) {
      const u = await DB.getUser(); if (!u) return;
      if (!LIVE) { dSet('workouts_' + u.email, dGet('workouts_' + u.email, []).filter(w => w.id !== id)); return; }
      await sb.from('workout_logs').delete().eq('id', id).eq('user_id', u.id);
    },

    /* ---- weight & body composition ---- */
    _iso(d) { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); },

    async addWeight(date, kg, bf) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      const row = { date };
      if (kg != null) row.kg = Number(kg);
      if (bf != null) row.body_fat_pct = Number(bf);
      if (!LIVE) {
        const all = dGet('weights_' + u.email, []);
        all.push(Object.assign({ id: uid() }, row));
        all.sort((a, b) => a.date.localeCompare(b.date));
        dSet('weights_' + u.email, all); return;
      }
      const { error } = await sb.from('weight_logs').insert(Object.assign({ user_id: u.id }, row));
      if (error) throw error;
    },

    async getWeights() {
      const u = await DB.getUser(); if (!u) return [];
      if (!LIVE) return dGet('weights_' + u.email, []);
      const { data, error } = await sb.from('weight_logs').select('*').eq('user_id', u.id).order('date');
      if (error) throw error;
      return data;
    },

    /* ---- exercise library (falls back to the built-in list if the table is missing) ---- */
    async getExercises() {
      if (!LIVE) return DEMO_EXERCISES;
      const { data, error } = await sb.from('exercises').select('*').order('sort').order('name');
      if (error || !data || !data.length) return DEMO_EXERCISES;
      return data;
    },

    /* ---- meals (recipes, foods, 7-day plans); read-only, empty if the tables are missing ---- */
    async getRecipes() {
      if (!LIVE) return [];
      const { data, error } = await sb.from('recipes').select('*').order('name');
      return error || !data ? [] : data;
    },
    async getFoods() {
      if (!LIVE) return [];
      const { data, error } = await sb.from('foods').select('*').order('name');
      return error || !data ? [] : data;
    },
    async getMealPlans() {
      if (!LIVE) return { plans: [], items: [] };
      const [p, i] = await Promise.all([
        sb.from('meal_plan_templates').select('*').order('plan_no', { ascending: false }),
        sb.from('meal_plan_template_items').select('*').order('day').order('sort')
      ]);
      return { plans: p.error || !p.data ? [] : p.data, items: i.error || !i.data ? [] : i.data };
    },

    /* ---- health and allergy form + consent (UK GDPR special category data) ---- */
    async getHealth() {
      const u = await DB.getUser(); if (!u) return null;
      if (!LIVE) return dGet('health_' + u.email, null);
      const { data, error } = await sb.from('member_health').select('*').eq('user_id', u.id).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    /* deletes the member's saved weight and body fat records (used when they decline or withdraw that consent) */
    async deleteMeasurements() {
      const u = await DB.getUser(); if (!u) return;
      if (!LIVE) {
        localStorage.removeItem(DK + 'weights_' + u.email);
        const pr = dGet('profile_' + u.email, null); if (pr) { pr.weight_kg = null; dSet('profile_' + u.email, pr); }
        return;
      }
      const a = await sb.from('weight_logs').delete().eq('user_id', u.id);
      if (a.error) throw a.error;
      await sb.from('profiles').update({ weight_kg: null }).eq('id', u.id);
    },
    async saveHealth(p) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      const prev = await DB.getHealth().catch(() => null);
      const row = Object.assign({}, p, { updated_at: new Date().toISOString() });
      const acts = [prev ? 'updated' : 'given'];
      if (!!(prev && prev.consent_measurements) !== !!p.consent_measurements) acts.push(p.consent_measurements ? 'measurements_on' : 'measurements_off');
      if (!LIVE) {
        dSet('health_' + u.email, row);
        dSet('consent_' + u.email, dGet('consent_' + u.email, []).concat(acts.map((a) => ({ action: a, version: p.consent_version, at: row.updated_at }))));
        if (!p.consent_measurements) await DB.deleteMeasurements();
        return row;
      }
      const { error } = await sb.from('member_health').upsert(Object.assign({ user_id: u.id }, row), { onConflict: 'user_id' });
      if (error) throw error;
      await sb.from('consent_log').insert(acts.map((a) => ({ user_id: u.id, action: a, version: p.consent_version })));
      if (!p.consent_measurements) await DB.deleteMeasurements();
      return row;
    },
    /* switch weight and body fat tracking on (the member's separate, optional consent) */
    async turnOnMeasurements(version) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      const at = new Date().toISOString();
      if (!LIVE) {
        const h = dGet('health_' + u.email, null); if (!h) throw new Error('Complete the health form first');
        h.consent_measurements = true; h.measurements_consented_at = at; dSet('health_' + u.email, h);
        dSet('consent_' + u.email, dGet('consent_' + u.email, []).concat({ action: 'measurements_on', version, at }));
        return;
      }
      const { error } = await sb.from('member_health').update({ consent_measurements: true, measurements_consented_at: at, updated_at: at }).eq('user_id', u.id);
      if (error) throw error;
      await sb.from('consent_log').insert({ user_id: u.id, action: 'measurements_on', version });
    },
    /* switch weight and body fat tracking off: consent removed and the measurements deleted */
    async turnOffMeasurements(version) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        const h = dGet('health_' + u.email, null);
        if (h) { h.consent_measurements = false; h.measurements_consented_at = null; dSet('health_' + u.email, h); }
        dSet('consent_' + u.email, dGet('consent_' + u.email, []).concat({ action: 'measurements_off', version, at: new Date().toISOString() }));
        await DB.deleteMeasurements(); return;
      }
      const { error } = await sb.from('member_health').update({ consent_measurements: false, measurements_consented_at: null, updated_at: new Date().toISOString() }).eq('user_id', u.id);
      if (error) throw error;
      await DB.deleteMeasurements();
      await sb.from('consent_log').insert({ user_id: u.id, action: 'measurements_off', version });
    },
    async withdrawHealth(version) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        localStorage.removeItem(DK + 'health_' + u.email);
        dSet('consent_' + u.email, dGet('consent_' + u.email, []).concat({ action: 'withdrawn', version, at: new Date().toISOString() }));
        await DB.deleteMeasurements(); return;
      }
      const { error } = await sb.from('member_health').delete().eq('user_id', u.id);
      if (error) throw error;
      await DB.deleteMeasurements();
      await sb.from('consent_log').insert({ user_id: u.id, action: 'withdrawn', version });
    },

    /* ---- push reminders (one row per phone) ---- */
    async savePushSub(sub) {
      if (!LIVE) return;
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      const k = sub.keys || {};
      const { error } = await sb.from('push_subscriptions').insert({ user_id: u.id, endpoint: sub.endpoint, p256dh: k.p256dh, auth: k.auth });
      if (error && error.code !== '23505') throw error;
    },
    async deletePushSub(endpoint) {
      if (!LIVE) return;
      const u = await DB.getUser(); if (!u) return;
      await sb.from('push_subscriptions').delete().eq('user_id', u.id).eq('endpoint', endpoint);
    },

    /* ---- templates ---- */
    async getTemplates() {
      if (!LIVE) return DEMO_TEMPLATES;
      const { data, error } = await sb.from('workout_templates').select('*').order('created_at');
      if (error) throw error;
      return data;
    },

    async addTemplate(t) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        const all = dGet('my_templates', []);
        all.push(Object.assign({ id: uid() }, t));
        dSet('my_templates', all); return;
      }
      const { error } = await sb.from('workout_templates').insert(Object.assign({ created_by: u.id, is_public: false }, t));
      if (error) throw error;
    }
  };

  window.DB = DB;
})();
