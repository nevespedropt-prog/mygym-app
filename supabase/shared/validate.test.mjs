import forms from "../forms/forms.mjs";
import { validate } from "./validate.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const F = Object.fromEntries(forms.map((f) => [f.id, f]));
const TODAY = "2026-10-26";

// contact: good
let r = validate(F.contact, { data: { full_name: " Hannah ", email: "Hannah@Example.com", topic: "Classes and timetable", message: "Hello there", evil: "x" } }, TODAY);
ok(r.ok, "contact good"); ok(r.data.email === "hannah@example.com", "email lowercased"); ok(r.data.full_name === "Hannah", "trimmed"); ok(!("evil" in r.data), "unknown field dropped");
// contact: missing / bad
r = validate(F.contact, { data: { full_name: "", email: "nope", topic: "Zzz", message: "" } }, TODAY);
ok(!r.ok && r.errors.length === 4, "contact bad gives 4 errors, got " + r.errors.length);
// arrays rejected for text
r = validate(F.contact, { data: { full_name: ["a"], email: "a@b.co", topic: "Something else", message: "x" } }, TODAY);
ok(!r.ok, "array in text field rejected");
// non-object input
ok(!validate(F.contact, null, TODAY).ok, "null input rejected"); ok(!validate(F.contact, "x", TODAY).ok, "string input rejected");
// control chars stripped
r = validate(F.contact, { data: { full_name: "A\u0000B", email: "a@b.co", topic: "Something else", message: "hi" } }, TODAY);
ok(r.data.full_name === "AB", "control chars removed");
// length cap
r = validate(F.contact, { data: { full_name: "x".repeat(500), email: "a@b.co", topic: "Something else", message: "hi" } }, TODAY);
ok(!r.ok, "very long name rejected");
// trial: consent required, date window
const trial = { full_name: "A", email: "a@b.co", phone: "07700 900123", class: "Boxing Fit", date: "2026-10-30" };
r = validate(F["trial-class"], { data: trial, consent: {} }, TODAY); ok(!r.ok && r.errors.some((e) => e.field === "consent_health_ready"), "trial needs health consent");
r = validate(F["trial-class"], { data: trial, consent: { health_ready: true } }, TODAY); ok(r.ok, "trial good");
r = validate(F["trial-class"], { data: { ...trial, date: "2026-10-26" }, consent: { health_ready: true } }, TODAY); ok(!r.ok, "trial today too soon");
r = validate(F["trial-class"], { data: { ...trial, date: "2027-03-01" }, consent: { health_ready: true } }, TODAY); ok(!r.ok, "trial too far");
r = validate(F["trial-class"], { data: { ...trial, date: "2026-02-31" }, consent: { health_ready: true } }, TODAY); ok(!r.ok, "impossible date");
r = validate(F["trial-class"], { data: trial, consent: { health_ready: "on", marketing: true } }, TODAY); ok(r.consent.marketing === true, "marketing consent kept when ticked");
// pt: checkbox group
const pt = { full_name: "A", email: "a@b.co", phone: "07700 900123", goal: "Get fitter", experience: "New to it" };
r = validate(F["pt-enquiry"], { data: { ...pt, times: ["Mornings", "Weekends"] } }, TODAY); ok(r.ok && r.data.times.length === 2, "pt times ok");
r = validate(F["pt-enquiry"], { data: { ...pt, times: ["Midnight"] } }, TODAY); ok(!r.ok, "pt bad time");
r = validate(F["pt-enquiry"], { data: { ...pt, times: "Mornings" } }, TODAY); ok(r.ok && r.data.times[0] === "Mornings", "single value becomes list");
// kids: age, parental consent, medical consent
const kid = { parent_name: "P", email: "p@b.co", phone: "07700 900123", child_first_name: "Mia", child_last_name: "M", child_dob: "2018-05-01", emergency_name: "E", emergency_phone: "07700 900124" };
r = validate(F["kids-registration"], { data: kid, consent: { parental_responsibility: true } }, TODAY); ok(r.ok, "kids good (age 8)");
r = validate(F["kids-registration"], { data: { ...kid, child_dob: "2010-01-01" }, consent: { parental_responsibility: true } }, TODAY); ok(!r.ok, "kids too old");
r = validate(F["kids-registration"], { data: { ...kid, child_dob: "2024-01-01" }, consent: { parental_responsibility: true } }, TODAY); ok(!r.ok, "kids too young");
r = validate(F["kids-registration"], { data: kid, consent: {} }, TODAY); ok(!r.ok, "kids needs parental consent");
r = validate(F["kids-registration"], { data: { ...kid, medical: "Asthma" }, consent: { parental_responsibility: true } }, TODAY); ok(!r.ok && r.errors.some((e) => e.field === "consent_medical_use"), "medical text needs medical consent");
r = validate(F["kids-registration"], { data: { ...kid, medical: "Asthma" }, consent: { parental_responsibility: true, medical_use: true } }, TODAY); ok(r.ok, "medical with consent ok");
// age boundary: turns 12 today is out; turns 6 today is in
r = validate(F["kids-registration"], { data: { ...kid, child_dob: "2014-10-26" }, consent: { parental_responsibility: true } }, TODAY); ok(!r.ok, "turned 12 today is out");
r = validate(F["kids-registration"], { data: { ...kid, child_dob: "2020-10-26" }, consent: { parental_responsibility: true } }, TODAY); ok(r.ok, "turned 6 today is in");
// feedback rating
r = validate(F.feedback, { data: { rating: "4" } }, TODAY); ok(r.ok && r.data.rating === 4, "rating 4");
r = validate(F.feedback, { data: { rating: "9" } }, TODAY); ok(!r.ok, "rating 9 bad");
r = validate(F.feedback, { data: { rating: "2.5" } }, TODAY); ok(!r.ok, "rating 2.5 bad");
// newsletter: consent required
r = validate(F["newsletter-signup"], { data: { email: "a@b.co" }, consent: {} }, TODAY); ok(!r.ok, "newsletter needs consent");
r = validate(F["newsletter-signup"], { data: { email: "a@b.co" }, consent: { marketing: true } }, TODAY); ok(r.ok, "newsletter ok");
// utm meta kept and capped
r = validate(F.contact, { data: { full_name: "A", email: "a@b.co", topic: "Something else", message: "x", utm_source: "ig".repeat(200), page_url: "https://x" } }, TODAY); ok(r.meta.utm_source.length === 80 && r.meta.page_url === "https://x", "meta capped");
// every form builds a valid empty-ish object without throwing
for (const f of forms) { try { validate(f, {}, TODAY); pass++; } catch (e) { fail++; console.log("THROW", f.id, e.message); } }

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
