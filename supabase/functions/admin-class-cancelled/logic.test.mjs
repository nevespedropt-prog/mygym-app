import { classCancelled } from "./logic.ts";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const box = { id: 7, name: "BoxFit", day_name: "Monday", start_time: "09:00:00", kind: "class" };
const mk = (o = {}) => { const s = { sent: [], res: "sent", bookings: [{ id: "b1", user_id: "u1" }, { id: "b2", user_id: "u2" }], ...o };
  return { s, d: { today: "2026-10-26", getClass: async (id) => (id === 7 ? box : id === 8 ? { ...box, id: 8, kind: "gym", name: "Open gym" } : null), listBookings: async () => s.bookings, firstName: async (u) => (u === "u1" ? "Sara" : "there"),
    send: async (m) => { s.sent.push(m); return s.res; } } }; };
let { s, d } = mk();
let r = await classCancelled({ action: "preview", class_id: 7, date: "2026-11-02" }, d);
ok(r.status === 200 && r.body.count === 2 && r.body.when === "Monday 2 November at 09:00" && r.body.first_names[0] === "Sara" && s.sent.length === 0, "preview counts and sends nothing " + JSON.stringify(r.body));
r = await classCancelled({ action: "send", class_id: 7, date: "2026-11-02", reason: "Coach unwell\nsorry" }, d);
ok(r.body.sent === 2 && s.sent.length === 2 && s.sent[0].key === "gymcancel-b1" && s.sent[0].vars.reason === "Coach unwell sorry" && s.sent[0].vars.class_name === "BoxFit", "send both with keys " + JSON.stringify(s.sent[0]));
ok(r.status === 200 && r.body.failed === 0, "no failures");
({ s, d } = mk({ res: "skipped" })); r = await classCancelled({ action: "send", class_id: 7, date: "2026-11-02" }, d); ok(r.body.skipped === 2 && r.body.sent === 0, "already-sent counted as skipped");
({ s, d } = mk({ res: "failed" })); r = await classCancelled({ action: "send", class_id: 7, date: "2026-11-02" }, d); ok(r.body.failed === 2, "failures counted");
({ s, d } = mk()); r = await classCancelled({ action: "send", class_id: 7, date: "2026-11-03" }, d); ok(r.status === 422 && /Mondays/.test(r.body.error) && s.sent.length === 0, "wrong weekday refused");
r = await classCancelled({ action: "send", class_id: 7, date: "2026-10-19" }, d); ok(r.status === 422 && /passed/.test(r.body.error), "past date refused");
r = await classCancelled({ action: "send", class_id: 99, date: "2026-11-02" }, d); ok(r.status === 404, "unknown class");
r = await classCancelled({ action: "send", class_id: "x", date: "2026-11-02" }, d); ok(r.status === 400, "bad class id");
r = await classCancelled({ action: "send", class_id: 7, date: "2026-13-45" }, d); ok(r.status === 400, "bad date");
r = await classCancelled({ action: "delete", class_id: 7, date: "2026-11-02" }, d); ok(r.status === 400, "unknown action");
({ s, d } = mk({ bookings: [] })); r = await classCancelled({ action: "send", class_id: 7, date: "2026-11-02" }, d); ok(r.body.count === 0 && r.body.sent === 0, "nobody booked");
({ s, d } = mk()); r = await classCancelled({ action: "preview", class_id: 8, date: "2026-11-02" }, d); ok(r.body.class_name === "Gym session", "gym session name");
// the real renderer accepts exactly these details
const { render } = await import("../send-email/lib.js"); ok(render("class-cancelled-by-gym", { first_name: "Sara", class_name: "BoxFit", when: "Monday 2 November at 09:00", reason: "" }).subject.includes("Class cancelled"), "email renders with empty reason");
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
