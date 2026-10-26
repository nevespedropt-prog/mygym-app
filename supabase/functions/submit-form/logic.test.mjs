import { processSubmission } from "./logic.ts";
import { render } from "./lib.js";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const mk = (o = {}) => { const s = { subs: [], consents: {}, mails: [], ipCount: 0, userCount: 0, ...o };
  return { s, d: { now: new Date("2026-10-26T10:00:00Z"), countByIp: async () => s.ipCount, countByUser: async () => s.userCount,
    insertSubmission: async (r) => { s.subs.push(r); return "id1"; }, upsertConsent: async (r) => { s.consents[r.email] = r; },
    getConsent: async (e) => s.consents[e] ?? null, profileName: async () => "Sara Jones", token: async (p) => p + "-tok",
    send: async (m) => { if (s.failMail) throw new Error("boom"); s.mails.push(m); } } }; };
const ctx = { ipHash: "h", user: null, functionsUrl: "https://x/functions/v1" };
const base = { elapsed: 10, hp: "" };
const renders = (s) => { for (const m of s.mails) { try { render(m.template, m.vars); pass++; } catch (e) { fail++; console.log("RENDER FAIL", m.template, e.message); } } };
const user = { id: "u1", email: "sara@x.co" };
const contactData = { full_name: "A", email: "a@b.co", topic: "Something else", message: "x" };

