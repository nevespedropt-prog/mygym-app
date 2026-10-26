/* MY GYM admin: "Class cancelled" button. Uses the admin's existing app sign-in (same site, so the session is shared).
   The admin-class-cancelled function checks the person is an admin; this page only shows the screen. */
(function () {
  "use strict";
  var CFG = window.MYGYM_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var classes = [], checked = null;

  function show(el, cls, text) { el.className = "box " + (cls || ""); el.textContent = text; }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function nextDate(dayName) { var d = new Date(); for (var i = 0; i < 8; i++) { if (DAYS[d.getDay()] === dayName) return iso(d); d.setDate(d.getDate() + 1); } return iso(new Date()); }

  async function call(action) {
    var s = (await sb.auth.getSession()).data.session;
    var r = await fetch(CFG.SUPABASE_URL + "/functions/v1/admin-class-cancelled", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + s.access_token },
      body: JSON.stringify({ action: action, class_id: Number($("cls").value), date: $("date").value, reason: $("reason").value })
    });
    var j = await r.json().catch(function () { return {}; });
    return { ok: r.ok && j.ok, j: j, status: r.status };
  }

  async function start() {
    var s = (await sb.auth.getSession()).data.session;
    var gate = $("gate");
    if (!s) { gate.classList.remove("hide"); show(gate, "err", "Please sign in to the MY GYM app on this device first (as the admin), then reload this page."); return; }
    var p = await sb.from("profiles").select("is_admin").eq("id", s.user.id).maybeSingle();
    if (!p.data || p.data.is_admin !== true) { gate.classList.remove("hide"); show(gate, "err", "This page is for the gym admin only."); return; }
    var q = await sb.from("classes").select("id, name, day_name, start_time, kind, sort").eq("active", true).order("sort");
    classes = q.data || [];
    var order = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
    classes.sort(function (a, b) { return (order[a.day_name] - order[b.day_name]) || String(a.start_time).localeCompare(String(b.start_time)); });
    $("cls").innerHTML = classes.map(function (c) { return '<option value="' + c.id + '">' + c.day_name + " " + String(c.start_time).slice(0, 5) + " - " + (c.kind === "gym" ? "Gym session" : c.name).replace(/</g, "&lt;") + "</option>"; }).join("");
    $("form").classList.remove("hide");
    setDate();
  }
  function setDate() { var c = classes.find(function (x) { return String(x.id) === $("cls").value; }); if (c) $("date").value = nextDate(c.day_name); reset(); }
  function reset() { checked = null; $("send").disabled = true; $("out").className = "box hide"; }

  $("cls").addEventListener("change", setDate);
  $("date").addEventListener("change", reset);
  $("reason").addEventListener("input", function () { $("send").disabled = true; checked = null; });

  $("check").addEventListener("click", async function () {
    $("check").disabled = true; show($("out"), "", "Checking...");
    try {
      var r = await call("preview");
      if (!r.ok) { show($("out"), "err", r.j.error || "Something went wrong."); }
      else if (r.j.count === 0) { show($("out"), "", r.j.class_name + ", " + r.j.when + ": nobody is booked, so there is nobody to email."); }
      else { checked = r.j; $("send").disabled = false; show($("out"), "", r.j.class_name + ", " + r.j.when + ": " + r.j.count + " booked (" + r.j.first_names.join(", ") + "). Press the red button to email them."); }
    } catch (e) { show($("out"), "err", "No connection. Please try again."); }
    $("check").disabled = false;
  });

  $("send").addEventListener("click", async function () {
    if (!checked || !window.confirm("Email " + checked.count + " member(s) that " + checked.class_name + " on " + checked.when + " is cancelled?")) return;
    $("send").disabled = true; $("check").disabled = true; show($("out"), "", "Sending...");
    try {
      var r = await call("send");
      if (!r.ok) show($("out"), "err", r.j.error || "Something went wrong.");
      else show($("out"), r.j.failed ? "err" : "ok", "Sent " + r.j.sent + " of " + r.j.count + (r.j.skipped ? " (" + r.j.skipped + " had already been emailed)" : "") + (r.j.failed ? ". " + r.j.failed + " failed: press Check, then the red button again to retry them." : ". Now cancel the session in Wix."));
    } catch (e) { show($("out"), "err", "No connection. Please check before sending again: some emails may have gone."); }
    $("check").disabled = false; checked = null;
  });

  start().catch(function () { var g = $("gate"); g.classList.remove("hide"); show(g, "err", "Could not load. Please reload the page."); });
})();
