// MY GYM London: show bookings made on the website (Wix) in the app. One way: Wix to app.
// Deployed with "Verify JWT" OFF (like sync-timetable), after supabase/migration-wix-bookings-sync.sql.
//
// What it does:
//   1. Reads CONFIRMED Wix class and gym bookings for the next 22 days (Wix only returns what the booking window allows).
//   2. Matches each to a member by email and to a timetable row by service, weekday and start time (London time).
//   3. Adds the booking to public.class_bookings with source = 'wix' (so no app email is sent: Wix sends its own),
//      and removes app rows that came from Wix and are no longer confirmed there (cancelled in Wix).
//   Bookings made in the app (source = 'app') are never changed or removed.
//   4. Bookings by people with no app account (or another email) are kept in public.wix_other_bookings as anonymous rows
//      (class, date and Wix booking id only: no name, no email) so the spaces left in the app count everyone.
//
// Safety: DRY RUN BY DEFAULT. Nothing is written unless the body is {"apply": true}. The reply is counts only: no names,
// no emails. If Wix returns an error, nothing changes. If more than half of the Wix rows (min 5) would be removed
// at once, removals are skipped and reported. At most one call a minute.
//
// Secrets: WIX_API_KEY, WIX_SITE_ID (already set). The key needs to read bookings.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2";
import { planSync, type ClassRow, type ExistingOther, type ExistingRow, type WixBooking } from "./logic.ts";

const WINDOW_DAYS = 22;

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

const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

// Only the schedules and the database trigger may call this function: they send the shared secret in the x-cron-secret header.
// Enforced only when the CRON_SECRET secret exists (so nothing breaks before it is set). Compared in constant time.
const cronOk = (req: Request): boolean => {
  const want = Deno.env.get("CRON_SECRET") ?? "";
  if (!want) return true;
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req) => {
  if (!cronOk(req)) return json(401, { error: "Not allowed" });
  if (req.method !== "POST" && req.method !== "GET") return json(405, { error: "Method not allowed" });
  let apply = false;
  if (req.method === "POST") { try { const b = await req.json(); apply = b?.apply === true; } catch (_e) { /* empty body = dry run */ } }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // abuse guard: at most one call a minute
  const { data: guard } = await db.from("sync_log").select("last_call").eq("id", "wix-bookings").maybeSingle();
  if (guard && Date.now() - new Date(guard.last_call).getTime() < 60_000) return json(200, { skipped: true, reason: "called less than a minute ago" });
  await db.from("sync_log").upsert({ id: "wix-bookings", last_call: new Date().toISOString() });

  const finish = async (result: Record<string, unknown>, status = 200) => {
    if (apply) await db.from("sync_log").upsert({ id: "wix-bookings", last_call: new Date().toISOString(), last_run: new Date().toISOString(), last_result: result });
    return json(status, { dry: !apply, ...result });
  };

  try {
    // window: from the start of today (London) for 22 days, in UTC for Wix
    const today = londonToday();
    const fromUtc = new Date(Date.parse(today + "T00:00:00Z") - 2 * 3600 * 1000).toISOString(); // 2 hours earlier covers British Summer Time
    const toUtc = new Date(Date.now() + WINDOW_DAYS * 86400 * 1000).toISOString();

    // 1. service names
    const svc = await wixPost("https://www.wixapis.com/_api/bookings/v2/services/query", { query: { paging: { limit: 100 } } });
    const serviceNames = new Map<string, string>();
    for (const s of svc.services ?? []) serviceNames.set(s.id, String(s.name ?? "").trim());

    // 2. confirmed bookings in the window (all pages)
    const bookings: WixBooking[] = [];
    let body: Record<string, unknown> = {
      query: {
        filter: { $and: [{ status: { $in: ["CONFIRMED"] } }, { startDate: { $gte: fromUtc } }, { startDate: { $lt: toUtc } }] },
        sort: [{ fieldName: "startDate", order: "ASC" }],
        cursorPaging: { limit: 100 },
      },
    };
    for (let page = 0; page < 50; page++) {
      const data = await wixPost("https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/query", body);
      for (const x of data.extendedBookings ?? []) {
        const b = x.booking ?? {};
        const slot = b.bookedEntity?.slot ?? b.bookedEntity?.item?.slot;
        if (!b.id || !slot?.serviceId || !b.startDate) continue;   // courses and anything odd are ignored
        bookings.push({ id: String(b.id), startDate: String(b.startDate), serviceId: String(slot.serviceId), email: b.contactDetails?.email ?? null });
      }
      const next = data.pagingMetadata?.cursors?.next;
      if (!data.pagingMetadata?.hasNext || !next) break;
      body = { query: { cursorPaging: { cursor: next, limit: 100 } } };
      if (page === 49) throw new Error("too_many_pages");
    }

    // 3. what the app has
    const { data: cls, error: e1 } = await db.from("classes").select("id, day_name, start_time, name, kind").eq("active", true);
    if (e1) throw e1;
    const { data: ex, error: e2 } = await db.from("class_bookings").select("id, class_id, user_id, date, source, wix_booking_id").gte("date", today);
    if (e2) throw e2;
    const { data: exOther, error: e2b } = await db.from("wix_other_bookings").select("wix_booking_id, date").gte("date", today);
    if (e2b) throw e2b;
    const userByEmail = new Map<string, string>();
    for (let page = 1; page <= 20; page++) {
      const { data: u, error: e3 } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (e3) throw e3;
      for (const m of u.users) if (m.email) userByEmail.set(m.email.toLowerCase(), m.id);
      if (u.users.length < 1000) break;
    }

    const plan = planSync({
      bookings, serviceNames, classes: (cls ?? []) as ClassRow[], userByEmail, existing: (ex ?? []) as ExistingRow[],
      existingOther: (exOther ?? []) as ExistingOther[], windowFromDate: today,
    });

    if (!apply) return await finish({ ok: true, counts: plan.counts });

    let added = 0, removed = 0, otherAdded = 0, otherRemoved = 0;
    if (plan.otherAdd.length) {
      const { error } = await db.from("wix_other_bookings").upsert(plan.otherAdd, { onConflict: "wix_booking_id", ignoreDuplicates: true });
      if (error) throw error;
      otherAdded = plan.otherAdd.length;
    }
    if (plan.add.length) {
      const { error } = await db.from("class_bookings").upsert(plan.add.map((r) => ({ ...r, source: "wix" })), { onConflict: "class_id,user_id,date", ignoreDuplicates: true });
      if (error) throw error;
      added = plan.add.length;
    }
    if (plan.remove.length) {
      const { error } = await db.from("class_bookings").delete().in("id", plan.remove).eq("source", "wix");
      if (error) throw error;
      removed = plan.remove.length;
    }
    if (plan.otherRemove.length) {
      const { error } = await db.from("wix_other_bookings").delete().in("wix_booking_id", plan.otherRemove);
      if (error) throw error;
      otherRemoved = plan.otherRemove.length;
    }
    return await finish({ ok: true, counts: plan.counts, added, removed, otherAdded, otherRemoved });
  } catch (e) {
    return await finish({ ok: false, error: String((e as Error)?.message ?? e), note: "nothing was changed" }, 502);
  }
});
