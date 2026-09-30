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
  const fmtShort = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  const toast = (node, msg, isErr) => {
    node.textContent = msg || '';
    node.className = isErr ? 'err' : 'ok';
    if (msg) setTimeout(() => { if (node.textContent === msg) node.textContent = ''; }, 4000);
  };

  /* ---------- state ---------- */
  let authed = false;
  let me = null;        // {id,email}
  let profile = null;
  let classes = [];     // DB classes (live) or demo list
  let selDate = fmtISO(new Date());

  /* ---------- navigation ---------- */
  function go(v) {
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === v));
    $$('.nwrap button').forEach((b) => b.classList.toggle('sel', b.dataset.v === v));
    window.scrollTo({ top: 0 });
    if (v === 'book' && authed) renderBook();
    if (v === 'log' && authed) renderLog();
    if (v === 'templates' && authed) renderTemplates();
    if (v === 'profile' && authed) renderProfile();
    if (v === 'mhome' && authed) renderMHome();
    if (v === 'timetable') renderPublicTimetable();
  }
  window.__mygymGo = go;

  $$('.nwrap button').forEach((b) => b.addEventListener('click', () => go(b.dataset.v)));
  $$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    go(a.dataset.goto);
    history.replaceState(null, '', '#' + a.dataset.goto);
  }));

  function setNav() {
    $('#navGuest').classList.toggle('show', !authed);
    $('#navMember').classList.toggle('show', authed);
    const ab = $('#authBtn');
    ab.textContent = authed ? '👤 Me' : 'Log in';
    $('#demoBanner').style.display = DB.isLive() ? 'none' : 'block';
  }

  $('#authBtn').addEventListener('click', () => go(authed ? 'profile' : 'login'));

  /* ---------- auth flow ---------- */
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
      : 'Welcome back! Log in to book classes and track progress.';
    $('#aErr').textContent = '';
  }));

  $('#aSubmit').addEventListener('click', async () => {
    const email = $('#aEmail').value.trim();
    const pass = $('#aPass').value;
    const err = $('#aErr');
    if (!email || !pass) return toast(err, 'Enter your email and password.', true);
    if (pass.length < 6) return toast(err, 'Password must be at least 6 characters.', true);
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
    go('mhome');
  }

  /* ---------- public timetable (guests) ---------- */
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let pubTT = null;

  async function renderPublicTimetable() {
    if (pubTT) return;
    let byDay = {};
    if (DB.isLive()) {
      try {
        const rows = await DB.getClasses();
        if (rows && rows.length) {
          DAY_ORDER.forEach((d) => (byDay[d] = []));
          rows.forEach((c) => {
            (byDay[c.day_name] = byDay[c.day_name] || []).push(
              { time: c.start_time, name: c.name, coach: c.coach || '', info: c.info || '' });
          });
          DAY_ORDER.forEach((d) => {
            const arr = byDay[d] || [];
            arr.sort((a, b) => a.time.localeCompare(b.time));
            if (!arr.length) delete byDay[d];
          });
        }
      } catch (e) { byDay = {}; }
    }
    if (!Object.keys(byDay).length) byDay = (typeof TIMETABLE !== 'undefined') ? TIMETABLE : {};
    pubTT = byDay;
    const tabsEl = $('#dayTabs');
    tabsEl.textContent = '';
    Object.keys(pubTT).forEach((d) => {
      const b = el('button', '', d.slice(0, 3));
      b.dataset.day = d;
      b.addEventListener('click', () => renderPubDay(d));
      tabsEl.appendChild(b);
    });
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    renderPubDay(pubTT[today] ? today : Object.keys(pubTT)[0]);
  }

  function renderPubDay(d) {
    $$('#dayTabs button').forEach((b) => b.classList.toggle('sel', b.dataset.day === d));
    const box = $('#slots');
    box.textContent = '';
    const slots = pubTT[d] || [];
    if (!slots.length) {
      box.appendChild(el('div', 'card note', 'Rest day — see you tomorrow! 🛋️'));
      return;
    }
    slots.forEach((s) => {
      const row = el('div', 'slot');
      row.appendChild(el('span', 'time', s.time));
      const what = el('span', 'what');
      what.appendChild(el('b', '', s.name));
      what.appendChild(el('small', '', [s.coach, s.info].filter(Boolean).join(' · ')));
      row.appendChild(what);
      box.appendChild(row);
    });
  }

  /* ---------- member home ---------- */
  async function renderMHome() {
    const name = (profile && profile.full_name) ? profile.full_name.split(' ')[0] : '';
    $('#helloName').textContent = name ? 'Hi ' + name + ' 💚' : 'Welcome back 💚';
    try {
      const wins = await DB.getWorkouts(100);
      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const monISO = fmtISO(monday);
      $('#statWeek').textContent = wins.filter((w) => w.date >= monISO).length;
      const wts = await DB.getWeights();
      $('#statWeight').textContent = wts.length ? wts[wts.length - 1].kg + 'kg' : '–';
      const upcoming = await myUpcoming();
      if (upcoming.length) {
        const nx = upcoming[0];
        $('#statNext').textContent = fmtShort(nx.date).replace(/ \d{4}$/, '');
        $('#nextWrap').style.display = 'block';
        const c = $('#nextCard');
        c.textContent = '';
        const row = el('div', 'slot');
        row.appendChild(el('span', 'time', nx.class.start_time));
        const what = el('span', 'what');
        what.appendChild(el('b', '', nx.class.name));
        what.appendChild(el('small', '', fmtShort(nx.date) + ' · manage in Book tab'));
        row.appendChild(what);
        c.appendChild(row);
      } else {
        $('#statNext').textContent = '–';
        $('#nextWrap').style.display = 'none';
      }
    } catch (e) { /* offline / not ready */ }
  }

  async function myUpcoming() {
    const today = fmtISO(new Date());
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); dates.push(fmtISO(d));
    }
    const all = await DB.getBookingsForDates(dates);
    const mine = all.filter((b) => b.user_id === me.id && b.date >= today);
    mine.sort((a, b) => a.date.localeCompare(b.date));
    return mine.map((b) => ({ booking: b, date: b.date, class: classes.find((c) => c.id === b.class_id) }))
      .filter((x) => x.class);
  }

  /* ---------- booking view ---------- */
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  async function renderBook() {
    if (!classes.length) classes = await DB.getClasses().catch(() => []);
    const strip = $('#dateStrip');
    strip.textContent = '';
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const iso = fmtISO(d);
      dates.push(iso);
      const b = el('button');
      b.appendChild(el('span', 'dow', i === 0 ? 'Today' : DAY_NAMES[d.getDay()].slice(0, 3)));
      b.appendChild(el('span', 'dnum', String(d.getDate())));
      if (iso === selDate) b.classList.add('sel');
      b.addEventListener('click', () => { selDate = iso; renderBook(); });
      strip.appendChild(b);
    }
    let allBookings = [];
    try { allBookings = await DB.getBookingsForDates(dates); } catch (e) {}

    const dayName = DAY_NAMES[new Date(selDate + 'T12:00:00').getDay()];
    const dayClasses = classes.filter((c) => c.day_name === dayName);
    const box = $('#bookSlots');
    box.textContent = '';
    if (!dayClasses.length) {
      box.appendChild(el('div', 'card note', 'No classes on ' + dayName + ' — rest days build muscle too 🛋️'));
    }
    dayClasses.forEach((c) => {
      const cbs = allBookings.filter((b) => b.class_id === c.id && b.date === selDate);
      const mine = cbs.find((b) => b.user_id === me.id);
      const left = (c.capacity || 8) - cbs.length;
      const row = el('div', 'slot');
      row.appendChild(el('span', 'time', c.start_time));
      const what = el('span', 'what');
      what.appendChild(el('b', '', c.name));
      what.appendChild(el('small', '', [c.coach, c.info].filter(Boolean).join(' · ')));
      what.appendChild(el('small', 'spots ' + (left > 0 ? 'free' : 'full'),
        left > 0 ? left + ' spot' + (left === 1 ? '' : 's') + ' left' : 'FULL'));
      row.appendChild(what);
      const act = el('span', 'act');
      const btn = el('button', 'btn-small');
      if (mine) {
        btn.textContent = 'Cancel';
        btn.className = 'btn-small danger';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try { await DB.cancel(mine.id); renderBook(); } catch (e) { btn.disabled = false; }
        });
      } else {
        btn.textContent = 'Book';
        btn.disabled = left <= 0;
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try { await DB.book(c.id, selDate); renderBook(); } catch (e) { btn.disabled = false; }
        });
      }
      act.appendChild(btn);
      row.appendChild(act);
      box.appendChild(row);
    });
    renderMyBookings(allBookings);
  }

  function renderMyBookings(allBookings) {
    const box = $('#myBookings');
    box.textContent = '';
    const today = fmtISO(new Date());
    const mine = allBookings
      .filter((b) => b.user_id === me.id && b.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!mine.length) {
      box.appendChild(el('p', 'note', 'Nothing booked yet — your next session is one tap away.'));
      return;
    }
    mine.forEach((b) => {
      const c = classes.find((x) => x.id === b.class_id);
      if (!c) return;
      const row = el('div', 'slot');
      row.appendChild(el('span', 'time', c.start_time));
      const what = el('span', 'what');
      what.appendChild(el('b', '', c.name));
      what.appendChild(el('small', '', fmtShort(b.date)));
      row.appendChild(what);
      const act = el('span', 'act');
      const btn = el('button', 'btn-small danger', 'Cancel');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try { await DB.cancel(b.id); renderBook(); } catch (e) { btn.disabled = false; }
      });
      act.appendChild(btn);
      row.appendChild(act);
      box.appendChild(row);
    });
  }

  /* ---------- workout log ---------- */
  $$('#logSeg button').forEach((b) => b.addEventListener('click', () => {
    $$('#logSeg button').forEach((x) => x.classList.toggle('sel', x === b));
    $('#paneWorkouts').style.display = b.dataset.t === 'workouts' ? 'block' : 'none';
    $('#paneWeight').style.display = b.dataset.t === 'weight' ? 'block' : 'none';
    if (b.dataset.t === 'weight') { $('#kgDate').value = fmtISO(new Date()); renderWeights(); }
  }));

  $('#wSave').addEventListener('click', async () => {
    const exercise = $('#wExercise').value.trim();
    if (!exercise) return toast($('#wErr'), 'What did you do? e.g. Goblet squat', true);
    const entry = {
      date: fmtISO(new Date()),
      title: '',
      exercise,
      sets: parseInt($('#wSets').value, 10) || null,
      reps: $('#wReps').value.trim() || null,
      weight_kg: parseFloat($('#wWeight').value) || null,
      notes: $('#wNotes').value.trim() || ''
    };
    $('#wSave').disabled = true;
    try {
      await DB.addWorkout(entry);
      ['#wExercise', '#wSets', '#wReps', '#wWeight', '#wNotes'].forEach((s) => ($(s).value = ''));
      renderWorkouts();
      renderMHome().catch(() => {});
    } catch (e) { toast($('#wErr'), (e && e.message) || 'Could not save', true); }
    $('#wSave').disabled = false;
  });

  async function renderLog() { renderWorkouts(); }

  async function renderWorkouts() {
    const box = $('#wHistory');
    box.textContent = '';
    let logs = [];
    try { logs = await DB.getWorkouts(50); } catch (e) {}
    if (!logs.length) { box.appendChild(el('p', 'note', 'No workouts logged yet. Your first one is waiting 💪')); return; }
    logs.forEach((w) => {
      const row = el('div', 'wlog');
      const left = el('div');
      left.appendChild(el('b', '', w.title ? w.title + ' — ' + w.exercise : w.exercise));
      const bits = [];
      if (w.sets) bits.push(w.sets + ' sets');
      if (w.reps) bits.push(w.reps + ' reps');
      if (w.weight_kg) bits.push(w.weight_kg + ' kg');
      if (w.notes) bits.push(w.notes);
      left.appendChild(el('small', '', fmtShort(w.date) + (bits.length ? ' · ' + bits.join(' · ') : '')));
      row.appendChild(left);
      const del = el('button', 'del', '✕');
      del.addEventListener('click', async () => {
        await DB.deleteWorkout(w.id).catch(() => {});
        renderWorkouts();
      });
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  $('#kgSave').addEventListener('click', async () => {
    const date = $('#kgDate').value || fmtISO(new Date());
    const kg = parseFloat($('#kgVal').value);
    if (!kg || kg < 20 || kg > 400) return toast($('#kgErr'), 'Enter a weight in kg (20–400).', true);
    $('#kgSave').disabled = true;
    try {
      await DB.addWeight(date, kg);
      $('#kgVal').value = '';
      renderWeights();
      renderMHome().catch(() => {});
    } catch (e) { toast($('#kgErr'), (e && e.message) || 'Could not save', true); }
    $('#kgSave').disabled = false;
  });

  async function renderWeights() {
    const box = $('#kgHistory');
    box.textContent = '';
    let ws = [];
    try { ws = await DB.getWeights(); } catch (e) {}
    if (!ws.length) { box.appendChild(el('p', 'note', 'No weigh-ins yet. Track weekly — trends beat single numbers.')); drawChart([]); return; }
    drawChart(ws);
    ws.slice().reverse().slice(0, 10).forEach((w) => {
      const row = el('div', 'wlog');
      row.appendChild(el('b', '', w.kg + ' kg'));
      row.appendChild(el('small', '', fmtShort(w.date)));
      box.appendChild(row);
    });
  }

  function drawChart(ws) {
    const cv = $('#kgChart');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (ws.length < 2) {
      ctx.fillStyle = '#93a1b0';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add 2+ weigh-ins to see your trend', cv.width / 2, cv.height / 2);
      return;
    }
    const pad = 46;
    const kgs = ws.map((w) => Number(w.kg));
    let min = Math.min.apply(null, kgs), max = Math.max.apply(null, kgs);
    if (min === max) { min -= 1; max += 1; }
    const X = (i) => pad + (i * (cv.width - pad * 2)) / (ws.length - 1);
    const Y = (v) => cv.height - pad - ((v - min) * (cv.height - pad * 2)) / (max - min);
    ctx.strokeStyle = '#2c3947'; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = pad / 2 + (g * (cv.height - pad)) / 4;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(cv.width - pad, y); ctx.stroke();
    }
    ctx.strokeStyle = '#7ee081'; ctx.lineWidth = 3;
    ctx.beginPath();
    ws.forEach((w, i) => (i ? ctx.lineTo(X(i), Y(Number(w.kg))) : ctx.moveTo(X(i), Y(Number(w.kg)))));
    ctx.stroke();
    ctx.fillStyle = '#7ee081';
    ws.forEach((w, i) => { ctx.beginPath(); ctx.arc(X(i), Y(Number(w.kg)), 4, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#93a1b0'; ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(max.toFixed(1), 6, Y(max) + 5);
    ctx.fillText(min.toFixed(1), 6, Y(min) + 5);
    ctx.fillText(fmtShort(ws[0].date), pad, cv.height - 14);
    ctx.textAlign = 'right';
    ctx.fillText(fmtShort(ws[ws.length - 1].date), cv.width - pad, cv.height - 14);
  }

  /* ---------- templates ---------- */
  async function renderTemplates() {
    const box = $('#tplList');
    box.textContent = '';
    let tpls = [];
    try { tpls = await DB.getTemplates(); } catch (e) {}
    if (!DB.isLive()) {
      try {
        const mine = JSON.parse(localStorage.getItem('mygym_demo_my_templates') || '[]');
        tpls = tpls.concat(mine);
      } catch (e) {}
    }
    tpls.forEach((t) => {
      const card = el('div', 'card tpl');
      const head = el('div');
      head.appendChild(el('span', 'chip', t.level || 'All levels'));
      head.appendChild(el('b', '', t.name));
      const desc = el('p', 'sub', t.description || '');
      desc.style.margin = '6px 0 10px';
      head.appendChild(desc);
      card.appendChild(head);
      const ex = el('div', 'ex');
      (t.exercises || []).forEach((x) => {
        const row = el('div');
        row.appendChild(el('b', '', x.name + ' '));
        row.appendChild(document.createTextNode(x.sets ? x.sets + '×' + (x.reps || '') : (x.reps || '')));
        ex.appendChild(row);
      });
      const btnRow = el('div');
      btnRow.style.marginTop = '10px';
      const logBtn = el('button', 'btn-small', '🏋️ Log this plan');
      logBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        logBtn.disabled = true;
        try {
          for (const x of (t.exercises || [])) {
            await DB.addWorkout({
              date: fmtISO(new Date()), title: t.name, exercise: x.name,
              sets: x.sets || null, reps: x.reps ? String(x.reps) : null,
              weight_kg: null, notes: x.note || ''
            });
          }
          toast($('#tplMsg'), '✅ Logged "' + t.name + '" — nice work!');
        } catch (err) { toast($('#tplMsg'), (err && err.message) || 'Could not log', true); }
        logBtn.disabled = false;
      });
      btnRow.appendChild(logBtn);
      ex.appendChild(btnRow);
      card.appendChild(ex);
      card.addEventListener('click', () => card.classList.toggle('open'));
      box.appendChild(card);
    });
  }

  $('#tplFromLog').addEventListener('click', async () => {
    let logs = [];
    try { logs = await DB.getWorkouts(5); } catch (e) {}
    if (!logs.length) return toast($('#tplMsg'), 'Log a few workouts first!', true);
    const seen = {};
    const exercises = [];
    logs.forEach((w) => {
      if (seen[w.exercise]) return;
      seen[w.exercise] = true;
      exercises.push({ name: w.exercise, sets: w.sets || 3, reps: w.reps || '10', note: '' });
    });
    try {
      await DB.addTemplate({
        name: 'My plan · ' + fmtShort(fmtISO(new Date())),
        level: 'Mine', goal: 'Personal',
        description: 'Built from my logged workouts.',
        exercises
      });
      toast($('#tplMsg'), '✅ Saved to your plans!');
      renderTemplates();
    } catch (e) { toast($('#tplMsg'), (e && e.message) || 'Could not save', true); }
  });

  /* ---------- profile ---------- */
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
      toast($('#pMsg'), '✅ Saved!');
      renderMHome().catch(() => {});
    } catch (e) { toast($('#pMsg'), (e && e.message) || 'Could not save', true); }
    $('#pSave').disabled = false;
  });

  /* ---------- install prompt ---------- */
  let deferredPrompt = null;
  const installBtn = $('#installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
  });
  installBtn.addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  });

  /* ---------- offline indicator ---------- */
  const tag = $('#offlineTag');
  function net() { tag.style.display = navigator.onLine ? 'none' : 'block'; }
  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  net();

  /* ---------- boot ---------- */
  (async function boot() {
    setNav();
    renderPublicTimetable();
    try {
      me = await DB.getUser();
      if (me) {
        authed = true;
        profile = await DB.getProfile().catch(() => null);
        classes = await DB.getClasses().catch(() => []);
        setNav();
        const h = location.hash.slice(1);
        if (h && document.getElementById(h)) go(h); else go('mhome');
        return;
      }
    } catch (e) {}
    const h = location.hash.slice(1);
    if (h && document.getElementById(h)) go(h);
  })();

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