let { s, d } = mk();
let r = await processSubmission({ ...base, form_id: "contact", data: { full_name: "Hannah Morris", email: "h@x.co", topic: "Personal training", message: "Hi" } }, ctx, d);
ok(r.status === 200 && r.body.ok, "contact ok"); ok(s.subs.length === 1, "stored"); ok(s.subs[0].delete_after === "2028-10-25", "730 day delete date " + s.subs[0].delete_after);
ok(s.mails.length === 2, "two mails"); ok(s.mails[0].template === "admin-new-enquiry" && s.mails[0].to === "info@mygymlondon.co.uk" && s.mails[0].replyTo === "h@x.co", "admin mail");
ok(s.mails[1].template === "enquiry-autoreply" && s.mails[1].to === "h@x.co" && s.mails[1].vars.first_name === "Hannah", "autoreply");
renders(s);
({ s, d } = mk()); r = await processSubmission({ ...base, hp: "spam", form_id: "contact", data: {} }, ctx, d); ok(r.status === 200 && s.subs.length === 0 && s.mails.length === 0, "honeypot silent");
({ s, d } = mk()); r = await processSubmission({ form_id: "contact", elapsed: 1, data: {} }, ctx, d); ok(r.status === 429 && s.subs.length === 0, "too fast");
r = await processSubmission({ form_id: "contact", data: {} }, ctx, d); ok(r.status === 429, "no elapsed");
r = await processSubmission({ ...base, form_id: "nope" }, ctx, d); ok(r.status === 404, "unknown");
r = await processSubmission({ ...base, form_id: "contact", data: { full_name: "", email: "bad" } }, ctx, d); ok(r.status === 422 && r.body.errors.length >= 3 && s.subs.length === 0, "invalid not stored");
({ s, d } = mk({ ipCount: 5 })); r = await processSubmission({ ...base, form_id: "contact", data: contactData }, ctx, d); ok(r.status === 429 && s.subs.length === 0, "ip rate limit");
({ s, d } = mk({ failMail: true })); r = await processSubmission({ ...base, form_id: "contact", data: contactData }, ctx, d); ok(r.status === 200 && s.subs.length === 1, "mail failure keeps submission");
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "feedback", data: { rating: 2 } }, ctx, d); ok(r.status === 401, "feedback needs login");
r = await processSubmission({ ...base, form_id: "feedback", data: { rating: 2, message: "slow" } }, { ...ctx, user }, d); ok(r.status === 200 && s.mails.some((m) => m.template === "admin-new-review"), "low rating alerts gym"); renders(s);
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "feedback", data: { rating: 5 } }, { ...ctx, user }, d); ok(r.status === 200 && s.mails.length === 0 && /Google review/.test(r.body.message), "high rating: no alert, review nudge");
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "pause-cancel-request", data: { request_type: "Pause my membership", from_date: "2026-11-03", reason: "Cost" } }, { ...ctx, user }, d);
ok(r.status === 200 && s.mails.length === 1 && s.mails[0].template === "admin-change-request" && s.mails[0].vars.from_date === "Tuesday 3 November", "change request " + JSON.stringify(s.mails[0]?.vars?.from_date)); renders(s);
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "refer-a-friend", data: { friend_name: "Alex", friend_email: "alex@x.co" }, consent: { friend_ok: true } }, { ...ctx, user }, d);
ok(r.status === 200 && s.mails.length === 1 && s.mails[0].to === "alex@x.co" && s.mails[0].vars.referrer_name === "Sara", "referral invite"); renders(s);
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "refer-a-friend", data: { friend_name: "Me", friend_email: "SARA@x.co" }, consent: { friend_ok: true } }, { ...ctx, user }, d); ok(s.mails.length === 0, "no invite to yourself");
({ s, d } = mk({ userCount: 5 })); r = await processSubmission({ ...base, form_id: "refer-a-friend", data: { friend_name: "A", friend_email: "a@x.co" }, consent: { friend_ok: true } }, { ...ctx, user }, d); ok(r.status === 429, "referral daily limit");
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "newsletter-signup", data: { email: "N@x.co", first_name: "Nia" }, consent: { marketing: true } }, ctx, d);
ok(r.status === 200 && s.consents["n@x.co"] && s.consents["n@x.co"].confirmed_at === null, "not confirmed yet"); ok(s.mails.length === 1 && s.mails[0].template === "newsletter-welcome" && s.mails[0].vars.confirm_url === "https://app.mygymlondon.co.uk/email.html?a=confirm&t=confirm-tok", "confirm mail"); renders(s);
r = await processSubmission({ ...base, form_id: "newsletter-signup", data: { email: "n@x.co" }, consent: {} }, ctx, d); ok(r.status === 422, "newsletter needs tick");
({ s, d } = mk({ consents: { "n@x.co": { confirmed_at: "2026-01-01", withdrawn_at: null } } })); await processSubmission({ ...base, form_id: "newsletter-signup", data: { email: "n@x.co" }, consent: { marketing: true } }, ctx, d); ok(s.mails.length === 0, "no repeat confirm");
({ s, d } = mk({ consents: { "n@x.co": { confirmed_at: "2026-01-01", withdrawn_at: "2026-02-01" } } })); await processSubmission({ ...base, form_id: "newsletter-signup", data: { email: "n@x.co" }, consent: { marketing: true } }, ctx, d); ok(s.mails.length === 1 && s.consents["n@x.co"].withdrawn_at === null, "re-subscribe asks again");
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "trial-class", data: { full_name: "T", email: "t@x.co", phone: "07700 900123", class: "Boxing Fit", date: "2026-10-30" }, consent: { health_ready: true, marketing: true } }, ctx, d);
ok(r.status === 200 && s.consents["t@x.co"]?.confirmed_at, "trial marketing consent stored"); ok(s.consents["t@x.co"]?.wording.length > 20, "wording kept"); renders(s);
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "trial-class", data: { full_name: "T", email: "t@x.co", phone: "07700 900123", class: "HIIT, Wednesday 07:00", date: "2026-10-30" }, consent: { health_ready: true } }, ctx, d); ok(r.status === 422 && /Wednesday/.test(r.body.error) && s.subs.length === 0, "trial day must match class weekday");
({ s, d } = mk()); r = await processSubmission({ ...base, form_id: "trial-class", data: { full_name: "T", email: "t@x.co", phone: "07700 900123", class: "HIIT, Wednesday 07:00", date: "2026-10-28" }, consent: { health_ready: true } }, ctx, d); ok(r.status === 200, "matching weekday accepted");
({ s, d } = mk()); await processSubmission({ ...base, form_id: "landing-offer", data: { full_name: "L", email: "l@x.co", phone: "07700 900123", offer_name: "January offer" } }, ctx, d); ok(Object.keys(s.consents).length === 0, "no tick, no consent"); renders(s);
const extra = [["kids-registration", { parent_name: "P", email: "p@x.co", phone: "07700 900123", child_first_name: "Mia", child_last_name: "M", child_dob: "2018-05-01", emergency_name: "E", emergency_phone: "07700 900124" }, { parental_responsibility: true }],
 ["pt-enquiry", { full_name: "A", email: "a@x.co", phone: "07700 900123", goal: "Get fitter", experience: "New to it", times: ["Mornings"] }, {}],
 ["corporate-enquiry", { full_name: "A", company: "Acme", email: "a@x.co", team_size: "Under 10" }, {}]];
for (const [id, data, consent] of extra) { ({ s, d } = mk()); r = await processSubmission({ ...base, form_id: id, data, consent }, ctx, d); ok(r.status === 200 && s.mails.length === 2, id + " two mails"); renders(s); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
