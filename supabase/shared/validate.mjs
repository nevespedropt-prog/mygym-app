// MY GYM London: checks what a visitor sent against the form definition (forms.mjs). Pure code, no network.
// The browser checks the same things for convenience, but this is the check that counts: nothing reaches the database unless it passes.
// Only fields named in the definition are kept; everything else is dropped. Text is trimmed, control characters removed, lengths limited.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[0-9 +()\-]{7,25}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const META_MAX = { utm_source: 80, utm_medium: 80, utm_campaign: 120, page_url: 300, offer_name: 100 };

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+$/g, "").replace(/^\s+/g, "").slice(0, max);
const asList = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const validDate = (s) => DATE.test(s) && !Number.isNaN(Date.parse(s + "T12:00:00Z")) && addDays(s, 0) === s;
function ageOn(dob, today) {
  const [by, bm, bd] = dob.split("-").map(Number), [ty, tm, td] = today.split("-").map(Number);
  let a = ty - by; if (tm < bm || (tm === bm && td < bd)) a--; return a;
}

/** today is 'YYYY-MM-DD' (London). Returns { ok, errors: [{field, message}], data, meta, consent }. */
export function validate(form, input, today) {
  const errors = [], data = {}, meta = {}, consent = {};
  const raw = input && typeof input === "object" ? input : {};
  const rawConsent = raw.consent && typeof raw.consent === "object" ? raw.consent : {};
  const rawData = raw.data && typeof raw.data === "object" ? raw.data : {};
  const bad = (field, label, why) => errors.push({ field, message: `${label}: ${why}` });

  for (const f of form.fields) {
    const v = rawData[f.id];
    const label = f.label || f.id;
    if (f.type === "hidden") { if (v !== undefined && META_MAX[f.id]) meta[f.id] = clean(v, META_MAX[f.id]); continue; }
    if (f.type === "checkbox-group") {
      const list = asList(v).map((x) => clean(x, 60)).filter(Boolean);
      if (list.some((x) => !f.options.includes(x))) { bad(f.id, label, "choose from the list"); continue; }
      if (f.required && !list.length) { bad(f.id, label, "please choose at least one"); continue; }
      if (list.length) data[f.id] = list; continue;
    }
    if (Array.isArray(v)) { bad(f.id, label, "one answer only"); continue; }
    const s = clean(v, f.type === "textarea" ? (f.max || 1500) : (f.max || 200));
    if (!s) { if (f.required) bad(f.id, label, "this is required"); continue; }
    if (f.max && String(v ?? "").trim().length > f.max + 50) { bad(f.id, label, "too long"); continue; }
    switch (f.type) {
      case "email": if (!EMAIL.test(s)) { bad(f.id, label, "enter a valid email address"); break; } data[f.id] = s.toLowerCase(); break;
      case "tel": if (!PHONE.test(s)) { bad(f.id, label, "enter a valid phone number"); break; } data[f.id] = s; break;
      case "select": if (f.options && !f.options.includes(s)) { bad(f.id, label, "choose from the list"); break; } data[f.id] = s; break;
      case "radio": if (!f.options.includes(s)) { bad(f.id, label, "choose from the list"); break; } data[f.id] = s; break;
      case "rating": { const n = Number(s); if (!Number.isInteger(n) || n < (f.min || 1) || n > (f.max || 5)) { bad(f.id, label, "choose a rating"); break; } data[f.id] = n; break; }
      case "date": {
        if (!validDate(s)) { bad(f.id, label, "enter a valid date"); break; }
        if (f.minDays !== undefined && s < addDays(today, f.minDays)) { bad(f.id, label, "that date is too soon"); break; }
        if (f.maxDays !== undefined && s > addDays(today, f.maxDays)) { bad(f.id, label, "that date is too far ahead"); break; }
        if (f.ageMin !== undefined) { const a = ageOn(s, today); if (a < f.ageMin || a > f.ageMax) { bad(f.id, label, `Kids Gym is for ages ${f.ageMin} to ${f.ageMax}`); break; } }
        data[f.id] = s; break;
      }
      default: data[f.id] = s;
    }
  }
  for (const c of form.consents || []) {
    const on = rawConsent[c.id] === true || rawConsent[c.id] === "1" || rawConsent[c.id] === "on";
    if (c.required && !on) errors.push({ field: "consent_" + c.id, message: "Please tick: " + c.text.slice(0, 90) });
    if (on) consent[c.id] = true;
  }
  if (form.consentIfFilled && data[form.consentIfFilled.field] && !consent[form.consentIfFilled.consent]) errors.push({ field: "consent_" + form.consentIfFilled.consent, message: form.consentIfFilled.message });
  return { ok: errors.length === 0, errors, data, meta, consent };
}
