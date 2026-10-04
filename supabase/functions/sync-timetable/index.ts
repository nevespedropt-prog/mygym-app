// MY GYM London: keep the app's class timetable in step with the website (Wix Bookings).
// Runs every hour from the database (see supabase/schedule-timetable-sync.sql) and can be called by hand.
//
// What it does:
//   1. Reads the website's class sessions for the next 14 days (so each weekday appears twice).
//   2. Builds the weekly pattern (weekday + start time + class name, length, capacity).
//   3. Updates public.classes rows that it created (source = 'wix'): adds new ones, updates length/capacity,
//      and hides ("retires") ones that are no longer on the website. Nothing is ever deleted, so booking history is safe.
//   Gym hour slots (kind = 'gym') and any class added by hand (source = 'manual') are never touched.
//
// Safety stops (it changes nothing and reports why): fewer than 5 sessions found, more than half of the
// current classes would disappear, or Wix returns an error.
// Dry run: POST {"dry": true} (or GET ?dry=1) returns what it WOULD change and writes nothing.
//
// Secrets: WIX_API_KEY, WIX_SITE_ID (same as member-signup). The key needs "Read Bookings - Public Data" and
// "Read Bookings Calendar Availability". SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const IGNORE = /gym access|open gym/i;   // open-gym hours are handled by the "Book the gym" feature, not as classes

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const wixHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": Deno.env.get("WIX_API_KEY")!,
  "wix-site-id": Deno.env.get("WIX_SITE_ID")!,
});

async function wixPost(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: wixHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("wix_" + res.status + "_" + url.split("/").slice(-2).join("/"));
  return await res.json();
}

const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()); // YYYY-MM-DD
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const lengthText = (mins: number) => (mins % 60 === 0 ? (mins / 60) + " hr" : mins < 60 ? mins + " min" : Math.floor(mins / 60) + " hr " + (mins % 60) + " min");

type Row = { day_name: string; start_time: string; name: string; info: string; capacity: number };

async function websitePattern(): Promise<Map<string, Row>> {
  // service names
  const svc = await wixPost("https://www.wixapis.com/_api/bookings/v2/services/query", { query: { paging: { limit: 100 } } });
  const names = new Map<string, string>();
  for (const s of svc.services ?? []) names.set(s.id, String(s.name ?? "").trim());

  // class sessions, next 14 days
  const today = londonToday();
  let body: Record<string, unknown> = {
    fromLocalDate: today + "T00:00:00",
    toLocalDate: addDays(today, 14) + "T23:59:59",
    timeZone: "Europe/London",
    includeNonBookable: true,
    cursorPaging: { limit: 100 },
  };
  const out = new Map<string, Row>();
  for (let page = 0; page < 10; page++) {
    const data = await wixPost("https://www.wixapis.com/_api/service-availability/v2/time-slots/event", body);
    for (const slot of data.timeSlots ?? []) {
      const name = names.get(slot.serviceId);
      if (!name || IGNORE.test(name)) continue;
      const start = String(slot.localStartDate), end = String(slot.localEndDate);
      const day = DAYS[new Date(start.slice(0, 10) + "T12:00:00Z").getUTCDay()];
      const time = start.slice(11, 16);
      const mins = Math.round((new Date(end + "Z").getTime() - new Date(start + "Z").getTime()) / 60000);
      const cap = Math.max(1, Number(slot.totalCapacity) || 1);
      const key = day + "|" + time + "|" + name;
      const prev = out.get(key);
      out.set(key, { day_name: day, start_time: time, name, info: lengthText(mins), capacity: Math.max(cap, prev?.capacity ?? 0) });
    }
    const next = data.pagingMetadata?.cursors?.next;
    if (!data.pagingMetadata?.hasNext || !next) break;
    body = { cursorPaging: { cursor: next, limit: 100 } };
  }
  return out;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let dry = url.searchParams.get("dry") === "1";
  if (req.method === "POST") { try { const b = await req.json(); if (b && b.dry) dry = true; } catch (_e) { /* empty body is fine */ } }
  else if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // abuse guard: at most one call a minute
  const { data: log } = await admin.from("sync_log").select("last_call").eq("id", "timetable").maybeSingle();
  if (log && Date.now() - new Date(log.last_call).getTime() < 60_000) return json(200, { skipped: true, reason: "called less than a minute ago" });
  await admin.from("sync_log").upsert({ id: "timetable", last_call: new Date().toISOString() });

  const finish = async (result: Record<string, unknown>, status = 200) => {
    if (!dry) await admin.from("sync_log").upsert({ id: "timetable", last_call: new Date().toISOString(), last_run: new Date().toISOString(), last_result: result });
    return json(status, { dry, ...result });
  };

  try {
    const wanted = await websitePattern();
    if (wanted.size < 5) return await finish({ ok: false, aborted: "fewer than 5 sessions found on the website; nothing changed", found: wanted.size });

    const { data: current, error } = await admin.from("classes").select("id, day_name, start_time, name, info, capacity")
      .eq("kind", "class").eq("source", "wix").eq("active", true);
    if (error) throw error;
    const have = new Map<string, { id: number } & Row>();
    for (const c of current ?? []) have.set(c.day_name + "|" + c.start_time + "|" + c.name, c);

    const add: Row[] = [], change: { id: number; patch: Partial<Row> }[] = [], retire: number[] = [], retireNames: string[] = [];
    for (const [k, w] of wanted) {
      const c = have.get(k);
      if (!c) add.push(w);
      else if (c.info !== w.info || c.capacity !== w.capacity) change.push({ id: c.id, patch: { info: w.info, capacity: w.capacity } });
    }
    for (const [k, c] of have) if (!wanted.has(k)) { retire.push(c.id); retireNames.push(k); }

    if (have.size >= 8 && retire.length > have.size / 2) {
      return await finish({ ok: false, aborted: "more than half of the current classes would be removed; nothing changed", wouldRetire: retireNames });
    }

    const summary = {
      ok: true,
      sessionsOnWebsite: wanted.size,
      added: add.map((r) => `${r.day_name} ${r.start_time} ${r.name} (${r.info}, ${r.capacity})`),
      changed: change.length,
      retired: retireNames,
    };
    if (dry) return json(200, { dry: true, ...summary, websiteList: [...wanted.keys()].sort() });

    if (add.length) {
      const { error: e1 } = await admin.from("classes").insert(add.map((r) => ({
        ...r, coach: "", kind: "class", source: "wix", active: true,
        sort: Number(r.start_time.slice(0, 2)) * 60 + Number(r.start_time.slice(3, 5)),
      })));
      if (e1) throw e1;
    }
    for (const c of change) { const { error: e2 } = await admin.from("classes").update(c.patch).eq("id", c.id); if (e2) throw e2; }
    if (retire.length) { const { error: e3 } = await admin.from("classes").update({ active: false }).in("id", retire); if (e3) throw e3; }
    return await finish(summary);
  } catch (e) {
    return await finish({ ok: false, error: String((e as Error)?.message ?? e), note: "nothing was changed" }, 502);
  }
});
