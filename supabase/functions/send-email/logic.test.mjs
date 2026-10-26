import { sendEmail } from "./logic.ts";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const mk = (o = {}) => { const s = { seen: new Set(), log: [], sent: [], consent: new Set(), off: new Set(), failSend: false, ...o };
  return { s, d: { getUserEmail: async (id) => (id === "u1" ? "Sara@X.co" : null), hasConsent: async (e) => s.consent.has(e), templateEnabled: async (t) => !s.off.has(t),
    claim: async (k) => { if (s.seen.has(k)) return false; s.seen.add(k); return true; }, finish: async (k, st, dt) => { s.log.push([k, st, dt]); },
    unsubscribeUrl: async (e) => "https://u/" + e, deliver: async (m) => { if (s.failSend) throw new Error("resend down"); s.sent.push(m); return "re_1"; } } }; };
const welcomeVars = { first_name: "Sara" };
let { s, d } = mk();
let r = await sendEmail({ template: "nope" }, d); ok(r.status === 400 && r.body.error === "unknown_template", "unknown template");
r = await sendEmail({ template: "welcome", vars: welcomeVars }, d); ok(r.status === 400 && r.body.error === "no_recipient", "no recipient");
r = await sendEmail({ template: "welcome", user_id: "u1", vars: welcomeVars, dedupe_key: "welcome:u1" }, d);
ok(r.status === 200 && r.body.sent && s.sent[0].to === "sara@x.co" && s.sent[0].subject.length > 3, "welcome by user id (" + JSON.stringify(r.body) + ")"); ok(s.log[0][1] === "sent", "logged sent");
r = await sendEmail({ template: "welcome", user_id: "u1", vars: welcomeVars, dedupe_key: "welcome:u1" }, d); ok(r.body.skipped === "already_sent" && s.sent.length === 1, "dedupe stops a second send");
r = await sendEmail({ template: "welcome", to: "bad", vars: welcomeVars }, d); ok(r.status === 400, "bad address");
// missing variable: fails cleanly, logged
({ s, d } = mk()); r = await sendEmail({ template: "welcome", to: "a@b.co", vars: {} }, d); ok(r.status === 422 && s.log[0][1] === "failed" && s.sent.length === 0, "missing details not sent");
// provider down
({ s, d } = mk({ failSend: true })); r = await sendEmail({ template: "welcome", to: "a@b.co", vars: welcomeVars }, d); ok(r.status === 502 && s.log[0][1] === "failed", "provider failure recorded");
// switched off
({ s, d } = mk({ off: new Set(["welcome"]) })); r = await sendEmail({ template: "welcome", to: "a@b.co", vars: welcomeVars }, d); ok(r.body.skipped === "switched_off" && s.sent.length === 0, "switched off");
// marketing needs consent and carries unsubscribe
({ s, d } = mk()); r = await sendEmail({ template: "newsletter", to: "a@b.co", vars: { first_name: "N", campaign_subject: "S", campaign_preheader: "P", campaign_title: "T", campaign_body: "B", campaign_button: "Go", campaign_url: "https://x.co" } }, d);
ok(r.body.skipped === "no_consent" && s.sent.length === 0, "marketing blocked without consent");
s.consent.add("a@b.co"); r = await sendEmail({ template: "newsletter", to: "a@b.co", vars: { first_name: "N", campaign_subject: "S", campaign_preheader: "P", campaign_title: "T", campaign_body: "B", campaign_button: "Go", campaign_url: "https://x.co" } }, d);
ok(r.body.sent && s.sent[0].marketing && s.sent[0].unsubscribeUrl === "https://u/a@b.co" && s.sent[0].html.includes("https://u/a@b.co"), "marketing sent with unsubscribe link (" + JSON.stringify(r.body) + ")");
// admin templates default to the gym address
({ s, d } = mk()); r = await sendEmail({ template: "admin-new-enquiry", vars: { admin_url: "https://a", form_name: "contact form", person_name: "P", person_email: "p@x.co", person_phone: "1", message: "m", source_page: "s" } }, d);
ok(r.body.sent && s.sent[0].to === "info@mygymlondon.co.uk", "admin default recipient (" + JSON.stringify(r.body) + ")");
// test sends skip consent, are marked, and never dedupe
({ s, d } = mk()); const nv = { first_name: "N", campaign_subject: "S", campaign_preheader: "P", campaign_title: "T", campaign_body: "B", campaign_button: "Go", campaign_url: "https://x.co" };
r = await sendEmail({ template: "newsletter", to: "a@b.co", vars: nv, test: true, dedupe_key: "k" }, d); r = await sendEmail({ template: "newsletter", to: "a@b.co", vars: nv, test: true, dedupe_key: "k" }, d);
ok(s.sent.length === 2 && s.sent[0].subject.startsWith("[TEST] "), "test sends skip consent and dedupe, subject marked");
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
