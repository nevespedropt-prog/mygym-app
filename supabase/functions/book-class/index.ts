// MY GYM London: book and cancel classes from the app, and keep Wix in step (phase 2).
// DEPLOYED 2026-10-19 with "Verify JWT" ON (the default): the function checks the member's login itself too.
// Needs supabase/migration-book-class.sql (the app_flags switch) and the secrets WIX_API_KEY, WIX_SITE_ID (already set).
// The Wix key must be allowed to CREATE and CANCEL bookings (reading was enough for sync-wix-bookings).
//
// The switch (public.app_flags, key 'wix_booking') decides who goes through Wix: 'off' = nobody (the app books exactly as
// before), 'owner' = only the test emails, 'on' = everyone. With the switch off this function only does the same insert
// the app used to do directly.
//
// BOOK through Wix, in this order (so a failure never leaves a confirmation email for a booking that does not exist):
//   1. check the login, the class, and that the member has not already booked it
//   2. find the Wix session (same service, same London date and time) and check it still has a space
//   3. create the Wix booking as CONFIRMED, no payment, no Wix email (Wix then holds the space)
//   4. save the app booking (all the usual database rules apply, run as the member)
//      if that fails, the Wix booking is cancelled again (rollback)
//   5. store the Wix booking id on the app row
// CANCEL: the database rules (10 minutes before, own bookings only) run first as the member; then the Wix booking is
// cancelled. If Wix cannot be reached the app row is put back and the member is told to try again.
// Replies carry only ok/error text and ids: no names, no emails. Unknown database errors are never shown to the member.
// Guards: the same date, weekday and gym rules as the database run BEFORE Wix is touched; one attempt per member every
// few seconds; at most 30 upcoming bookings per member; names sent to Wix are cleaned and shortened.
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkBookingDate, contactName, findSlot, londonDate, londonHM, matchService, memberSafeError, MAX_UPCOMING, MIN_SECONDS_BETWEEN, useWix } from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const wixHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": Deno.env.get("WIX_API_KEY")!,
  "wix-site-id": Deno.env.get("WIX_SITE_ID")!,
});
async function wix(method: string, path: string, body?: unknown) {
  const res = await fetch("https://www.wixapis.com" + path, { method, headers: wixHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });
  let data: any = null; try { data = await res.json(); } catch (_e) { /* empty */ }
  return { ok: res.ok, status: res.status, data };
}

/** The details the "booking-cancelled" email needs. Gym sessions are called "Gym session". */
export function cancelEmailVars(row: { date: string }, c: { name: string; start_time: string; kind: string }, fullName?: string | null) {
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(row.date + "T12:00:00Z")) + " at " + String(c.start_time).slice(0, 5);
  return { first_name: (fullName ?? "").trim().split(/\s+/)[0] || "there", class_name: c.kind === "gym" ? "Gym session" : c.name, when };
}

