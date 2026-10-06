/* MY GYM London — UI logic (no inline scripts; strict CSP friendly) */
(function () {
  'use strict';

  /* Clickjacking guard: GitHub Pages cannot send frame-ancestors, so if the app is ever loaded inside
     another site's frame, hide it and break out. (Remove this if the app is deliberately embedded.) */
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try { window.top.location = window.location.href; } catch (e) { /* cross-origin frame: stays hidden */ }
    return;
  }

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
  const MEMBER_VIEWS = ['bookings', 'log', 'progress', 'library'];
  const LOCKED_UNTIL_FORM = ['bookings', 'log', 'progress'];   // unlock when the health form is complete
  const WEEK_GOAL = 3;

  /* ---------- navigation ---------- */
  function go(v) {
    if (MEMBER_VIEWS.indexOf(v) !== -1 && !authed) v = 'login';
    if (authed && LOCKED_UNTIL_FORM.indexOf(v) !== -1 && healthRec !== undefined && !healthOk()) { openHealth(true); return; }
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
    if (actual === 'library') renderLibrary();
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
  $('#resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
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

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
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
    await turnOffReminders(true);
    await DB.signOut();
    authed = false; me = null; profile = null; gymState = null; healthRec = undefined; paintLocks();
    setNav();
    go('home');
  });

  async function afterAuth() {
    me = await DB.getUser();
    if (!me) return;
    authed = true;
    profile = await DB.getProfile().catch(() => null);
    classes = await DB.getClasses().catch(() => []);
    gymState = null;
    healthRec = await DB.getHealth().catch(() => undefined);
    if (classes.some(isGym)) checkGym(true);   // warm up in the background so the gym tab opens instantly
    setNav();
    $('#aPass').value = '';
    paintLocks();
    if (healthRec !== undefined && !healthOk()) openHealth(false); else go('home');
  }

  /* ---------- shared: fetch classes ---------- */
  async function ensureClasses() {
    if (!classes.length) classes = await DB.getClasses().catch(() => []);
    return classes;
  }

  /* ---------- TIMETABLE (everyone; booking for members) ---------- */
  let bkCache = null; // { t, data } — reused for 30s when only the day changes
  let ttMode = 'classes'; // 'classes' | 'gym'
  const isGym = (c) => c.kind === 'gym';
  /* gym hours are for Gym & Exercise Class members. The server decides (and enforces it when booking);
     the app only asks so it can show the right screen. gymState: null | 'yes' | 'no' | 'error' */
  let gymState = null, gymCheckedAt = 0;
  async function checkGym(force) {
    if (!authed) return;
    if (!force && gymState && Date.now() - gymCheckedAt < 10 * 60 * 1000) return;
    try { gymState = (await DB.refreshGymAccess()) ? 'yes' : 'no'; gymCheckedAt = Date.now(); }
    catch (e) { if (!gymState) gymState = 'error'; }
  }
  function gymLockCard() {
    const card = el('div', 'card gymlock');
    if (gymState === 'error') {
      card.appendChild(el('b', '', 'We couldn’t check your membership'));
      card.appendChild(el('p', 'sub', 'Check your connection and try again in a moment.'));
      const r = el('button', 'btn-small', 'Try again');
      r.addEventListener('click', async () => { r.disabled = true; await checkGym(true); renderTimetable(true); });
      card.appendChild(r);
    } else {
      card.appendChild(el('b', '', 'Gym booking is for Gym & Exercise Class members'));
      card.appendChild(el('p', 'sub', 'Your current plan doesn’t include open-gym access. Upgrade on our website and your hours unlock here.'));
      const a = el('a', 'btn-small', 'See memberships →');
      a.href = 'https://www.mygymlondon.co.uk/pricing-plans/memberships'; a.target = '_blank'; a.rel = 'noopener';
      a.style.display = 'inline-block'; a.style.textDecoration = 'none';
      card.appendChild(a);
    }
    return card;
  }
  const endTime = (t) => { const p = t.split(':'); return String(((+p[0] + 1) % 24)).padStart(2, '0') + ':' + p[1]; };
  async function renderTimetable(reuse) {
    await ensureClasses();
    const hasGym = classes.some(isGym);
    if (!hasGym) ttMode = 'classes';
    if (ttMode === 'gym') await checkGym();
    $('#ttSeg').style.display = hasGym ? 'flex' : 'none';
    $$('#ttSeg button').forEach((x) => x.classList.toggle('sel', x.dataset.t === ttMode));
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
    $('#ttHeadline').textContent = ttMode === 'gym'
      ? (authed ? 'Pick a day and an hour for the gym floor. Cancel any time.' : 'Book a one-hour slot on the gym floor. Join free to book.')
      : (authed ? 'Pick a day and grab your spot. Cancel any time.' : 'Our weekly classes. Join free to book your spot.');

    let allBookings = [];
    if (authed) {
      if (reuse && bkCache && Date.now() - bkCache.t < 30000) allBookings = bkCache.data;
      else { try { allBookings = await DB.getBookingsForDates(window14()); bkCache = { t: Date.now(), data: allBookings }; } catch (e) {} }
    }

    const dayClasses = classes.filter((c) => c.day_name === dowOf(selDate) && isGym(c) === (ttMode === 'gym'));
    const box = $('#bookSlots');
    box.textContent = '';
    if (ttMode === 'gym' && authed && gymState !== 'yes') box.appendChild(gymLockCard());
    if (!dayClasses.length) {
      box.appendChild(el('div', 'card note', ttMode === 'gym'
        ? 'The gym is closed on ' + dowOf(selDate) + '.'
        : 'No classes on ' + dowOf(selDate) + ' — rest days build muscle too 🛋️'));
    }
    dayClasses.forEach((c) => box.appendChild(slotRow(c, selDate, allBookings)));
    $('#ttNote').textContent = !authed ? 'Tap “Log in” to book — it takes 10 seconds.'
      : (ttMode === 'gym' ? 'One hour at a time · members only · limited spaces so everyone has room to train.' : '');
  }

  $$('#ttSeg button').forEach((b) => b.addEventListener('click', () => { ttMode = b.dataset.t; renderTimetable(true); }));
  $$('[data-gym]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); ttMode = 'gym'; go('timetable'); }));

  function window14() {
    const dates = [];
    for (let i = 0; i < 14; i++) { const d = new Date(); d.setDate(d.getDate() + i); dates.push(fmtISO(d)); }
    return dates;
  }

  /* After a booking or cancellation, refresh the page the member is actually looking at
     (the slot rows are shown both on Home and on the Timetable). */
  function refreshAfterBooking() {
    bkCache = null;
    const home = document.getElementById('mhome');
    if (home && home.classList.contains('active')) renderDash(); else renderTimetable();
  }

  function slotRow(c, iso, allBookings) {
    const gym = isGym(c);
    const row = el('div', 'slot');
    const t = el('span', 'time', c.start_time);
    row.appendChild(t);
    const what = el('span', 'what');
    what.appendChild(el('b', '', c.name));
    what.appendChild(el('small', '', gym ? c.start_time + ' – ' + endTime(c.start_time) + ' · gym floor' : [c.coach, c.info].filter(Boolean).join(' · ')));
    /* an hour that has already started can't be booked today */
    const started = gym && iso === fmtISO(new Date()) && c.start_time <= new Date().toTimeString().slice(0, 5);
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
        b.addEventListener('click', async () => { b.disabled = true; try { await DB.cancel(mine.id); refreshAfterBooking(); } catch (e) { b.disabled = false; } });
      } else {
        const locked = gym && gymState !== 'yes';
        b.textContent = locked ? (gymState === 'error' ? 'Try again' : 'Members only') : started ? 'Started' : 'Book';
        b.disabled = locked || left <= 0 || started;
        b.addEventListener('click', async () => {
          if (healthRec !== undefined && !healthOk()) { openHealth(true); return; }
          b.disabled = true;
          try { await DB.book(c.id, iso); refreshAfterBooking(); }
          catch (e) {
            b.disabled = false;
            const msg = (e && e.message) || '';
            if (gym && /Gym & Exercise Class members/.test(msg)) { gymState = 'no'; gymCheckedAt = Date.now(); refreshAfterBooking(); return; }
            $('#ttNote').textContent = msg || 'Could not book. Please try again.';
          }
        });
      }
      act.appendChild(b);
    }
    row.appendChild(act);
    return row;
  }

  /* ---------- DASHBOARD (member home) ---------- */
  async function renderDash() {
    const first = (profile && profile.full_name) ? profile.full_name.split(' ')[0] : '';
    $('#healthBanner').style.display = (authed && healthRec !== undefined && !healthOk()) ? 'block' : 'none';
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

      const lastW = measBlocked() ? null : wts.filter((w) => w.kg).slice(-1)[0];
      $('#statWeight').textContent = lastW ? lastW.kg + 'kg' : '–';

      // today's classes
      const today = fmtISO(new Date());
      const todayBookings = allBk.filter((b) => b.date === today);
      const todays = classes.filter((c) => c.day_name === dowOf(today) && !isGym(c));
      $('#gymCta').style.display = classes.some(isGym) ? 'block' : 'none';
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

  $('#measOn').addEventListener('click', () => { go('profile'); setTimeout(() => { const r = $('#measRow'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); });
  $('#kgSave').addEventListener('click', async () => {
    if (measBlocked()) return go('profile');
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
    const blocked = measBlocked();
    $('#measCard').style.display = blocked ? 'block' : 'none';
    $('#measForm').style.display = blocked ? 'none' : 'block';
    if (blocked) return;
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
    const [ws0, wos] = await Promise.all([
      DB.getWeights().catch(() => []),
      DB.getWorkouts(500).catch(() => [])
    ]);
    const ws = measBlocked() ? [] : ws0;
    if (measBlocked() && progMode !== 'vol') stats.appendChild(el('p', 'note', 'Weight and body fat tracking is off. You can turn it on in the Health & safety form (Profile → Health & consent) if you want to track it.'));

    if (progMode === 'weight') {
      const pts = ws.filter((w) => w.kg).map((w) => ({ label: fmtShort(w.date), v: Number(w.kg) }));
      lineChart(cv, pts, 'kg');
      statCards(stats, pts, ' kg');
    } else if (progMode === 'bf') {
      const pts = ws.filter((w) => w.body_fat_pct).map((w) => ({ label: fmtShort(w.date), v: Number(w.body_fat_pct) }));
      lineChart(cv, pts, '%');
      statCards(stats, pts, '%');
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
      const d = el('div', 'stat'); const b = el('b', '', s[1]); b.appendChild(el('span', 'u', unit)); d.appendChild(b); d.appendChild(el('small', '', s[0])); box.appendChild(d);
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

  /* ---------- LIBRARY (exercises + workouts) ---------- */
  let libMode = 'exercises', exGroup = 'All', exEquip = 'All', exData = null;

  $$('#libSeg button').forEach((b) => b.addEventListener('click', () => {
    libMode = b.dataset.t;
    $$('#libSeg button').forEach((x) => x.classList.toggle('sel', x === b));
    renderLibrary();
  }));
  $('#exSearch').addEventListener('input', renderExercises);

  function renderLibrary() {
    $('#libExercises').style.display = libMode === 'exercises' ? '' : 'none';
    $('#libWorkouts').style.display = libMode === 'workouts' ? '' : 'none';
    $('#libMeals').style.display = libMode === 'meals' ? '' : 'none';
    if (libMode === 'exercises') renderExercises(); else if (libMode === 'meals') renderMeals(); else renderTemplates();
  }

  function fillFilters(list) {
    const uniq = (k) => ['All'].concat(list.map((x) => x[k]).filter((g, i, arr) => g && arr.indexOf(g) === i));
    const gbox = $('#exGroups'); gbox.textContent = '';
    uniq('muscle_group').forEach((g) => {
      const b = el('button', g === exGroup ? 'sel' : '', g);
      b.addEventListener('click', () => {
        exGroup = g;
        $$('#exGroups button').forEach((x) => x.classList.toggle('sel', x === b));
        renderExercises();
      });
      gbox.appendChild(b);
    });
    const sel = $('#exEquip'); sel.textContent = '';
    uniq('equipment').forEach((g) => {
      const o = el('option', '', g === 'All' ? 'All equipment' : g); o.value = g; sel.appendChild(o);
    });
    sel.value = exEquip;
  }
  $('#exEquip').addEventListener('change', (e) => { exEquip = e.target.value; renderExercises(); });

  async function renderExercises() {
    if (!exData) {
      exData = await DB.getExercises().catch(() => []);
      fillFilters(exData);
    }
    const q = $('#exSearch').value.trim().toLowerCase();
    const box = $('#exLibList'); box.textContent = '';
    const list = exData.filter((x) => (exGroup === 'All' || x.muscle_group === exGroup)
      && (exEquip === 'All' || x.equipment === exEquip)
      && (!q || x.name.toLowerCase().indexOf(q) !== -1));
    if (!list.length) { box.appendChild(el('p', 'note', 'No exercises match.')); return; }
    list.forEach((x) => {
      const card = el('div', 'card exlib');
      card.appendChild(el('span', 'chip', x.muscle_group));
      card.appendChild(el('span', 'chip eq', x.equipment));
      card.appendChild(el('b', '', x.name));
      card.appendChild(el('div', 'how', x.how_to));
      card.addEventListener('click', () => card.classList.toggle('open'));
      box.appendChild(card);
    });
  }

  /* ---------- LIBRARY: meals (recipes, 7-day plans, foods) ---------- */
  let mealSub = 'recipes', mealType = 'All', mealCache = null;
  const MEAL_TYPES = ['All', 'breakfast', 'lunch', 'dinner', 'snack'];
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const r1 = (n) => Math.round(Number(n) * 10) / 10;
  const macroLine = (k, p, c, f) => Math.round(k) + ' kcal · P ' + r1(p) + ' g · C ' + r1(c) + ' g · F ' + r1(f) + ' g';

  $$('#mealSeg button').forEach((b) => b.addEventListener('click', () => {
    mealSub = b.dataset.m;
    $$('#mealSeg button').forEach((x) => x.classList.toggle('sel', x === b));
    renderMeals();
  }));
  $('#mealSearch').addEventListener('input', renderMeals);

  async function loadMeals() {
    if (mealCache) return mealCache;
    const [recipes, foods, mp] = await Promise.all([
      DB.getRecipes().catch(() => []), DB.getFoods().catch(() => []), DB.getMealPlans().catch(() => ({ plans: [], items: [] }))
    ]);
    mealCache = { recipes, foods, plans: mp.plans, items: mp.items };
    return mealCache;
  }

  function fillMealTypes() {
    const box = $('#mealTypes'); box.textContent = '';
    box.style.display = mealSub === 'recipes' ? '' : 'none';
    MEAL_TYPES.forEach((t) => {
      const b = el('button', t === mealType ? 'sel' : '', t === 'All' ? 'All' : cap(t));
      b.addEventListener('click', () => { mealType = t; renderMeals(); });
      box.appendChild(b);
    });
  }

  function listBlock(title, arr, ordered) {
    const wrap = el('div');
    wrap.appendChild(el('h4', '', title));
    const l = el(ordered ? 'ol' : 'ul');
    (arr || []).forEach((x) => l.appendChild(el('li', '', x)));
    wrap.appendChild(l);
    return wrap;
  }

  async function renderMeals() {
    const data = await loadMeals();
    const box = $('#mealList'); box.textContent = '';
    $('#mealSearchBox').style.display = mealSub === 'plans' ? 'none' : '';
    $('#mealSearch').placeholder = mealSub === 'foods' ? 'Search foods' : 'Search recipes';
    fillMealTypes();
    const q = $('#mealSearch').value.trim().toLowerCase();
    const hit = (x) => !q || x.name.toLowerCase().indexOf(q) !== -1;

    if (mealSub === 'recipes') {
      const list = data.recipes.filter((x) => (mealType === 'All' || x.meal_type === mealType) && hit(x));
      if (!list.length) { box.appendChild(el('p', 'note', data.recipes.length ? 'No recipes match.' : 'Meals are not available yet.')); return; }
      list.forEach((x) => {
        const card = el('div', 'card exlib');
        card.appendChild(el('span', 'chip', cap(x.meal_type)));
        if (x.prep_min) card.appendChild(el('span', 'chip eq', x.prep_min + ' min'));
        card.appendChild(el('b', '', x.name));
        card.appendChild(el('div', 'mealmacro', macroLine(x.kcal, x.protein, x.carbs, x.fat) + ' per serving'));
        const how = el('div', 'how');
        if (x.description) how.appendChild(el('p', '', x.description));
        how.appendChild(listBlock('Ingredients', x.ingredients, false));
        how.appendChild(listBlock('Method', x.steps, true));
        if ((x.tags || []).length) how.appendChild(el('div', 'mealmacro', x.tags.join(' · ')));
        card.appendChild(how);
        card.addEventListener('click', () => card.classList.toggle('open'));
        box.appendChild(card);
      });
    } else if (mealSub === 'foods') {
      const list = data.foods.filter(hit);
      if (!list.length) { box.appendChild(el('p', 'note', data.foods.length ? 'No foods match.' : 'Meals are not available yet.')); return; }
      list.forEach((x) => {
        const f = Number(x.serving_g) / 100;
        const card = el('div', 'card exlib');
        card.appendChild(el('span', 'chip eq', x.serving_label));
        card.appendChild(el('b', '', x.name));
        card.appendChild(el('div', 'mealmacro', macroLine(x.kcal * f, x.protein * f, x.carbs * f, x.fat * f) + ' per serving'));
        card.appendChild(el('div', 'how', 'Per 100 g: ' + macroLine(x.kcal, x.protein, x.carbs, x.fat)));
        card.addEventListener('click', () => card.classList.toggle('open'));
        box.appendChild(card);
      });
    } else {
      if (!data.plans.length) { box.appendChild(el('p', 'note', 'Meals are not available yet.')); return; }
      const byId = {}; data.recipes.forEach((r) => { byId[r.id] = r; });
      data.plans.forEach((p) => {
        const card = el('div', 'card exlib');
        card.appendChild(el('span', 'chip', p.goal));
        card.appendChild(el('span', 'chip eq', p.kcal + ' kcal a day'));
        card.appendChild(el('b', '', p.name));
        card.appendChild(el('div', 'mealmacro', p.description));
        const how = el('div', 'how');
        const seg = el('div', 'seg');
        const dayBox = el('div');
        const items = data.items.filter((i) => i.template_id === p.id);
        const showDay = (d) => {
          Array.from(seg.children).forEach((b) => b.classList.toggle('sel', Number(b.dataset.d) === d));
          dayBox.textContent = '';
          let tk = 0, tp = 0;
          items.filter((i) => i.day === d).sort((a, b) => a.sort - b.sort).forEach((i) => {
            const r = byId[i.recipe_id]; if (!r) return;
            const sv = Number(i.servings);
            tk += r.kcal * sv; tp += r.protein * sv;
            const row = el('div');
            row.appendChild(el('b', '', cap(i.meal_type) + ': '));
            row.appendChild(document.createTextNode(r.name + ' (' + r1(sv) + ' serving' + (sv === 1 ? '' : 's') + ', ' + Math.round(r.kcal * sv) + ' kcal)'));
            dayBox.appendChild(row);
          });
          dayBox.appendChild(el('div', 'mealmacro', 'Day total: ' + Math.round(tk) + ' kcal · ' + r1(tp) + ' g protein'));
        };
        for (let d = 1; d <= 7; d++) {
          const b = el('button', '', 'Day ' + d); b.dataset.d = d;
          b.addEventListener('click', (e) => { e.stopPropagation(); showDay(d); });
          seg.appendChild(b);
        }
        how.appendChild(seg); how.appendChild(dayBox);
        how.addEventListener('click', (e) => e.stopPropagation());
        card.appendChild(how);
        let shown = false;
        card.addEventListener('click', () => { card.classList.toggle('open'); if (!shown) { shown = true; showDay(1); } });
        box.appendChild(card);
      });
    }
  }

  /* ---------- PROFILE ---------- */
  /* ---------- health and allergy form + consent ---------- */
  const HEALTH_VERSION = '2026-10-v1';      // change this when the wording changes, so everyone is asked again
  const HEALTH_MAX_DAYS = 365;              // asked again once a year
  let healthRec;                            // undefined = unknown (offline), null = none yet, object = saved form
  const healthOk = () => !!(healthRec && healthRec.consent_version === HEALTH_VERSION &&
    (Date.now() - new Date(healthRec.consented_at).getTime()) < HEALTH_MAX_DAYS * 86400000);
  const measBlocked = () => authed && healthRec !== undefined && !(healthRec && healthRec.consent_measurements);   // weight/body fat tracking is off
  let measConfirm = false;                  // second tap needed when un-ticking the weight and body fat box
  function pushHealthOnce() {   // push the form once per browser session when the app is reopened
    try { if (sessionStorage.getItem('mygym_health_pushed')) return false; sessionStorage.setItem('mygym_health_pushed', '1'); } catch (e) {}
    return true;
  }
  let healthOpen = false, healthDirty = false;
  function paintLocks() { document.body.classList.toggle('hlock', !!(authed && healthRec !== undefined && !healthOk())); }
  function openHealth(locked) {              // send the member to the Health & safety card on their Profile page
    healthOpen = true; healthDirty = false;
    go('profile');
    setTimeout(() => {
      const c = $('#healthCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (locked) toast($('#hMsg'), 'Complete this form to unlock Bookings, Log and Progress.', true);
    }, 80);
  }
  const hKeys = () => $$('#healthForm [data-k]');
  function paintHealthLogic() {
    const any = hKeys().some((c) => c.checked);
    $('#hAdvice').style.display = any ? 'block' : 'none';
    $('#hOtherWrap').style.display = any ? 'block' : 'none';
  }
  function renderHealth() {
    const rec = healthRec || null;
    const a = (rec && rec.answers) || {};
    hKeys().forEach((c) => { c.checked = !!a[c.dataset.k]; });
    $('#hNone').checked = !!a.none;
    $('#hNoAllergy').checked = !!(rec && rec.no_allergies);
    $('#hAllergy').value = (rec && rec.allergies) || '';
    $('#hAllergy').disabled = $('#hNoAllergy').checked;
    $('#hOther').value = (rec && rec.other_details) || '';
    $('#hConsent').checked = false; $('#hTrue').checked = false;   // consent is always a fresh tick
    $('#hMeas').checked = !!(rec && rec.consent_measurements);       // shows the current setting of the optional box
    measConfirm = false;
    $('#hErr').textContent = '';
    paintHealthLogic();
  }
  hKeys().forEach((c) => c.addEventListener('change', () => { if (c.checked) $('#hNone').checked = false; paintHealthLogic(); }));
  $('#hNone').addEventListener('change', () => { if ($('#hNone').checked) { hKeys().forEach((c) => { c.checked = false; }); paintHealthLogic(); } });
  $('#hNoAllergy').addEventListener('change', () => { if ($('#hNoAllergy').checked) $('#hAllergy').value = ''; $('#hAllergy').disabled = $('#hNoAllergy').checked; });
  $('#hAllergy').addEventListener('input', () => { if ($('#hAllergy').value.trim()) $('#hNoAllergy').checked = false; });
  $('#hMeas').addEventListener('change', () => { measConfirm = false; });
  $('#healthForm').addEventListener('input', () => { healthDirty = true; });
  $('#healthForm').addEventListener('change', () => { healthDirty = true; });
  $('#hLater').addEventListener('click', () => { healthOpen = false; healthDirty = false; go('home'); });
  $('#healthBannerBtn').addEventListener('click', () => openHealth(false));
  $('#healthForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#hErr');
    const anyTick = hKeys().some((c) => c.checked), none = $('#hNone').checked;
    const allergy = $('#hAllergy').value.trim(), noAllergy = $('#hNoAllergy').checked;
    if (!anyTick && !none) return toast(err, 'Please tick what applies to you, or tick "None of these apply to me".', true);
    if (!allergy && !noAllergy) return toast(err, 'Please tick "I have no allergies", or write what you are allergic to.', true);
    if (!$('#hConsent').checked || !$('#hTrue').checked) return toast(err, 'Please tick both boxes in the consent section to continue.', true);
    const wasOn = !!(healthRec && healthRec.consent_measurements), nowOn = $('#hMeas').checked;
    if (wasOn && !nowOn && !measConfirm) { measConfirm = true; return toast(err, 'Un-ticking the weight and body fat box will delete your saved measurements. Tap Save again to confirm, or tick the box to keep them.', true); }
    const answers = { none: none };
    hKeys().forEach((c) => { answers[c.dataset.k] = c.checked; });
    $('#hSave').disabled = true;
    try {
      healthRec = await DB.saveHealth({
        answers, no_allergies: noAllergy, allergies: allergy, other_details: anyTick ? $('#hOther').value.trim() : '',
        consent_health: true, consent_truthful: true, consent_version: HEALTH_VERSION, consented_at: new Date().toISOString(),
        consent_measurements: nowOn, measurements_consented_at: nowOn ? ((healthRec && healthRec.consent_measurements && healthRec.measurements_consented_at) || new Date().toISOString()) : null
      });
      measConfirm = false; healthDirty = false; healthOpen = false;
      paintLocks(); renderHealthProfile(); renderProfile(); renderDash();
      toast($('#hMsg'), 'Thank you. Your form is saved. Bookings, Log and Progress are unlocked.');
      const c0 = $('#healthCard'); if (c0) c0.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (x) {
      toast(err, 'Could not save. Please check your connection and try again.', true);
    }
    $('#hSave').disabled = false;
  });
  function renderHealthProfile() {
    const done = healthOk();
    const unknown = healthRec === undefined;
    paintLocks();
    const showForm = !unknown && (!done || healthOpen);
    $('#hBody').style.display = showForm ? 'block' : 'none';
    $('#hLockNote').style.display = (!unknown && !done) ? 'block' : 'none';
    if (showForm && !healthDirty) renderHealth();
    if (unknown) { $('#hStatus').textContent = 'Could not check right now. Please try again later.'; $('#hEdit').style.display = 'none'; $('#hWithdraw').style.display = 'none'; }
    else {
      $('#hStatus').textContent = done
        ? 'Completed on ' + new Date(healthRec.consented_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '. We ask again once a year.'
        : (healthRec ? 'Please update and re-confirm your form.' : 'Not done yet. It takes about 2 minutes.');
      $('#hEdit').style.display = done ? '' : 'none';
      $('#hEdit').textContent = showForm ? 'Close the form' : 'View or update my answers';
      $('#hWithdraw').style.display = healthRec ? '' : 'none';
      $('#hWithdraw').textContent = 'Withdraw consent and delete my answers'; $('#hWithdraw').dataset.armed = '';
    }
    // weight and body fat switch (separate consent)
    const mOn = !!(healthRec && healthRec.consent_measurements);
    const sw = $('#mSwitch');
    sw.setAttribute('aria-checked', mOn ? 'true' : 'false');
    sw.disabled = unknown || !healthRec;
    $('#mStatus').textContent = unknown ? ''
      : !healthRec ? 'Locked until the form above is complete.'
      : mOn ? 'On. You consented to MY GYM London keeping the weight and body fat you log. Switch off to delete them.'
      : 'Off. Switch on to consent to MY GYM London keeping the weight and body fat you log, so you can track your progress.';
  }
  $('#hEdit').addEventListener('click', () => {
    if ($('#hBody').style.display === 'block' && healthOk()) { healthOpen = false; healthDirty = false; renderHealthProfile(); return; }
    healthOpen = true; healthDirty = false; renderHealthProfile();
  });
  $('#mSwitch').addEventListener('click', async () => {
    const sw = $('#mSwitch');
    if (sw.disabled || !healthRec) return;
    const on = sw.getAttribute('aria-checked') === 'true';
    if (!on) {
      sw.disabled = true;
      try {
        await DB.turnOnMeasurements(HEALTH_VERSION);
        healthRec = Object.assign({}, healthRec, { consent_measurements: true, measurements_consented_at: new Date().toISOString() });
        renderHealthProfile(); renderProfile(); renderDash();
        toast($('#hMsg'), 'Weight and body fat tracking is on. You will find it in the Log tab.');
      } catch (x) { toast($('#hMsg'), 'Could not switch it on right now. Please try again.', true); sw.disabled = false; }
      return;
    }
    if (sw.dataset.armed !== '1') {
      sw.dataset.armed = '1';
      $('#mStatus').textContent = 'Tap the switch again to turn it off and DELETE your saved weight and body fat.';
      setTimeout(() => { if (sw.dataset.armed === '1') { sw.dataset.armed = ''; renderHealthProfile(); } }, 6000);
      return;
    }
    sw.dataset.armed = ''; sw.disabled = true;
    try {
      await DB.turnOffMeasurements(HEALTH_VERSION);
      healthRec = Object.assign({}, healthRec, { consent_measurements: false, measurements_consented_at: null });
      profile = Object.assign(profile || {}, { weight_kg: null });
      renderHealthProfile(); renderProfile(); renderDash();
      toast($('#hMsg'), 'Tracking is off and your saved weight and body fat records have been deleted.');
    } catch (x) { toast($('#hMsg'), 'Could not do that right now. Please try again or email us.', true); renderHealthProfile(); }
  });
  $('#hWithdraw').addEventListener('click', async () => {
    const b = $('#hWithdraw');
    if (b.dataset.armed !== '1') {
      b.dataset.armed = '1'; b.textContent = 'Tap again to confirm: delete my answers';
      setTimeout(() => { if (b.dataset.armed === '1') { b.dataset.armed = ''; b.textContent = 'Withdraw consent and delete my answers'; } }, 6000);
      return;
    }
    b.disabled = true;
    try {
      await DB.withdrawHealth(HEALTH_VERSION);
      healthRec = null; healthOpen = false; healthDirty = false; profile = Object.assign(profile || {}, { weight_kg: null }); paintLocks(); renderHealthProfile(); renderProfile(); renderDash();
      toast($('#hMsg'), 'Done. Your health answers have been deleted. You will need to fill the form again before booking.');
    } catch (x) { toast($('#hMsg'), 'Could not delete right now. Please try again or email us.', true); }
    b.disabled = false;
  });

  /* ---------- class reminders (push, one hour before a booking) ---------- */
  const VAPID = (window.MYGYM_CONFIG || {}).VAPID_PUBLIC_KEY || '';
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const b64ToBytes = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  async function currentSub() {
    try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; }
  }
  function paintReminders(on, note, disabled) {
    const sw = $('#remSwitch');
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    sw.disabled = !!disabled;
    $('#remNote').textContent = note || '';
  }
  async function renderReminders() {
    if (!DB.isLive() || !pushOk()) { paintReminders(false, DB.isLive() ? 'This phone or browser cannot show reminders.' : 'Reminders work in the live app.', true); return; }
    if (isIOS && !standalone()) { paintReminders(false, 'On iPhone, add MY GYM to your Home Screen first (Share → Add to Home Screen), then open the app from there to turn reminders on.', true); return; }
    if (Notification.permission === 'denied') { paintReminders(false, 'Notifications are blocked for this app. Allow them in your phone settings, then come back.', true); return; }
    const sub = await currentSub();
    paintReminders(!!sub && Notification.permission === 'granted', sub ? 'On for this phone. You will get a reminder one hour before each booking.' : '');
  }
  async function turnOnReminders() {
    paintReminders(false, 'Asking for permission…', true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { await renderReminders(); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) });
      await DB.savePushSub(sub.toJSON());
    } catch (e) {
      paintReminders(false, 'Could not turn reminders on. Please try again.', false);
      return;
    }
    await renderReminders();
  }
  async function turnOffReminders(quiet) {
    try {
      if (!pushOk()) return;
      const sub = await currentSub();
      if (sub) { const ep = sub.endpoint; await DB.deletePushSub(ep).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    } catch (e) {}
    if (!quiet) await renderReminders();
  }
  $('#remSwitch').addEventListener('click', async () => {
    if ($('#remSwitch').getAttribute('aria-checked') === 'true') await turnOffReminders(false);
    else await turnOnReminders();
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (authed && h && document.getElementById(h) && document.getElementById(h).classList.contains('view')) go(h);
  });

  async function renderProfile() {
    renderReminders();
    renderHealthProfile();
    if (!profile) profile = (await DB.getProfile().catch(() => null)) || {};
    $('#pName').value = profile.full_name || '';
    $('#pPhone').value = profile.phone || '';
    $('#pWeight').value = measBlocked() ? '' : (profile.weight_kg || '');
    $('#pWeight').disabled = measBlocked();
    $('#pWeight').placeholder = measBlocked() ? 'Tracking is off' : '72.5';
    $('#pGoal').value = profile.goal || '';
    $('#pEmail').textContent = (me && me.email) || '';
  }
  $('#pSave').addEventListener('click', async () => {
    const patch = {
      full_name: $('#pName').value.trim(),
      phone: $('#pPhone').value.trim(),
      goal: $('#pGoal').value
    };
    if (!measBlocked()) patch.weight_kg = parseFloat($('#pWeight').value) || null;
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
        healthRec = await DB.getHealth().catch(() => undefined);
        paintLocks();
        setNav();
      }
    } catch (e) {}
    const h = location.hash.slice(1);
    const map = { book: 'timetable', join: 'home', about: 'home', contact: 'library', templates: 'library' };
    if (/type=recovery/.test(h)) go('resetpw');
    else if (h && document.getElementById(h)) go(h);
    else if (h && map[h]) go(map[h]);
    else if (authed && healthRec !== undefined && !healthOk() && pushHealthOnce()) openHealth(false);
    else go('home');
  })();

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
