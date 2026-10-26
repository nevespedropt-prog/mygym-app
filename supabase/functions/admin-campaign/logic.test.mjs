import { campaign, checkContent, BATCH } from "./logic.ts";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const good = { subject: "Spring bootcamp starts Monday", preheader: "Six weeks", title: "Spring bootcamp", body: "Our six-week bootcamp starts on Monday. Places are limited.", button: "Reserve my place", url: "https://app.mygymlondon.co.uk/#timetable" };
const CID = "11111111-2222-3333-4444-555555555555";
const people = (n) => Array.from({ length: n }, (_, i) => ({ email: `p${String(i).padStart(3, "0")}@x.co`, user_id: i % 2 ? "u" + i : null }));
const mk = (o = {}) => { const s = { sent: [], done: new Set(), res: "sent", aud: people(3), ...o };
  return { s, d: { adminEmail: "info@mygymlondon.co.uk", audience: async () => s.aud, alreadySent: async () => s.done, firstName: async (p) => (p.user_id ? "Sam" : "there"),
    send: async (m) => { s.sent.push(m); const r = typeof s.res === "function" ? s.res(m) : s.res; if (r === "sent") s.done.add(m.to); return r; }, pause: async () => {} } }; };
let { s, d } = mk();
let r = await campaign({ action: "audience" }, d); ok(r.body.count === 3, "audience count");
r = await campaign({ action: "test", ...good }, d);
ok(r.status === 200 && s.sent.length === 1 && s.sent[0].to === "info@mygymlondon.co.uk" && s.sent[0].test === true, "test goes only to the admin, marked test");
({ s, d } = mk()); r = await campaign({ action: "send", campaign_id: CID, ...good }, d);
ok(r.body.sent === 3 && r.body.remaining === 0 && s.sent.every((m) => m.test === false && m.key.startsWith("campaign:" + CID + ":")), "send reaches all three with per-person keys " + JSON.stringify(r.body));
ok(s.sent[1].vars.first_name === "Sam" && s.sent[0].vars.first_name === "there", "first names");
r = await campaign({ action: "send", campaign_id: CID, ...good }, d); ok(r.body.sent === 0 && r.body.already_sent === 3 && r.body.remaining === 0, "second press sends nothing new");
// batches
({ s, d } = mk({ aud: people(BATCH + 10) })); r = await campaign({ action: "send", campaign_id: CID, ...good }, d); ok(r.body.sent === BATCH && r.body.remaining === 10, "first batch " + JSON.stringify(r.body));
r = await campaign({ action: "send", campaign_id: CID, ...good }, d); ok(r.body.sent === 10 && r.body.remaining === 0, "second batch finishes");
// failures stay in the remaining list and can be retried
({ s, d } = mk({ res: (m) => (m.to === "p001@x.co" ? "failed" : "sent") })); r = await campaign({ action: "send", campaign_id: CID, ...good }, d); ok(r.body.sent === 2 && r.body.failed === 1 && r.body.remaining === 1, "failure counted and left to retry " + JSON.stringify(r.body));
s.res = "sent"; r = await campaign({ action: "send", campaign_id: CID, ...good }, d); ok(r.body.sent === 1 && r.body.remaining === 0, "retry finishes the failed one");
// validation
for (const [bad, why] of [[{ subject: "" }, "subject"], [{ subject: "x".repeat(79) }, "long subject"], [{ title: "" }, "heading"], [{ body: "short" }, "body"], [{ button: "" }, "button"], [{ url: "http://x.co" }, "http url"], [{ url: "javascript:alert(1)" }, "js url"], [{ url: "https://a b" }, "space url"]]) {
  ({ s, d } = mk()); r = await campaign({ action: "send", campaign_id: CID, ...good, ...bad }, d); ok(r.status === 422 && s.sent.length === 0, "rejects " + why);
}
r = await campaign({ action: "send", campaign_id: "nope", ...good }, d); ok(r.status === 400, "bad campaign id");
r = await campaign({ action: "boom" }, d); ok(r.status === 400, "unknown action");
ok(checkContent(good).ok, "good content passes");
// the real email accepts these details
const { render } = await import("../send-email/lib.js"); const c = checkContent(good); const m = render("newsletter", { ...c.vars, first_name: "Sam", unsubscribe_url: "https://u" }); ok(m.subject === good.subject && m.html.includes("https://u"), "newsletter renders with unsubscribe link");
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
