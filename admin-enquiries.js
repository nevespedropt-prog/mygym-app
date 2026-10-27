/* MY GYM admin: "Enquiries" page. Uses the admin's existing app sign-in (same site, so the session is shared).
   Row security allows only admins to read form_submissions and to change status, note and handled_at. */
(function () {
  "use strict";
  var CFG = window.MYGYM_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  var STATUS = [["contacted", "Contacted"], ["trial", "Trial booked"], ["joined", "Joined"], ["not_now", "Not now"], ["spam", "Spam"]];
  var LABEL = { new: "New", contacted: "Contacted", trial: "Trial booked", joined: "Joined", not_now: "Not now", spam: "Spam" };
  var FORMS = { "contact": "Contact", "pt-enquiry": "Personal training", "trial-class": "Free class", "landing-offer": "Offer", "corporate-enquiry": "Corporate", "kids-registration": "Kids Gym", "member-request": "Member request", "feedback": "Feedback", "refer-friend": "Referral", "newsletter-signup": "Newsletter" };
  var HIDE = { utm_source: 1, utm_medium: 1, utm_campaign: 1, page_url: 1 };
  var rows = [];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(d) { return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  function pretty(k) { return k.replace(/_/g, " ").replace(/^./, function (c) { return c.toUpperCase(); }); }
  function val(v) { return Array.isArray(v) ? v.join(", ") : String(v); }

  function card(r) {
    var d = r.data || {};
    var c = el("div", "card " + (r.status === "new" ? "new" : r.status === "joined" ? "joined" : ""));
    var h = el("div", "head");
    var name = d.full_name || d.parent_name || d.first_name || d.friend_name || d.email || "(no name)";
    h.appendChild(el("b", "", name));
    var right = el("span", "meta", (FORMS[r.form_id] || r.form_id) + " · " + fmt(r.created_at) + " ");
    right.appendChild(el("span", "tag", LABEL[r.status] || r.status));
    h.appendChild(right);
    c.appendChild(h);
    var email = d.email || d.friend_email, phone = d.phone;
    var m = el("div", "meta");
    if (email) { var a = el("a", "", email); a.href = "mailto:" + email; m.appendChild(a); }
    if (email && phone) m.appendChild(document.createTextNode("  ·  "));
    if (phone) { var t = el("a", "", phone); t.href = "tel:" + String(phone).replace(/[^+\d]/g, ""); m.appendChild(t); }
    c.appendChild(m);
    var dl = el("dl");
    Object.keys(d).forEach(function (k) {
      if (HIDE[k] || k === "email" || k === "phone" || k === "full_name" || d[k] === "" || d[k] == null) return;
      dl.appendChild(el("dt", "", pretty(k))); dl.appendChild(el("dd", "", val(d[k])));
    });
    c.appendChild(dl);
    var note = el("textarea"); note.maxLength = 500; note.placeholder = "Private note (only you see this)"; note.value = r.note || "";
    note.setAttribute("aria-label", "Note for " + name);
    c.appendChild(note);
    var btns = el("div", "btns");
    function save(status, b) {
      var all = c.querySelectorAll("button"); all.forEach(function (x) { x.disabled = true; });
      var patch = { note: note.value.trim() || null, handled_at: new Date().toISOString() };
      if (status) patch.status = status;
      sb.from("form_submissions").update(patch).eq("id", r.id).then(function (res) {
        all.forEach(function (x) { x.disabled = false; });
        if (res.error) { b.textContent = "Not saved, try again"; return; }
        r.note = patch.note; r.handled_at = patch.handled_at; if (status) r.status = status;
        render();
      });
    }
    STATUS.forEach(function (s) {
      var b = el("button", r.status === s[0] ? "on" : "", s[1]);
      b.type = "button"; b.addEventListener("click", function () { save(s[0], b); });
      btns.appendChild(b);
    });
    var sv = el("button", "sec", "Save note"); sv.type = "button"; sv.addEventListener("click", function () { save(null, sv); });
    btns.appendChild(sv);
    c.appendChild(btns);
    return c;
  }

  function render() {
    var f = $("flt").value, fm = $("frm").value, list = $("list");
    list.textContent = "";
    var shown = rows.filter(function (r) {
      if (fm && r.form_id !== fm) return false;
      if (f === "all") return true;
      if (f === "open") return r.status === "new" || r.status === "contacted" || r.status === "trial";
      return r.status === f;
    });
    if (!shown.length) { list.appendChild(el("div", "box", "Nothing to show here.")); return; }
    shown.forEach(function (r) { list.appendChild(card(r)); });
  }

  async function start() {
    var s = (await sb.auth.getSession()).data.session;
    var gate = $("gate");
    function stop(msg) { gate.className = "box err"; gate.textContent = msg; }
    if (!s) return stop("Please sign in to the MY GYM app on this device first (as the admin), then reload this page.");
    var p = await sb.from("profiles").select("is_admin").eq("id", s.user.id).maybeSingle();
    if (!p.data || p.data.is_admin !== true) return stop("This page is for the gym admin only.");
    var q = await sb.from("form_submissions").select("id, form_id, data, status, note, handled_at, created_at").order("created_at", { ascending: false }).limit(300);
    if (q.error) return stop("Could not load the enquiries. Please reload.");
    rows = q.data || [];
    var ids = {}; rows.forEach(function (r) { ids[r.form_id] = 1; });
    Object.keys(ids).sort().forEach(function (id) { var o = el("option", "", FORMS[id] || id); o.value = id; $("frm").appendChild(o); });
    $("tools").classList.remove("hide");
    render();
  }
  $("flt").addEventListener("change", render);
  $("frm").addEventListener("change", render);
  start().catch(function () { var g = $("gate"); g.className = "box err"; g.textContent = "No connection. Please reload."; });
})();
