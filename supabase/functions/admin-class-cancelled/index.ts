// MY GYM London: back office "Class cancelled" (Schedule page). Admin only.
//   {"action":"preview", class_id, date}          who is booked on that class on that date (app members AND people who booked on the website)
//   {"action":"send", class_id, date, reason}     emails everyone in that list that the gym cancelled the class
// It does NOT delete bookings or touch Wix. Emailing is optional: the page only calls "send" when the owner chooses to.
// People who booked only on the website are asked of Wix live, every time, and are NEVER stored here (the database keeps them as anonymous rows on purpose).
// Verify JWT stays ON (a signed-in person is required) and the code then checks that person is an admin.
// Secrets used: CRON_SECRET (to call send-email), WIX_API_KEY and WIX_SITE_ID (same as the booking sync; the key needs to read bookings).
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

const GYM = /gym access|open gym/i;   // the open-gym service; everything else is a class (same rule as the timetable sync)
const weekday = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(new Date(iso + "T12:00:00Z"));
const pretty = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00Z"));
const londonDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
function londonParts(iso: string): { date: string; time: string } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(iso)).reduce((a: Record<string, string>, x) => { a[x.type] = x.value; return a; }, {});
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const firstOf = (s: string) => (s ?? "").trim().split(/\s+/)[0] || "there";

interface Person { key: string; name: string; source: "app" | "website"; email: string | null; user_id: string | null; first: string }
interface ClassRow { id: number; name: string; day_name: string; start_time: string; kind: string }

async function wixPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", "Authorization": Deno.env.get("WIX_API_KEY")!, "wix-site-id": Deno.env.get("WIX_SITE_ID")! },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("wix_" + res.status);
  return await res.json();
}

