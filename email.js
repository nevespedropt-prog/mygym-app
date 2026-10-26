(function () {
  var q = new URLSearchParams(location.search), a = q.get("a"), t = q.get("t");
  var h = document.getElementById("h"), p = document.getElementById("p"), act = document.getElementById("act");
  var API = "https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/marketing-consent";
  var KEY = "sb_publishable_gboSvVSFxQT0xDSEzbeYxw_E1OO3TRp";
  function say(title, text) { h.textContent = title; p.textContent = text; }
  function home() { act.innerHTML = '<a class="btn" href="https://www.mygymlondon.co.uk/">Back to the website</a>'; }
  function call() {
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "apikey": KEY, "Authorization": "Bearer " + KEY }, body: JSON.stringify({ a: a, t: t }) })
      .then(function (r) { return r.json(); });
  }
  if ((a !== "confirm" && a !== "unsubscribe") || !t) { say("Link not valid", "Please use the link in the latest email we sent you."); home(); return; }
  if (a === "confirm") {
    call().then(function (j) {
      if (j.ok) say("You are signed up", "Thank you. We will send you news and offers from MY GYM London. You can unsubscribe from any email.");
      else say("Something went wrong", j.error || "Please try again.");
      home();
    }).catch(function () { say("Something went wrong", "Please check your connection and try again."); });
  } else {
    // unsubscribing needs one deliberate tap, so mail scanners that open links cannot unsubscribe people by accident
    say("Unsubscribe", "Tap the button to stop news and offers from MY GYM London. You will still get emails about your bookings and membership.");
    var b = document.createElement("button"); b.textContent = "Unsubscribe me";
    b.onclick = function () {
      b.disabled = true;
      call().then(function (j) {
        if (j.ok) { say("You are unsubscribed", "We will not send you news and offers any more."); act.innerHTML = ""; home(); }
        else { say("Something went wrong", j.error || "Please try again."); b.disabled = false; }
      }).catch(function () { say("Something went wrong", "Please check your connection and try again."); b.disabled = false; });
    };
    act.appendChild(b);
  }
})();
