/* MY GYM London forms: tiny client script (no libraries). Include once on a page that has one or more .mgl-form forms.
   Set before loading:  window.MGL_FORMS = { endpoint: "https://<project>.supabase.co/functions/v1/submit-form", supabaseUrl: "...", anonKey: "..." }
   What it does: checks required fields and dates, blocks bots (hidden field + minimum time on page), sends the form as JSON,
   and shows a clear success or error message. The server checks everything again, so these checks are only a convenience. */
(function () {
  "use strict";
  var cfg = window.MGL_FORMS || {};
  var DAY = 86400000;
  function $(s, r) { return (r || document).querySelector(s); }
  function iso(d) { return d.toISOString().slice(0, 10); }

  function setDateLimits(form) {
    form.querySelectorAll("input[type=date]").forEach(function (el) {
      var now = new Date();
      if (el.dataset.minDays !== undefined) el.min = iso(new Date(now.getTime() + Number(el.dataset.minDays) * DAY));
      if (el.dataset.maxDays !== undefined) el.max = iso(new Date(now.getTime() + Number(el.dataset.maxDays) * DAY));
      if (el.dataset.ageMin !== undefined) {
        el.max = iso(new Date(now.getFullYear() - Number(el.dataset.ageMin), now.getMonth(), now.getDate()));
        el.min = iso(new Date(now.getFullYear() - Number(el.dataset.ageMax) - 1, now.getMonth(), now.getDate() + 1));
      }
    });
  }
  function fillHidden(form) {
    var q = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) { var el = form.querySelector("[name=" + k + "]"); if (el) el.value = q.get(k) || ""; });
    var p = form.querySelector("[name=page_url]"); if (p) p.value = location.href.split("#")[0];
    var o = form.querySelector("[name=offer_name]"); if (o) o.value = (q.get("offer") || form.dataset.offer || document.title).slice(0, 100);
  }
  function loadClassOptions(form) {
    form.querySelectorAll("select[data-options-from]").forEach(function (sel) {
      if (!cfg.supabaseUrl || !cfg.anonKey) return;
      fetch(cfg.supabaseUrl + "/rest/v1/classes?select=name,day_name,start_time&active=eq.true&kind=eq.class&order=sort", { headers: { apikey: cfg.anonKey } })
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          var seen = {};
          rows.forEach(function (c) { var t = c.name + ", " + c.day_name + " " + String(c.start_time).slice(0, 5); if (seen[t]) return; seen[t] = 1; var o = document.createElement("option"); o.textContent = t; sel.appendChild(o); });
        }).catch(function () { /* the list stays empty; the person can type a message instead */ });
    });
  }
  function collect(form) {
    var data = {}, consent = {}, fd = new FormData(form);
    fd.forEach(function (v, k) {
      if (k === form.querySelector(".hp input").name) return;
      if (k.indexOf("consent_") === 0) { consent[k.slice(8)] = true; return; }
      if (data[k] !== undefined) data[k] = [].concat(data[k], v); else data[k] = v;
    });
    return { form_id: form.dataset.form, data: data, consent: consent, hp: form.querySelector(".hp input").value, elapsed: Math.round((Date.now() - form._t0) / 1000) };
  }
  function status(form, msg, ok) { var s = $(".status", form); s.textContent = msg; s.className = "status " + (ok ? "ok" : "err"); }

  function tellParent() { if (window.parent !== window) { try { window.parent.postMessage({ mglFormHeight: document.documentElement.scrollHeight }, "*"); } catch (e) { /* not embedded */ } } }
  window.addEventListener("load", tellParent); window.addEventListener("resize", tellParent);
  if (window.ResizeObserver) new ResizeObserver(tellParent).observe(document.body);

  document.querySelectorAll(".mgl-form").forEach(function (form) {
    form._t0 = Date.now(); setDateLimits(form); fillHidden(form); loadClassOptions(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
      if (!form.checkValidity()) {
        var bad = form.querySelector(":invalid"); bad.setAttribute("aria-invalid", "true"); bad.focus();
        return status(form, "Please check the highlighted field and try again.", false);
      }
      var btn = $(".btn", form); btn.disabled = true; status(form, "Sending…", true);
      fetch(cfg.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(collect(form)) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j && res.j.errors && res.j.errors[0] ? res.j.errors[0].message : res.j && res.j.error ? res.j.error : "fail");
          var high = Number((form.querySelector("[name=rating]:checked") || {}).value) >= 4 && $(".status", form).dataset.successHigh;
          status(form, high || $(".status", form).dataset.success, true); form.reset(); fillHidden(form); form._t0 = Date.now();
        })
        .catch(function (err) { status(form, err.message && err.message !== "fail" ? err.message : "Sorry, that did not go through. Please try again, or email info@mygymlondon.co.uk.", false); })
        .then(function () { btn.disabled = false; });
    });
  });
})();