/** Email the member that their booking is cancelled (new email library, via send-email). Never blocks or fails the cancellation. */
// deno-lint-ignore no-explicit-any
async function emailCancelled(db: any, row: { id: string; class_id: number; user_id: string; date: string }, to: string) {
  try {
    const [{ data: c }, { data: p }] = await Promise.all([
      db.from("classes").select("name, start_time, kind").eq("id", row.class_id).maybeSingle(),
      db.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle(),
    ]);
    if (!c || !to) return;
    await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" },
      body: JSON.stringify({ template: "booking-cancelled", to, vars: cancelEmailVars(row, c, p?.full_name), dedupe_key: "cancel-" + row.id }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (_e) { /* the cancellation already happened; a missing email is not worth failing it */ }
}

/** Cancel a Wix booking (no Wix email; our 10-minute rule has already been checked). Tries twice. */
async function wixCancel(bookingId: string): Promise<boolean> {
  for (let i = 0; i < 2; i++) {
    // look the booking up by id (a plain GET of one booking returns 404 here, so use the same query the sync uses)
    const g = await wix("POST", "/_api/bookings-reader/v2/extended-bookings/query", { query: { filter: { id: { $eq: bookingId } }, cursorPaging: { limit: 1 } } });
    if (g.ok && (g.data?.extendedBookings ?? []).length === 0) return true;   // Wix has no such booking: nothing to cancel
    const b = g.data?.extendedBookings?.[0]?.booking;
    if (g.ok && b?.status === "CANCELED") return true;
    const revision = b?.revision;
    if (g.ok && revision !== undefined) {
      const c = await wix("POST", `/bookings/v2/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        revision, participantNotification: { notifyParticipants: false }, flowControlSettings: { ignoreCancellationPolicy: true },
      });
      if (c.ok) return true;
    }
  }
  return false;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: au } = await db.auth.getUser(token);
  const user = au?.user;
  if (!user || !user.email) return json(401, { error: "Please sign in again." });
  // runs as the member: row security, triggers and the booking rules all apply exactly as for a direct insert
  const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

  let body: any; try { body = await req.json(); } catch (_e) { return json(400, { error: "Bad request" }); }
  const action = body?.action;

  const { data: flag } = await db.from("app_flags").select("mode, test_emails").eq("key", "wix_booking").maybeSingle();
  const viaWix = useWix(flag?.mode, flag?.test_emails, user.email);
  const issue = async (what: string) => { await db.from("sync_log").upsert({ id: "wix-book-issue", last_call: new Date().toISOString(), last_result: { what } }); };

  // ---------------------------------------------------------------- CANCEL
  if (action === "cancel") {
    const id = String(body?.booking_id ?? "");
    const { data: row } = await db.from("class_bookings").select("id, class_id, user_id, date, wix_booking_id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!row) return json(200, { ok: true });                       // nothing to cancel
    const { error: de } = await uc.from("class_bookings").delete().eq("id", id).eq("user_id", user.id);
    if (de) return json(400, { error: memberSafeError(de.code, de.message), code: de.code });
    if (viaWix && row.wix_booking_id) {
      if (!(await wixCancel(row.wix_booking_id))) {
        // put the app row back (server insert for a Wix booking skips the checks and sends no email)
        await db.from("class_bookings").insert({ class_id: row.class_id, user_id: row.user_id, date: row.date, source: "wix", wix_booking_id: row.wix_booking_id });
        await issue("cancel failed in Wix, app row restored");
        return json(502, { error: "We couldn't cancel this just now. Please try again in a minute." });
      }
    }
    await emailCancelled(db, row, user.email);
    return json(200, { ok: true });
  }

  // ---------------------------------------------------------------- BOOK
  if (action !== "book") return json(400, { error: "Bad request" });
  const classId = Number(body?.class_id);
  const date = String(body?.date ?? "");
  if (!Number.isInteger(classId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: "Bad request" });

  // a member can hold only so many future bookings at once (stops one account taking every space)
  const today = londonDate(new Date());
  const { count: upcoming } = await db.from("class_bookings").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("date", today);
  if ((upcoming ?? 0) >= MAX_UPCOMING) return json(400, { error: "You have reached the limit of upcoming bookings. Cancel one to book another.", code: "P0001" });

  if (!viaWix) {
    const { error } = await uc.from("class_bookings").insert({ class_id: classId, date, user_id: user.id });
    if (error) return json(400, { error: memberSafeError(error.code, error.message), code: error.code });
    return json(200, { ok: true, wix: false });
  }

  // 1. the class, and no double booking
  const { data: cls } = await db.from("classes").select("name, kind, day_name, start_time").eq("id", classId).eq("active", true).maybeSingle();
  if (!cls) return json(400, { error: "Class not available" });
  const { data: dup } = await db.from("class_bookings").select("id").eq("class_id", classId).eq("date", date).eq("user_id", user.id).maybeSingle();
  if (dup) return json(400, { error: "Already booked", code: "23505" });
  // the same rules the database applies, checked BEFORE Wix is touched (so a refused booking never flickers in Wix)
  const dateErr = checkBookingDate(date, cls.day_name, today, String(cls.start_time), londonHM(new Date()), cls.kind);
  if (dateErr) return json(400, { error: dateErr, code: "P0001" });
  if (cls.kind === "gym") {
    const { data: pf } = await db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!pf?.is_admin) {
      const { data: ma } = await db.from("member_access").select("gym_access, checked_at").eq("user_id", user.id).maybeSingle();
      if (!ma?.gym_access || !(Date.parse(ma.checked_at) > Date.now() - 24 * 3600 * 1000)) {
        return json(400, { error: "Gym booking is for Gym & Exercise Class members", code: "P0001" });
      }
    }
  }
  // slow down rapid repeat attempts by the same member (each attempt costs several Wix calls)
  const rl = "bk-" + user.id;
  const { data: last } = await db.from("sync_log").select("last_call").eq("id", rl).maybeSingle();
  if (last && Date.now() - new Date(last.last_call).getTime() < MIN_SECONDS_BETWEEN * 1000) return json(429, { error: "Please wait a few seconds before booking again." });
  await db.from("sync_log").upsert({ id: rl, last_call: new Date().toISOString() });

  // 2. the Wix session
  const sv = await wix("POST", "/_api/bookings/v2/services/query", { query: { paging: { limit: 100 } } });
  if (!sv.ok) { await issue("services lookup failed " + sv.status); return json(502, { error: "Booking is busy right now. Please try again in a minute." }); }
  const serviceId = matchService(cls.kind, cls.name, (sv.data?.services ?? []).map((s: any) => ({ id: s.id, name: String(s.name ?? "") })));
  if (!serviceId) { await issue("no Wix service for a class"); return json(502, { error: "Booking is busy right now. Please try again in a minute." }); }
  const time = String(cls.start_time).slice(0, 5);
  const ts = await wix("POST", "/_api/service-availability/v2/time-slots/event", {
    fromLocalDate: `${date}T${time}:00`, toLocalDate: `${date}T${time}:59`, timeZone: "Europe/London",
    serviceIds: [serviceId], includeNonBookable: true, cursorPaging: { limit: 20 },
  });
  if (!ts.ok) { await issue("time slots failed " + ts.status); return json(502, { error: "Booking is busy right now. Please try again in a minute." }); }
  const slot = findSlot(ts.data?.timeSlots ?? [], date, time);
  if (!slot) return json(400, { error: "This session isn't open for booking yet. Please try again closer to the day." });
  if (slot.remaining !== null && slot.remaining <= 0) return json(400, { error: "This class is full" });

  // 3. the Wix booking (confirmed, no payment, no Wix email)
  const { data: prof } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const who = contactName(prof?.full_name, user.email);
  const cr = await wix("POST", "/bookings/v2/bookings", {
    booking: {
      bookedEntity: { slot: { eventId: slot.eventId } },
      contactDetails: { firstName: who.firstName, lastName: who.lastName, email: user.email },
      totalParticipants: 1, status: "CONFIRMED",
    },
    participantNotification: { notifyParticipants: false },
  });
  const wixId: string | undefined = cr.data?.booking?.id;
  if (!cr.ok || !wixId) {
    await issue("create failed " + cr.status);
    return json(cr.status === 400 || cr.status === 428 ? 400 : 502, { error: cr.status === 400 || cr.status === 428 ? "This class is full" : "Booking is busy right now. Please try again in a minute." });
  }

  // 4. the app booking (member rules apply); roll Wix back if it fails
  const { error: ie } = await uc.from("class_bookings").insert({ class_id: classId, date, user_id: user.id });
  if (ie) {
    if (ie.code === "23505") {
      // the 5-minute sync may have mirrored this very booking a moment ago: that is fine, nothing to undo
      const { data: ex } = await db.from("class_bookings").select("wix_booking_id").eq("class_id", classId).eq("date", date).eq("user_id", user.id).maybeSingle();
      if (ex?.wix_booking_id === wixId) return json(200, { ok: true, wix: true });
    }
    if (!(await wixCancel(wixId))) await issue("rollback failed: a Wix booking may be left without an app booking");
    return json(400, { error: memberSafeError(ie.code, ie.message), code: ie.code });
  }

  // 5. remember the Wix booking id on the app row
  for (let i = 0; i < 2; i++) {
    const { error: ue } = await db.from("class_bookings").update({ wix_booking_id: wixId }).eq("class_id", classId).eq("date", date).eq("user_id", user.id);
    if (!ue) return json(200, { ok: true, wix: true });
  }
  await db.from("class_bookings").delete().eq("class_id", classId).eq("date", date).eq("user_id", user.id);
  const undone = await wixCancel(wixId);
  await issue(undone ? "could not store the Wix booking id, rolled back" : "could not store the Wix booking id and the Wix rollback failed");
  return json(502, { error: "Booking didn't go through. Please try again." });
}

Deno.serve(async (req) => {
  try { return await handle(req); }
  catch (_e) { return json(500, { error: "Something went wrong. Please try again." }); }   // never leak internals
});