// confirmed website bookings for this class on this date, straight from Wix (not stored)
async function wixPeople(c: ClassRow, date: string): Promise<{ id: string; first: string; last: string; email: string | null }[]> {
  const fromUtc = new Date(Date.parse(date + "T00:00:00Z") - 3 * 3600 * 1000).toISOString();
  const toUtc = new Date(Date.parse(date + "T00:00:00Z") + 27 * 3600 * 1000).toISOString();
  const svc = await wixPost("https://www.wixapis.com/_api/bookings/v2/services/query", { query: { paging: { limit: 100 } } });
  const names = new Map<string, string>();
  for (const s of svc.services ?? []) names.set(s.id, String(s.name ?? "").trim());
  const out: { id: string; first: string; last: string; email: string | null }[] = [];
  let body: Record<string, unknown> = {
    query: { filter: { $and: [{ status: { $in: ["CONFIRMED"] } }, { startDate: { $gte: fromUtc } }, { startDate: { $lt: toUtc } }] }, sort: [{ fieldName: "startDate", order: "ASC" }], cursorPaging: { limit: 100 } },
  };
  for (let page = 0; page < 20; page++) {
    const data = await wixPost("https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/query", body);
    for (const x of data.extendedBookings ?? []) {
      const b = x.booking ?? {};
      const slot = b.bookedEntity?.slot ?? b.bookedEntity?.item?.slot;
      if (!b.id || !slot?.serviceId || !b.startDate) continue;
      const name = names.get(slot.serviceId) ?? "";
      const isGym = GYM.test(name);
      const sameKind = c.kind === "gym" ? isGym : (!isGym && name.toLowerCase() === c.name.trim().toLowerCase());
      if (!sameKind) continue;
      const lp = londonParts(String(b.startDate));
      if (lp.date !== date || lp.time !== String(c.start_time).slice(0, 5)) continue;
      const ct = b.contactDetails ?? {};
      out.push({ id: String(b.id), first: String(ct.firstName ?? "").trim(), last: String(ct.lastName ?? "").trim(), email: ct.email ? String(ct.email).toLowerCase() : null });
    }
    const next = data.pagingMetadata?.cursors?.next;
    if (!data.pagingMetadata?.hasNext || !next) break;
    body = { query: { cursorPaging: { cursor: next, limit: 100 } } };
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (prof?.is_admin !== true) return json(req, 403, { ok: false, error: "Admins only." });

  let input: { action?: string; class_id?: unknown; date?: unknown; reason?: unknown };
  try { input = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }
  const action = input.action === "send" ? "send" : input.action === "preview" ? "preview" : null;
  if (!action) return json(req, 400, { ok: false, error: "Unknown action." });
  const classId = Number(input.class_id), date = String(input.date ?? "");
  const reason = String(input.reason ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  if (!Number.isInteger(classId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z"))) return json(req, 400, { ok: false, error: "Pick a class and a date." });

  const { data: c } = await admin.from("classes").select("id, name, day_name, start_time, kind").eq("id", classId).maybeSingle();
  if (!c) return json(req, 404, { ok: false, error: "Class not found." });
  const cls = c as ClassRow;
  if (weekday(date) !== cls.day_name) return json(req, 422, { ok: false, error: `${cls.name} runs on ${cls.day_name}s. Pick a ${cls.day_name}.` });
  if (date < londonDate(new Date())) return json(req, 422, { ok: false, error: "That date has already passed." });

  try {
    // 1. app bookings (members), with their email and name
    const { data: bk } = await admin.from("class_bookings").select("id, user_id").eq("class_id", classId).eq("date", date);
    const people: Person[] = [];
    const seen = new Set<string>();
    for (const b of (bk ?? []) as { id: string; user_id: string }[]) {
      const { data: pr } = await admin.from("profiles").select("full_name").eq("id", b.user_id).maybeSingle();
      const { data: au } = await admin.auth.admin.getUserById(b.user_id);
      const email = au?.user?.email ? au.user.email.toLowerCase() : null;
      const full = String(pr?.full_name ?? "").trim();
      if (email) seen.add(email);
      people.push({ key: "gymcancel-" + b.id, name: full || "Member", source: "app", email, user_id: b.user_id, first: firstOf(full) });
    }
    // 2. website bookings, asked of Wix now. A member who booked on the website is already above (same email), so they are not listed twice.
    let wixOk = true;
    try {
      for (const w of await wixPeople(cls, date)) {
        if (w.email && seen.has(w.email)) continue;
        if (w.email) seen.add(w.email);
        const full = (w.first + " " + w.last).trim();
        people.push({ key: "gymcancel-wix-" + w.id, name: full || "Website booking", source: "website", email: w.email, user_id: null, first: w.first || "there" });
      }
    } catch (e) {
      wixOk = false;
      console.error("admin-class-cancelled wix lookup failed", String((e as Error)?.message ?? e));
    }

    const when = pretty(date) + " at " + String(cls.start_time).slice(0, 5);
    const className = cls.kind === "gym" ? "Gym session" : cls.name;
    const noEmail = people.filter((p) => !p.email && !p.user_id).length;

    if (action === "preview") {
      return json(req, 200, {
        ok: true, class_name: className, when, wix_ok: wixOk, count: people.length,
        app_count: people.filter((p) => p.source === "app").length, website_count: people.filter((p) => p.source === "website").length, no_email: noEmail,
        people: people.map((p) => ({ name: p.name, source: p.source, can_email: !!(p.email || p.user_id) })),
      });
    }

    // send: if the website could not be checked, send nothing rather than email only half the people
    if (!wixOk) return json(req, 502, { ok: false, error: "Could not check the website bookings, so nothing was sent. Please try again in a minute." });
    const cron = Deno.env.get("CRON_SECRET") ?? "";
    let sent = 0, skipped = 0, failed = 0;
    for (const p of people) {
      if (!p.email && !p.user_id) { skipped++; continue; }
      try {
        const r = await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-email", {
          method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": cron },
          body: JSON.stringify({ template: "class-cancelled-by-gym", ...(p.user_id ? { user_id: p.user_id } : { to: p.email }), dedupe_key: p.key, vars: { first_name: p.first, class_name: className, when, reason } }),
          signal: AbortSignal.timeout(8000),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || !out.ok) failed++; else if (out.skipped) skipped++; else sent++;
      } catch { failed++; }
    }
    await admin.from("staff_access_log").insert({ user_id: u.user.id, action: "class_cancelled_email", target: `${classId}:${date}` });
    return json(req, 200, { ok: true, class_name: className, when, count: people.length, sent, skipped, failed });
  } catch (e) {
    console.error("admin-class-cancelled failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong." });
  }
});
