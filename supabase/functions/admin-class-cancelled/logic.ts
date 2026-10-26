// MY GYM London: "the gym is cancelling this class": emails everyone booked on it. Admin only (checked in index.ts).
// It does NOT delete bookings or touch Wix: while the timetable lives in Wix, the class is cancelled there (Wix then removes the bookings and the app sync follows).
// Order for the owner: press "Send" here FIRST (bookings still exist), then cancel the session in Wix.
// No network in here: the database and the mailer are passed in so tests can fake them.
export interface Deps {
  getClass(id: number): Promise<{ id: number; name: string; day_name: string; start_time: string; kind: string } | null>;
  listBookings(classId: number, date: string): Promise<{ id: string; user_id: string }[]>;
  firstName(userId: string): Promise<string>;
  send(m: { user_id: string; vars: Record<string, string>; key: string }): Promise<"sent" | "skipped" | "failed">;
  today: string;   // 'YYYY-MM-DD' in London
}
export interface Input { action?: string; class_id?: unknown; date?: unknown; reason?: unknown }
export interface Out { status: number; body: Record<string, unknown> }

const weekday = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(new Date(iso + "T12:00:00Z"));
const pretty = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00Z"));

export async function classCancelled(i: Input, d: Deps): Promise<Out> {
  const action = i.action === "send" ? "send" : i.action === "preview" ? "preview" : null;
  if (!action) return { status: 400, body: { ok: false, error: "Unknown action." } };
  const classId = Number(i.class_id);
  const date = String(i.date ?? "");
  const reason = String(i.reason ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  if (!Number.isInteger(classId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z"))) return { status: 400, body: { ok: false, error: "Pick a class and a date." } };

  const c = await d.getClass(classId);
  if (!c) return { status: 404, body: { ok: false, error: "Class not found." } };
  if (weekday(date) !== c.day_name) return { status: 422, body: { ok: false, error: `${c.name} runs on ${c.day_name}s. Pick a ${c.day_name}.` } };
  if (date < d.today) return { status: 422, body: { ok: false, error: "That date has already passed." } };

  const bookings = await d.listBookings(classId, date);
  const when = pretty(date) + " at " + String(c.start_time).slice(0, 5);
  const className = c.kind === "gym" ? "Gym session" : c.name;
  if (action === "preview") {
    const names: string[] = [];
    for (const b of bookings.slice(0, 50)) names.push(await d.firstName(b.user_id));
    return { status: 200, body: { ok: true, class_name: className, when, count: bookings.length, first_names: names } };
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const b of bookings) {
    const r = await d.send({ user_id: b.user_id, key: "gymcancel-" + b.id, vars: { first_name: await d.firstName(b.user_id), class_name: className, when, reason } });
    if (r === "sent") sent++; else if (r === "skipped") skipped++; else failed++;
  }
  return { status: 200, body: { ok: true, class_name: className, when, count: bookings.length, sent, skipped, failed } };
}
