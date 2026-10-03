/* MY GYM London — UI logic (no inline scripts; strict CSP friendly) */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------- helpers ---------- */
  const fmtISO = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  const fmtShort = (iso) => new Date(iso + 'T12:00:00')
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  const toast = (node, msg, isErr) => {
    if (!node) return;
    node.textContent = msg || '';
    node.className = isErr ? 'err' : 'ok';
    if (msg) setTimeout(() => { if (node.textContent === msg) node.textContent = ''; }, 4000);
  };
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowOf = (iso) => DAY_NAMES[new Date(iso + 'T12:00:00').getDay()];

  /* ---------- state ---------- */
  let authed = false;
  let me = null;
  let profile = null;
  let classes = [];
  let selDate = fmtISO(new Date());
  const MEMBER_VIEWS = ['bookings', 'log', 'progress'];
  const WEEK_GOAL = 3;

  /* ---------- navigation ---------- */
  function go(v) {
    if (MEMBER_VIEWS.indexOf(v) !== -1 && !authed) v = 'login';
    const actual = (v === 'home') ? (authed ? 'mhome' : 'home') : v;
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === actual));
    $$('.nwrap button').forEach((b) => b.classList.toggle('sel', b.dataset.v === v));
    window.scrollTo({ top: 0 });
    if (actual === 'mhome') renderDash();
    if (actual === 'timetable') renderTimetable();
    if (actual === 'bookings') renderBookings();
    if (actual === 'log') renderLog();
    if (actual === 'progress') renderProgress();
    if (actual === 'profile') renderProfile();
    if (actual === 'message' && profile) $('#msgName').value = profile.full_name || '';
  }
  window.__mygymGo = go;

  $$('.nwrap button').forEach((b) => b.addEventListener('click', () => go(b.dataset.v)));
  $$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    go(a.dataset.goto);
  }));

  function setNav() {
    const ab = $('#authBtn');
    ab.textContent = authed ? '👤 Me' : 'Log in';
    ab.classList.toggle('ghost', !authed);
    $('#demoBanner').style.display = DB.isLive() ? 'none' : 'block';
  }
  $('#authBtn').addEventListener('click', () => go(authed ? 'profile' : 'login'));

  /* ---------- auth ---------- */
  let authMode = 'in';
  $$('#authSeg button').forEach((b) => b.addEventListener('click', () => {
    authMode = b.dataset.t;
    $$('#authSeg button').forEach((x) => x.classList.toggle('sel', x === b));
    $('#nameField').style.display = authMode === 'up' ? 'block' : 'none';
    $('#aPass').autocomplete = authMode === 'up' ? 'new-password' : 'current-password';
    $('#aSubmit').textContent = authMode === 'up' ? 'Create free account' : 'Log in';
    $('#authTitle').textContent = authMode === 'up' ? 'Join MY GYM' : 'Member login';
    $('#authSub').textContent = authMode === 'up'
      ? 'Free account — book classes, log workouts, track progress. No contract.'
      : 'Log in to book classes and track progress.';
    $('#aErr').textContent = '';
    $('#forgotWrap').style.display = authMode === 'in' ? 'block' : 'none';
  }));

  $('#forgotLink').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('#aEmail').value.trim();
    const err = $('#aErr');
    if (!email) return toast(err, 'Enter your email above, then tap Forgot password.', true);
    try {
      await DB.sendReset(email);
      toast(err, 'If that email has an account, a reset link is on its way. Check your inbox (and spam).', false);
    } catch (x) {
      toast(err, (x && x.message) || 'Could not send the email. Try again.', true);
    }
  });

  DB.onRecovery(() => go('resetpw'));
  $('#rSave').addEventListener('click', async () => {
    const pw = $('#rPass').value;
    const err = $('#rErr');
    if (pw.length < 8) return toast(err, 'Password must be at least 8 characters.', true);
    try {
      await DB.updatePassword(pw);
      $('#rPass').value = '';
      history.replaceState(null, '', location.pathname);
      await afterAuth();
    } catch (x) {
      toast(err, (x && x.message) || 'Could not save. Try again.', true);
    }
  });

  $('#aSubmit').addEventListener('click', async () => {
    const email = $('#aEmail').value.trim();
    const pass = $('#aPass').value;
    const err = $('#aErr');
    if (!email || !pass) return toast(err, 'Enter your email and password.', true);
    if (authMode === 'up' && pass.length < 8) return toast(err, 'Password must be at least 8 characters.', true);
    $('#aSubmit').disabled = true;
    try {
      if (authMode === 'up') {
        const res = await DB.signUp(email, pass, $('#aName').value.trim());
        if (DB.isLive() && !(res && res.session)) {
          $('#authSub').textContent = '✅ Account created — check your email to confirm, then log in.';
          authMode = 'in';
          $$('#authSeg button').forEach((x) => x.classList.toggle('sel', x.dataset.t === 'in'));
          $('#nameField').style.display = 'none';
          $('#aSubmit').textContent = 'Log in';
        } else {
          await afterAuth();
        }
      } else {
        await DB.signIn(email, pass);
        await afterAuth();
      }
    } catch (e) {
      toast(err, e && e.message === 'CHECK_EMAIL'
        ? 'Check your inbox to confirm your email, then log in.'
        : ((e && e.message) || 'Something went wrong — try again.'), true);
    } finally {
      $('#aSubmit').disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await DB.signOut();
    authed = false; me = null; profile = null;
    setNav();
    go('home');
  });

  async function afterAuth() {
    me = await DB.getUser();
    if (!me) return;
    authed = true;
    profile = await DB.getProfile().catch(() => null);
    classes = await DB.getClasses().catch(() => []);
    setNav();
    $('#aPass').value = '';
    go('home');
  }

  /* ---------- shared: fetch classes ---------- */
  async function ensureClasses() {
    if (!classes.length) classes = await DB.getClasses().catch(() => []);
    return classes;
  }

  /* ---------- TIMETABLE (everyone; booking for members) ---------- */
  let bkCache = null; // { t, data } — reused for 30s when only the day changes
  async function renderTimetable(reuse) {
    await ensureClasses();
    const strip = $('#dateStrip');
    strip.textContent = '';
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const iso = fmtISO(d);
      const b = el('button');
      b.appendChild(el('span', 'dow', i === 0 ? 'Today' : DAY_NAMES[d.getDay()].slice(0, 3)));
      b.appendChild(el('span', 'dnum', String(d.getDate())));
      if (iso === selDate) b.classList.add('sel');
      b.addEventListener('click', () => { selDate = iso; renderTimetable(true); });
      strip.appendChild(b);
    }
    $('#ttHeadline').textContent = authed
      ? 'Pick a day and grab your spot. Cancel any time.'
      : 'Our weekly classes. Join free to book your spot.';

    let allBookings = [];
    if (authed) {
      if (reuse && bkCache && Date.now() - bkCache.t < 30000) allBookings = bkCache.data;
      else { try { allBookings = await DB.getBookingsForDates(window14()); bkCache = { t: Date.now(), data: allBookings }; } catch (e) {} }
    }

    const dayClasses = classes.filter((c) => c.day_name === dowOf(selDate));
    const box = $('#bookSlots');
    box.textContent = '';
    if (!dayClasses.length) {
      box.appendChild(el('div', 'card note', 'No classes on ' + dowOf(selDate) + ' — rest days build muscle too 🛋️'));
    }
    dayClasses.forEach((c) => box.appendChild(slotRow(c, selDate, allBookings)));
    $('#ttNote').textContent = authed ? '' : 'Tap “Log in” to book — it takes 10 seconds.';
  }

  function window14() {
    const dates = [];
    for (let i = 0; i < 14; i++) { const d = new Date(); d.setDate(d.getDate() + i); dates.push(fmtISO(d)); }
    return dates;
  }

  function slotRow(c, iso, allBookings) {
    const row = el('div', 'slot');
    const t = el('span', 'time', c.start_time);
    row.appendChild(t);
    const what = el('span', 'what');
    what.appendChild(el('b', '', c.name));
    what.appendChild(el('small', '', [c.coach, c.info].filter(Boolean).join(' · ')));
    if (authed) {
      const cbs = allBookings.filter((b) => b.class_id === c.id && b.date === iso);
      const left = (c.capacity || 8) - cbs.length;
      what.appendChild(el('small', 'spots ' + (left > 0 ? 'free' : 'full'),
        left > 0 ? left + ' spot' + (left === 1 ? '' : 's') + ' left' : 'FULL'));
    }
    row.appendChild(what);
    const act = el('span', 'act');
    if (!authed) {
      const b = el('button', 'btn-small', 'Log in');
      b.addEventListener('click', () => go('login'));
      act.appendChild(b);
    } else {
      const mine = allBookings.find((b) => b.class_id === c.id && b.date === iso && b.user_id === me.id);
      const cbs = allBookings.filter((b) => b.class_id === c.id && b.date === iso);
      const left = (c.capacity || 8) - cbs.length;
      const b = el('button', 'btn-small');
      if (mine) {
        b.textContent = 'Cancel'; b.className = 'btn-small ghost';
        b.addEventListener('click', async () => { b.disabled = true; try { await DB.cancel(mine.id); renderTimetable(); } catch (e) { b.disabled = false; } });
      } else {
        b.textContent = 'Book'; b.disabled = left <= 0;
        b.addEventListener('click', async () => { b.disabled = true; try { await DB.book(c.id, iso); renderTimetable(); } catch (e) { b.disabled = false; } });
      }
      act.appendChild(b);
    }
    row.appendChild(act);
    return row;
  }

  /* ---------- DASHBOARD (member home) ---------- */
  async function renderDash() {
    const first = (profile && profile.full_name) ? profile.full_name.split(' ')[0] : '';
    $('#helloName').textContent = first ? 'Hi ' + first + ", let's move! 👋" : "Hi! Let's check your activity 👋";
    try {
      await ensureClasses();
      const [wins, allBk, wts] = await Promise.all([
        DB.getWorkouts(200),
        DB.getBookingsForDates(window14()),
        DB.getWeights()
      ]);
      const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const monISO = fmtISO(monday);
      const weekCount = wins.filter((w) => w.date >= monISO).length;
      $('#statWeek').textContent = weekCount;
      const pct = Math.min(100, Math.round((weekCount / WEEK_GOAL) * 100));
      $('#goalBar').style.width = pct + '%';
      $('#goalTxt').textContent = weekCount + '/' + WEEK_GOAL + (weekCount >= WEEK_GOAL ? ' done — goal smashed! 🎉' : ' done — keep going!');

      const up = upcomingFrom(allBk);
      $('#statBooked').textContent = up.length;
      if (up.length) {
        $('#nextWrap').style.display = 'block';
        const c = $('#nextCard'); c.textContent = '';
        const x = up[0];
        const row = el('div', 'slot');
        row.appendChild(el('span', 'time', x.class.start_time));
        const what = el('span', 'what');
        what.appendChild(el('b', '', x.class.name));
        what.appendChild(el('small', '', fmtShort(x.date)));
        row.appendChild(what);
        c.appendChild(row);
      } else {
        $('#nextWrap').style.display = 'none';
      }

      const lastW = wts.filter((w) => w.kg).slice(-1)[0];
      $('#statWeight').textContent = lastW ? lastW.kg + 'kg' : '–';

      // today's classes
      const today = fmtISO(new Date());
      const todayBookings = allBk.filter((b) => b.date === today);
      const todays = classes.filter((c) => c.day_name === dowOf(today));
      const tl = $('#todayList'); tl.textContent = '';
      if (!todays.length) tl.appendChild(el('div', 'card note', 'No classes today — perfect day to log a workout 💪'));
      todays.forEach((c) => tl.appendChild(slotRow(c, today, todayBookings)));
    } catch (e) { /* offline */ }
  }

  async function upcomingBookings() {
    return upcomingFrom(await DB.getBookingsForDates(window14()));
  }

  function upcomingFrom(all) {
    const today = fmtISO(new Date());
    return all
      .filter((b) => b.user_id === me.id && b.date >= today)
      .sort((a, b) => (a.date + a.class_id).localeCompare(b.date + b.class_id))
      .map((b) => ({ booking: b, date: b.date, class: classes.find((c) => c.id === b.class_id) }))
      .filter((x) => x.class);
  }

  /* ---------- BOOKINGS (member) ---------- */
  async function renderBookings() {
    await ensureClasses();
    const up = $('#upcomingBox'); up.textContent = '';
    let upcoming = [];
    try { upcoming = await upcomingBookings(); } catch (e) {}
    if (!upcoming.length) {
      up.appendChild(el('p', 'note', 'Nothing booked yet — your next session is one tap away in Timetable.'));
    }
    upcoming.forEach((x) => {
      const row = el('div', 'slot');
      row.appendChild(el('span', 'time', x.class.start_time));
      const what = el('span', 'what');
      what.appendChild(el('b', '', x.class.name));
      what.appendChild(el('small', '', fmtShort(x.date)));
      row.appendChild(what);
      const act = el('span', 'act');
      const b = el('button', 'btn-small ghost', 'Cancel');
      b.addEventListener('click', async () => { b.disabled = true; try { await DB.cancel(x.booking.id); renderBookings(); } catch (e) { b.disabled = false; } });
      act.appendChild(b);
      row.appendChild(act);
      up.appendChild(row);
    });

    // recent history (past 30 days)
    const past = $('#pastBox'); past.textContent = '';
    let hist = [];
    try { hist = await DB.getPastBookings(30); } catch (e) {}
    if (!hist.length) {
      past.appendChild(el('p', 'note', 'Attended classes will show up here.'));
    } else {
      hist.forEach((b) => {
        const c = classes.find((x) => x.id === b.class_id);
        const row = el('div', 'wlog');
        const left = el('div');
        left.appendChild(el('b', '', c ? c.name : 'Class'));
        left.appendChild(el('small', '', fmtShort(b.date) + (c ? ' · ' + c.start_time : '')));
        row.appendChild(left);
        row.appendChild(el('small', '✅', ''));
        past.appendChild(row);
      });
    }
  }

  /* ---------- LOG (member) ---------- */
  $$('#logSeg button').forEach((b) => b.addEventListener('click', () => {
    $$('#logSeg button').forEach((x) => x.classList.toggle('sel', x === b));
    $('#paneWorkouts').style.display = b.dataset.t === 'workouts' ? 'block' : 'none';
    $('#paneBody').style.display = b.dataset.t === 'body' ? 'block' : 'none';
    if (b.dataset.t === 'body') { $('#kgDate').value = fmtISO(new Date()); renderBody(); }
  }));

  function renderLog() { renderWorkouts(); ensureBuilder(); }

  /* ---- multi-exercise workout builder ---- */
  function fieldNum(label, cls, type, ph, val, step) {
    const f = el('div', 'field');
    f.appendChild(el('label', '', label));
    const i = el('input'); i.className = cls; i.type = type; i.placeholder = ph;
    if (type === 'number') { i.inputMode = 'decimal'; if (step) i.step = step; else i.min = '1'; }
    if (val != null && val !== '') i.value = val;
    f.appendChild(i); return f;
  }
  function exerciseRow(data) {
    data = data || {};
    const row = el('div', 'exrow');
    const del = el('button', 'ex-del', '✕'); del.type = 'button'; del.title = 'Remove exercise';
    del.addEventListener('click', () => {
      row.remove(); renumberEx();
      if (!$('#exList .exrow')) addExercise();
    });
    row.appendChild(del);
    row.appendChild(el('div', 'exhead', 'Exercise'));
    const nf = el('div', 'field');
    nf.appendChild(el('label', '', 'Name'));
    const name = el('input'); name.className = 'ex-name'; name.placeholder = 'e.g. Goblet squat'; name.value = data.name || '';
    nf.appendChild(name); row.appendChild(nf);
    const r3 = el('div', 'row3');
    r3.appendChild(fieldNum('Sets', 'ex-sets', 'number', '3', data.sets));
    r3.appendChild(fieldNum('Reps', 'ex-reps', 'text', '10', data.reps));
    r3.appendChild(fieldNum('Weight (kg)', 'ex-weight', 'number', '12', data.weight, '0.5'));
    row.appendChild(r3);
    return row;
  }
  function addExercise(data) { $('#exList').appendChild(exerciseRow(data)); renumberEx(); }
  function renumberEx() {
    $$('#exList .exrow').forEach((r, i) => { const h = r.querySelector('.exhead'); if (h) h.textContent = 'Exercise ' + (i + 1); });
  }
  function ensureBuilder() { if (!$('#exList .exrow')) addExercise(); }
  function collectExercises() {
    return $$('#exList .exrow').map((r) => ({
      name: (r.querySelector('.ex-name').value || '').trim(),
      sets: parseInt(r.querySelector('.ex-sets').value, 10) || null,
      reps: (r.querySelector('.ex-reps').value || '').trim() || null,
      weight: parseFloat(r.querySelector('.ex-weight').value) || null
    })).filter((x) => x.name || x.sets || x.reps || x.weight);
  }

  $('#addEx').addEventListener('click', () => { addExercise(); const n = $$('#exList .ex-name'); if (n.length) n[n.length - 1].focus(); });

  $('#wSave').addEventListener('click', async () => {
    const exs = collectExercises();
    if (!exs.length || !exs.some((x) => x.name)) return toast($('#wErr'), 'Add at least one exercise with a name.', true);
    const title = ($('#wTitle').value || '').trim();
    const entry = {
      date: fmtISO(new Date()),
      title: title,
      exercise: (exs.map((x) => x.name).filter(Boolean).join(', ') || (exs.length + ' exercises')).slice(0, 140),
      exercises: exs,
      notes: ''
    };
    $('#wSave').disabled = true;
    try {
      await DB.addWorkout(entry);
      $('#wTitle').value = ''; $('#exList').textContent = ''; addExercise();
      renderWorkouts(); renderDash();
    } catch (e) { toast($('#wErr'), (e && e.message) || 'Could not save', true); }
    $('#wSave').disabled = false;
  });

  function exListOf(w) {
    if (Array.isArray(w.exercises) && w.exercises.length) return w.exercises;
    return [{ name: w.exercise || 'Exercise', sets: w.sets, reps: w.reps, weight: (w.weight_kg != null ? w.weight_kg : null), note: w.notes }];
  }
  function exDesc(x) {
    const sr = (x.sets ? x.sets + '×' : '') + (x.reps ? x.reps : '');
    const wt = (x.weight != null && x.weight !== '') ? x.weight + 'kg' : '';
    if (sr && wt) return sr + ' @ ' + wt;
    return sr || wt || '';
  }

  async function renderWorkouts() {
    const box = $('#wHistory'); box.textContent = '';
    let logs = []; try { logs = await DB.getWorkouts(60); } catch (e) {}
    if (!logs.length) { box.appendChild(el('p', 'note', 'No workouts logged yet. Your first one is waiting 💪')); return; }
    logs.forEach((w) => {
      const exs = exListOf(w);
      const sess = el('div', 'wlog-session');
      const head = el('div', 'wlog-head');
      const t = el('div');
      t.appendChild(el('b', '', w.title || 'Workout'));
      t.appendChild(el('small', '', fmtShort(w.date) + ' · ' + exs.length + (exs.length === 1 ? ' exercise' : ' exercises')));
      head.appendChild(t);
      const del = el('button', 'del', '✕');
      del.addEventListener('click', async () => { await DB.deleteWorkout(w.id).catch(() => {}); renderWorkouts(); renderDash(); });
      head.appendChild(del);
      sess.appendChild(head);
      const ul = el('div', 'wlog-ex');
      exs.forEach((x) => {
        const line = el('div', 'wlog-line');
        line.appendChild(el('b', '', x.name || 'Exercise'));
        const d = exDesc(x);
        if (d) line.appendChild(el('span', 'nn', ' — ' + d));
        if (x.note) line.appendChild(el('span', 'nn', ' · ' + x.note));
        ul.appendChild(line);
      });
      sess.appendChild(ul);
      box.appendChild(sess);
    });
  }

  $('#kgSave').addEventListener('click', async () => {
    const date = $('#kgDate').value || fmtISO(new Date());
    const kg = parseFloat($('#kgVal').value);
    const bf = parseFloat($('#bfVal').value);
    if ((!kg || kg < 20 || kg > 400) && (!bf || bf < 3 || bf > 70))
      return toast($('#kgErr'), 'Enter a weight (kg) and/or body fat (%).', true);
    $('#kgSave').disabled = true;
    try {
      await DB.addWeight(date, kg || null, bf || null);
      $('#kgVal').value = ''; $('#bfVal').value = '';
      renderBody(); renderDash();
    } catch (e) { toast($('#kgErr'), (e && e.message) || 'Could not save', true); }
    $('#kgSave').disabled = false;
  });

  async function renderBody() {
    const box = $('#kgHistory'); box.textContent = '';
    let ws = []; try { ws = await DB.getWeights(); } catch (e) {}
    if (!ws.length) { box.appendChild(el('p', 'note', 'No measurements yet. Track weekly — trends beat single numbers.')); return; }
    ws.slice().reverse().slice(0, 12).forEach((w) => {
      const row = el('div', 'wlog');
      const left = el('div');
      const bits = [];
      if (w.kg) bits.push(w.kg + ' kg');
      if (w.body_fat_pct) bits.push(w.body_fat_pct + '% BF');
      left.appendChild(el('b', '', bits.join(' · ') || '—'));
      left.appendChild(el('small', '', fmtShort(w.date)));
      row.appendChild(left);
      box.appendChild(row);
    });
  }

  /* ---------- PROGRESS (member) ---------- */
  let progMode = 'weight';
  $$('#progSeg button').forEach((b) => b.addEventListener('click', () => {
    progMode = b.dataset.t;
    $$('#progSeg button').forEach((x) => x.classList.toggle('sel', x === b));
    renderProgress();
  }));

  async function renderProgress() {
    const cv = $('#progChart');
    const stats = $('#progStats'); stats.textContent = '';
    const [ws, wos] = await Promise.all([
      DB.getWeights().catch(() => []),
      DB.getWorkouts(500).catch(() => [])
    ]);

    if (progMode === 'weight') {
      const pts = ws.filter((w) => w.kg).map((w) => ({ label: fmtShort(w.date), v: Number(w.kg) }));
      lineChart(cv, pts, 'kg');
      statCards(stats, pts, 'kg');
    } else if (progMode === 'bf') {
      const pts = ws.filter((w) => w.body_fat_pct).map((w) => ({ label: fmtShort(w.date), v: Number(w.body_fat_pct) }));
      lineChart(cv, pts, '%');
      statCards(stats, pts, '% BF');
    } else {
      // weekly workout volume (last 8 weeks)
      const weeks = [], labels = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7) - i * 7);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        const sISO = fmtISO(start), eISO = fmtISO(end);
        weeks.push(wos.filter((w) => w.date >= sISO && w.date <= eISO).length);
        labels.push(start.getDate() + '/' + (start.getMonth() + 1));
      }
      barChart(cv, weeks, labels);
      const total = wos.length;
      const best = weeks.length ? Math.max.apply(null, weeks) : 0;
      const avg = weeks.length ? (weeks.reduce((a, b) => a + b, 0) / weeks.length).toFixed(1) : 0;
      [['Total', total], ['Best week', best], ['Avg/week', avg]].forEach((s) => {
        const d = el('div', 'stat'); d.appendChild(el('b', '', String(s[1]))); d.appendChild(el('small', '', s[0])); stats.appendChild(d);
      });
    }
    renderTemplates();
  }

  function statCards(box, pts, unit) {
    if (!pts.length) {
      const d = el('div', 'stat'); d.appendChild(el('b', '', '–')); d.appendChild(el('small', '', 'no data yet')); box.appendChild(d);
      return;
    }
    const first = pts[0].v, last = pts[pts.length - 1].v;
    const diff = (last - first);
    const arrow = diff === 0 ? '→' : (diff < 0 ? '▼' : '▲');
    [['Start', first.toFixed(1)], ['Latest', last.toFixed(1)], ['Change', arrow + ' ' + Math.abs(diff).toFixed(1)]].forEach((s) => {
      const d = el('div', 'stat'); d.appendChild(el('b', '', s[1] + (s[0] === 'Change' ? '' : unit === '%' ? '%' : ''))); d.appendChild(el('small', '', s[0])); box.appendChild(d);
    });
  }

  const RED = '#e03939';
  function lineChart(cv, pts, unit) {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (pts.length < 2) { emptyChart(ctx, cv, 'Add 2+ entries to see your trend'); return; }
    const pad = 52;
    const vals = pts.map((p) => p.v);
    let min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    const X = (i) => pad + (i * (cv.width - pad * 2)) / (pts.length - 1);
    const Y = (v) => cv.height - pad - ((v - min) * (cv.height - pad * 2)) / (max - min);
    gridlines(ctx, cv, pad);
    // area fill
    ctx.beginPath();
    ctx.moveTo(X(0), Y(pts[0].v));
    pts.forEach((p, i) => ctx.lineTo(X(i), Y(p.v)));
    ctx.lineTo(X(pts.length - 1), cv.height - pad);
    ctx.lineTo(X(0), cv.height - pad);
    ctx.closePath();
    ctx.fillStyle = 'rgba(224,57,57,.10)'; ctx.fill();
    // line
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p.v)) : ctx.moveTo(X(i), Y(p.v))));
    ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    // points
    ctx.fillStyle = RED;
    pts.forEach((p, i) => { ctx.beginPath(); ctx.arc(X(i), Y(p.v), 4, 0, 7); ctx.fill(); });
    // labels
    ctx.fillStyle = '#77767c'; ctx.font = '15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(max.toFixed(1) + unit, pad - 8, Y(max) + 5);
    ctx.fillText(min.toFixed(1) + unit, pad - 8, Y(min) + 5);
    ctx.textAlign = 'left'; ctx.fillText(pts[0].label, pad, cv.height - 16);
    ctx.textAlign = 'right'; ctx.fillText(pts[pts.length - 1].label, cv.width - pad + 20, cv.height - 16);
  }

  function barChart(cv, vals, labels) {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!vals.some((v) => v > 0)) { emptyChart(ctx, cv, 'Log workouts to see your weekly volume'); return; }
    const pad = 44;
    const max = Math.max.apply(null, vals.concat([1]));
    const n = vals.length;
    const gap = 14;
    const bw = (cv.width - pad * 2 - gap * (n - 1)) / n;
    gridlines(ctx, cv, pad);
    vals.forEach((v, i) => {
      const h = (v / max) * (cv.height - pad * 2);
      const x = pad + i * (bw + gap);
      const y = cv.height - pad - h;
      ctx.fillStyle = v > 0 ? RED : '#e7e7ea';
      roundRect(ctx, x, y, bw, Math.max(h, 3), 6); ctx.fill();
      ctx.fillStyle = '#77767c'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      if (v > 0) ctx.fillText(String(v), x + bw / 2, y - 6);
      ctx.fillText(labels[i], x + bw / 2, cv.height - 16);
    });
  }

  function gridlines(ctx, cv, pad) {
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = pad / 1.6 + (g * (cv.height - pad * 1.8)) / 4;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(cv.width - pad + 20, y); ctx.stroke();
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, 0);
    ctx.lineTo(x, y + h); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function emptyChart(ctx, cv, msg) {
    ctx.fillStyle = '#9a9aa0'; ctx.font = '19px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(msg, cv.width / 2, cv.height / 2);
  }

  /* ---------- templates (in Progress) ---------- */
  async function renderTemplates() {
    const box = $('#tplList'); if (!box) return;
    box.textContent = '';
    let tpls = []; try { tpls = await DB.getTemplates(); } catch (e) {}
    tpls.forEach((t) => {
      const card = el('div', 'card tpl');
      const head = el('div');
      head.appendChild(el('span', 'chip', t.level || 'All levels'));
      head.appendChild(el('b', '', t.name));
      const desc = el('p', 'sub', t.description || ''); desc.style.margin = '6px 0 10px';
      head.appendChild(desc);
      card.appendChild(head);
      const ex = el('div', 'ex');
      (t.exercises || []).forEach((x) => {
        const row = el('div');
        row.appendChild(el('b', '', x.name + ' '));
        row.appendChild(document.createTextNode(x.sets ? x.sets + '×' + (x.reps || '') : (x.reps || '')));
        ex.appendChild(row);
      });
      const btnRow = el('div'); btnRow.style.marginTop = '10px';
      const logBtn = el('button', 'btn-small', '🏋️ Log this plan');
      logBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); logBtn.disabled = true;
        try {
          const exs = (t.exercises || []).map((x) => ({ name: x.name, sets: x.sets || null, reps: x.reps ? String(x.reps) : null, weight: null, note: x.note || '' }));
          await DB.addWorkout({ date: fmtISO(new Date()), title: t.name, exercise: (exs.map((x) => x.name).join(', ') || t.name).slice(0, 140), exercises: exs, notes: '' });
          logBtn.textContent = '✅ Logged!';
          setTimeout(() => { logBtn.textContent = '🏋️ Log this plan'; }, 2500);
        } catch (err) { logBtn.textContent = 'Error'; }
        logBtn.disabled = false;
      });
      btnRow.appendChild(logBtn);
      ex.appendChild(btnRow);
      card.appendChild(ex);
      card.addEventListener('click', () => card.classList.toggle('open'));
      box.appendChild(card);
    });
  }

  /* ---------- MESSAGE (mailto) ---------- */
  $('#msgSend').addEventListener('click', () => {
    const name = $('#msgName').value.trim();
    const topic = $('#msgTopic').value;
    const body = $('#msgBody').value.trim();
    if (!body) return toast($('#msgErr'), 'Write a message first 🙂', true);
    const subject = encodeURIComponent('[MY GYM App] ' + topic + (name ? ' — ' + name : ''));
    const text = encodeURIComponent(body + (name ? '\n\n— ' + name : '') + ((me && me.email) ? '\n(' + me.email + ')' : ''));
    window.location.href = 'mailto:info@mygymlondon.co.uk?subject=' + subject + '&body=' + text;
    toast($('#msgErr'), '');
    $('#msgErr').textContent = '';
    const okn = $('#msgErr');
    okn.className = 'ok'; okn.textContent = '✉️ Opening your email app…';
    setTimeout(() => { okn.textContent = ''; }, 4000);
  });

  /* ---------- PROFILE ---------- */
  async function renderProfile() {
    if (!profile) profile = (await DB.getProfile().catch(() => null)) || {};
    $('#pName').value = profile.full_name || '';
    $('#pPhone').value = profile.phone || '';
    $('#pWeight').value = profile.weight_kg || '';
    $('#pGoal').value = profile.goal || '';
    $('#pEmail').textContent = (me && me.email) || '';
  }
  $('#pSave').addEventListener('click', async () => {
    const patch = {
      full_name: $('#pName').value.trim(),
      phone: $('#pPhone').value.trim(),
      weight_kg: parseFloat($('#pWeight').value) || null,
      goal: $('#pGoal').value
    };
    $('#pSave').disabled = true;
    try {
      await DB.saveProfile(patch);
      profile = Object.assign(profile || {}, patch);
      toast($('#pMsg'), '✅ Saved!'); renderDash();
    } catch (e) { toast($('#pMsg'), (e && e.message) || 'Could not save', true); }
    $('#pSave').disabled = false;
  });

  /* ---------- install prompt ---------- */
  let deferredPrompt = null;
  const installBtn = $('#installBtn');
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBtn.style.display = 'block'; });
  installBtn.addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; installBtn.style.display = 'none'; });
  });

  /* ---------- offline ---------- */
  const tag = $('#offlineTag');
  function net() { tag.style.display = navigator.onLine ? 'none' : 'block'; }
  window.addEventListener('online', net); window.addEventListener('offline', net); net();

  /* ---------- boot ---------- */
  (async function boot() {
    setNav();
    try {
      me = await DB.getUser();
      if (me) {
        authed = true;
        profile = await DB.getProfile().catch(() => null);
        classes = await DB.getClasses().catch(() => []);
        setNav();
      }
    } catch (e) {}
    const h = location.hash.slice(1);
    const map = { book: 'timetable', templates: 'progress', join: 'home', about: 'home', contact: 'message' };
    if (/type=recovery/.test(h)) go('resetpw');
    else if (h && document.getElementById(h)) go(h);
    else if (h && map[h]) go(map[h]);
    else go('home');
  })();

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
