// Focused checks for the email library. Run: node supabase/email-templates/test.mjs
import { render, templates, requiredVars, GLOBALS } from "./render.mjs";
import { SAMPLE } from "./sample.mjs";
import { SETTINGS } from "./settings.mjs";

let ok = 0, bad = 0;
const t = (name, cond, extra = "") => { if (cond) ok++; else { bad++; console.log("FAIL", name, extra); } };
const ids = new Set();

for (const d of templates) {
  t(d.id + ": unique id", !ids.has(d.id)); ids.add(d.id);
  const missing = requiredVars(d).filter((k) => SAMPLE[k] === undefined);
  t(d.id + ": sample covers every variable", missing.length === 0, missing.join(","));
  const r = render(d.id, SAMPLE);
  const goTemplate = /\{\{\s*\./.test(r.html);
  const leftover = [...(r.html + r.text + r.subject).matchAll(/\{\{\s*[a-z][a-z0-9_]*\s*\}\}/g)].map((m) => m[0]);
  t(d.id + ": nothing left unfilled", leftover.length === 0, leftover.join(","));
  t(d.id + ": subject is one short line", r.subject.length > 5 && r.subject.length <= 78 && !/[\r\n]/.test(r.subject), r.subject.length + " chars");
  t(d.id + ": has a headline and a plain-text version", /<h1/.test(r.html) && r.text.length > 40);
  t(d.id + ": logo has alt text, links are https or mailto", /alt="MY GYM London"/.test(r.html) && ![...r.html.matchAll(/href="([^"]*)"/g)].some((m) => !/^(https:|mailto:|\{\{)/.test(m[1])));
  const copy = r.text + r.subject + d.body.map((b) => JSON.stringify(b)).join("");
  t(d.id + ": no em or en dashes in the wording", !/[–—]/.test(copy));
  if (d.marketing) t(d.id + ": marketing email carries an unsubscribe link", /unsubscribe/i.test(r.html) && /unsubscribe_url|Unsubscribe/.test(r.html) && r.html.includes(SAMPLE.unsubscribe_url));
  else t(d.id + ": service email says why it was sent", /service email|team|sent even/.test(r.html));
  if (d.auth && d.cta) t(d.id + ": keeps the Supabase link variable", goTemplate);
  const safe = render(d.id, { ...SAMPLE, first_name: '<img src=x onerror=alert(1)>', person_name: "<script>x</script>" });
  t(d.id + ": member-typed text is escaped", !/<script>x<\/script>|<img src=x/.test(safe.html));
}
// optional rows are hidden when their value is empty
const h = render("booking-confirmation", { ...SAMPLE, coach: "" });
t("optional row hides when empty", !h.html.includes(">Coach</td>") && render("booking-confirmation", SAMPLE).html.includes(">Coach</td>"));
t("global defaults exist", GLOBALS.gym_address.includes("EN1 1DS") && GLOBALS.cancel_minutes === "10");
const known = new Set(templates.map((d) => d.id));
for (const s of SETTINGS.failedPayment.steps) t("failed-payment step uses a real email: " + s.email, known.has(s.email));
t("failed-payment days are in order and pause comes last", SETTINGS.failedPayment.steps.every((s, i, a) => !i || s.day > a[i - 1].day) && SETTINGS.failedPayment.pauseOnDay > SETTINGS.failedPayment.steps.at(-1).day);
for (const k of [...Object.keys(SETTINGS.optional), ...Object.keys(SETTINGS.triggers)]) t("settings name a real email: " + k, known.has(k));
t("class reminder is email plus phone alert, 2 hours before", SETTINGS.classReminder.email && SETTINGS.classReminder.push && SETTINGS.classReminder.hoursBefore === 2);
console.log(`${templates.length} emails checked: ${ok} checks passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
