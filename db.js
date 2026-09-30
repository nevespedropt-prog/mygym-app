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
    { id: 1, day_name: 'Monday', start_time: '07:00', name: 'Morning Blast', coach: 'Team MY GYM', info: '45 min full-body class', capacity: 8 },
    { id: 2, day_name: 'Monday', start_time: '09:30', name: 'Over 50s Strength & Mobility', coach: '', info: 'gentle, friendly, effective', capacity: 10 },
    { id: 3, day_name: 'Monday', start_time: '18:00', name: 'Circuit Training', coach: '', info: 'all levels', capacity: 8 },
    { id: 4, day_name: 'Tuesday', start_time: '07:00', name: 'Sunrise HIIT', coach: '', info: '30 min, coffee after', capacity: 8 },
    { id: 5, day_name: 'Tuesday', start_time: '16:30', name: 'Kids Class', coach: '', info: 'ages 6-11, fun first', capacity: 10 },
    { id: 6, day_name: 'Wednesday', start_time: '18:00', name: 'Boxing Fit', coach: '', info: 'no contact, all levels', capacity: 8 },
    { id: 7, day_name: 'Thursday', start_time: '18:30', name: 'Strength Basics', coach: '', info: 'perfect for beginners', capacity: 8 },
    { id: 8, day_name: 'Friday', start_time: '17:30', name: 'Friday Finisher', coach: '', info: 'team workout, great vibes', capacity: 12 },
    { id: 9, day_name: 'Saturday', start_time: '09:00', name: 'Weekend Warrior', coach: '', info: '60 min mixed class', capacity: 12 }
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
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: fullName || '' } }
      });
      if (error) throw error;
      if (data.user && !data.session) throw new Error('CHECK_EMAIL');
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
      const { data, error } = await sb.from('class_bookings').select('id,class_id,date,user_id').in('date', dates);
      if (error) throw error;
      return data;
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

    /* ---- weight ---- */
    async addWeight(date, kg) {
      const u = await DB.getUser(); if (!u) throw new Error('Not signed in');
      if (!LIVE) {
        const all = dGet('weights_' + u.email, []);
        all.push({ id: uid(), date, kg: Number(kg) });
        all.sort((a, b) => a.date.localeCompare(b.date));
        dSet('weights_' + u.email, all); return;
      }
      const { error } = await sb.from('weight_logs').insert({ user_id: u.id, date, kg: Number(kg) });
      if (error) throw error;
    },

    async getWeights() {
      const u = await DB.getUser(); if (!u) return [];
      if (!LIVE) return dGet('weights_' + u.email, []);
      const { data, error } = await sb.from('weight_logs').select('*').eq('user_id', u.id).order('date');
      if (error) throw error;
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
