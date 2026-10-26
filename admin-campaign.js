/* MY GYM admin: "Send a campaign". Uses the admin's existing app sign-in (same site). The admin-campaign function checks the person is an admin
   and only ever emails people with confirmed marketing consent. */
(function () {
  "use strict";
  var CFG = window.MYGYM_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  var FIELDS = ["subject", "preheader", "title", "body", "button", "url"];
  var campaignId = crypto.randomUUID(), tested = false, audience = 0;

  function show(el, cls, text) { el.className = "box " + (cls || ""); el.textContent = text; }
  function content() { var o = {}; FIELDS.forEach(function (f) { o[f] = $(f).value; }); return o; }
  function changed() { tested = false; campaignId = crypto.randomUUID(); $("send").disabled = true; $("out").className = "box hide"; }

  async function call(action) {
    var s = (await sb.auth.getSession()).data.session;
    var body = content(); body.action = action; body.campaign_id = campaignId;
    var r = await fetch(CFG.SUPABASE_URL + "/functions/v1/admin-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + s.access_token },
      body: JSON.stringify(body)
    });
    var j = await r.json().catch(function () { return {}; });
    return { ok: r.ok && j.ok, j: j };
  }

  async function start() {
    var s = (await sb.auth.getSession()).data.session, gate = $("gate");
    if (!s) { gate.classList.remove("hide"); show(gate, "err", "Please sign in to the MY GYM app on this device first (as the admin), then reload this page."); return; }
    var p = await sb.from("profiles").select("is_admin").eq("id", s.user.id).maybeSingle();
    if (!p.data || p.data.is_admin !== true) { gate.classList.remove("hide"); show(gate, "err", "This page is for the gym admin only."); return; }
    $("form").classList.remove("hide");
    var a = await call("audience");
    audience = a.ok ? a.j.count : 0;
    show($("aud"), "", a.ok ? audience + " people have confirmed they want news and offers." : "Could not count subscribers.");
  }

  FIELDS.forEach(function (f) { $(f).addEventListener("input", changed); });

  $("test").addEventListener("click", async function () {
    $("test").disabled = true; show($("out"), "", "Sending your test...");
    try {
      var r = await call("test");
      if (!r.ok) show($("out"), "err", r.j.error || "Something went wrong.");
      else { tested = true; $("send").disabled = audience === 0; show($("out"), "ok", "Test sent to " + r.j.sent_to + ". Check it on your phone and on a computer. " + (audience === 0 ? "Nobody has subscribed yet, so there is nobody to send to." : "If it looks right, press the red button.")); }
    } catch (e) { show($("out"), "err", "No connection. Please try again."); }
    $("test").disabled = false;
  });

  $("send").addEventListener("click", async function () {
    if (!tested || !window.confirm("Send this email to " + audience + " subscriber(s)? This cannot be undone.")) return;
    $("send").disabled = true; $("test").disabled = true; FIELDS.forEach(function (f) { $(f).disabled = true; });
    var sent = 0, failed = 0, guard = 0;
    try {
      while (guard++ < 200) {
        show($("out"), "", "Sending... " + sent + " sent so far. Please keep this page open.");
        var r = await call("send");
        if (!r.ok) { show($("out"), "err", (r.j.error || "Something went wrong.") + " " + sent + " sent so far. Reload the page and press Send again only if you have not changed anything: people already emailed are skipped."); break; }
        sent += r.j.sent; failed = r.j.failed;
        if (r.j.remaining === 0) { show($("out"), "ok", "Done. " + (r.j.already_sent + sent) + " of " + r.j.audience + " people have this email."); break; }
        if (r.j.sent === 0 && r.j.skipped === 0) { show($("out"), "err", sent + " sent, " + r.j.remaining + " could not be sent right now. Wait a minute and press Send again; people already emailed are skipped."); break; }
      }
    } catch (e) { show($("out"), "err", "Connection lost after " + sent + " sent. Reload and press Send again: people already emailed are skipped."); }
    FIELDS.forEach(function (f) { $(f).disabled = false; }); $("test").disabled = false;
  });

  start().catch(function () { var g = $("gate"); g.classList.remove("hide"); show(g, "err", "Could not load. Please reload the page."); });
})();
