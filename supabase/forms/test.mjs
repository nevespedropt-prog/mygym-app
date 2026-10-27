// Focused checks for the forms. Run: node supabase/forms/test.mjs
import { forms, renderForm } from "./render.mjs";
import { templates } from "../email-templates/render.mjs";

let ok = 0, bad = 0;
const t = (n, c, x = "") => { if (c) ok++; else { bad++; console.log("FAIL", n, x); } };
const emailIds = new Set(templates.map((e) => e.id));
const seen = new Set();

for (const f of forms) {
  t(f.id + ": unique id", !seen.has(f.id)); seen.add(f.id);
  const ids = f.fields.map((x) => x.id);
  t(f.id + ": field ids are unique", new Set(ids).size === ids.length);
  t(f.id + ": has a bot trap and a minimum time", !!f.honeypot && f.minSeconds >= 2);
  t(f.id + ": rate limit is set", !!f.rateLimit && f.rateLimit.perIpPerHour > 0);
  t(f.id + ": has a privacy line with a link", /<a href="https:\/\/www\.mygymlondon\.co\.uk\/privacy">/.test(f.privacy));
  t(f.id + ": has a retention period", f.retentionDays > 0 && f.retentionDays <= 1095);
  for (const k of ["notify", "autoreply", "sendsTo", "afterConfirm"]) if (f[k]) t(f.id + ": " + k + " email exists (" + f[k] + ")", emailIds.has(f[k]));
  if (f.requiresLogin) t(f.id + ": logged-in form is prefilled", (f.prefill || []).length > 0);
  t(f.id + ": marketing is never required unless it IS the sign-up", (f.consents || []).every((c) => c.id !== "marketing" || !c.required || f.id === "newsletter-signup"));
  if (f.sensitive) t(f.id + ": sensitive form keeps data no longer than 2 years", f.retentionDays <= 730);
  const html = renderForm(f);
  const inputs = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/g)].filter((m) => !/type="(hidden|radio|checkbox)"/.test(m[0]) && !/class="hp"/.test(m[0]) && !/tabindex="-1"/.test(m[0]));
  const forIds = new Set([...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1]));
  t(f.id + ": every text input has a visible label", inputs.every((m) => { const id = (m[0].match(/id="([^"]+)"/) || [])[1]; return id && forIds.has(id); }), inputs.length + " inputs");
  t(f.id + ": no tick box is pre-ticked", !/\bchecked\b/.test(html));
  t(f.id + ": required fields are marked for screen readers", f.fields.filter((x) => x.required && !["radio", "checkbox-group", "rating", "hidden"].includes(x.type)).every((x) => new RegExp(`id="${f.id}-${x.id}"[^>]*aria-required`).test(html)));
  t(f.id + ": status area announces results", /role="status" aria-live="polite"/.test(html));
  t(f.id + ": no em or en dashes", !/[–—]/.test(JSON.stringify(f)));
  t(f.id + ": uses the website's request, not a third party", !/action="https?:/.test(html));
}
const kids = forms.find((x) => x.id === "kids-registration");
t("kids form: age 8 and over and parental consent required", kids.fields.find((x) => x.id === "child_dob").ageMin === 8 && kids.fields.find((x) => x.id === "child_dob").ageMax === 17 && kids.consents.find((c) => c.id === "parental_responsibility").required);
t("newsletter uses double opt-in", forms.find((x) => x.id === "newsletter-signup").doubleOptIn === true);
console.log(`${forms.length} forms checked: ${ok} checks passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
