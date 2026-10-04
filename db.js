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
    {"name": "Farmer carry", "muscle_group": "Full body", "equipment": "Dumbbell", "how_to": "Hold heavy dumbbells at your sides, stand tall and walk with short, steady steps.", "sort": 41}
  ];

  const DEMO_TEMPLATES = [
    { id: 't1', name: 'Beginner Full-Body', level: 'Beginner', goal: 'General fitness', description: 'Your first month at MY GYM — everything guided.', exercises: [{ name: 'Treadmill warm-up walk', sets: 1, reps: '5 min' }, { name: 'Goblet squat', sets: 3, reps: '10' }, { name: 'Chest press machine', sets: 3, reps: '10' }, { name: 'Seated row', sets: 3, reps: '10' }, { name: 'Plank', sets: 3, reps: '20 sec' }] },
    { id: 't2', name: 'Over 50s Strength & Mobility', level: 'Over 50s', goal: 'Strength + mobility', description: 'Bone strength, balance and mobility — kind to joints.', exercises: [{ name: 'Marching warm-up', sets: 1, reps: '3 min' }, { name: 'Sit-to-stand', sets: 3, reps: '8' }, { name: 'Wall press-up', sets: 3, reps: '10' }, { name: 'Heel raises', sets: 3, reps: '12' }] },
    { id: 't3', name: 'Fat-Burn Circuit', level: 'All levels', goal: 'Fat loss', description: '40 sec work / 20 sec rest, 3 rounds.', exercises: [{ name: 'Jumping jacks', sets: 3, reps: '40 sec' }, { name: 'Kettlebell swing', sets: 3, reps: '40 sec' }, { name: 'Push-up', sets: 3, reps: '40 sec' }, { name: 'Mountain climbers', sets: 3, reps: '40 sec' }] },
    { id: 't4', name: 'Home Workout — No Equipment', level: 'All levels', goal: 'Stay active anywhere', description: '20 minutes, no kit needed.', exercises: [{ name: 'Bodyweight squat', sets: 3, reps: '15' }, { name: 'Push-up (wall/knee/full)', sets: 3, reps: '10' }, { name: 'Reverse lunge', sets: 3, reps: '10 each leg' }, { name: 'Glute bridge', sets: 3, reps: '15' }] }
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
