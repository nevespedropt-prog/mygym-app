// MY GYM London: back office "book someone into a class or gym slot" (admin, manager and reception).
//   {"action":"book","mode":"member","class_id","date","email"}  a member with a class or gym membership (their app booking, if they have an app login, plus the Wix booking)
//   {"action":"book","mode":"payg","class_id","date","name","phone","email","amount","paid"}  a pay as you go person who pays at the gym (Wix booking + a record of what they paid)
//   {"action":"remove","id"}  take a pay as you go walk-in off the class again (cancels the Wix booking)
//   {"action":"remove_booking","id"}  take a member's booking off the class (cancels the Wix booking, no email)
// Wix stays the source of truth for spaces: the Wix booking is made first, so a full class is refused. No emails are sent from here.
// Verify JWT stays ON and the code checks the staff role.
import { createClient } from "npm:@supabase/supabase-js@2";
import { contactName, findSlot, londonDate, matchService } from "./logic.ts";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// deno-lint-ignore no-explicit-any
async function wix(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch("https://www.wixapis.com" + path, { method, signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/json", Authorization: Deno.env.get("WIX_API_KEY")!, "wix-site-id": Deno.env.get("WIX_SITE_ID")! }, body: body === undefined ? undefined : JSON.stringify(body) });
  // deno-lint-ignore no-explicit-any
  let data: any = null; try { data = await r.json(); } catch (_e) { /* empty */ }
  return { ok: r.ok, status: r.status, data };
}
async function wixCancel(bookingId: string): Promise<boolean> {
  for (let i = 0; i < 2; i++) {
    const g = await wix("POST", "/_api/bookings-reader/v2/extended-bookings/query", { query: { filter: { id: { $eq: bookingId } }, cursorPaging: { limit: 1 } } });
    if (g.ok && (g.data?.extendedBookings ?? []).length === 0) return true;
    const b = g.data?.extendedBookings?.[0]?.booking;
    if (g.ok && b?.status === "CANCELED") return true;
    if (g.ok && b?.revision !== undefined) {
      const c = await wix("POST", `/bookings/v2/bookings/${encodeURIComponent(bookingId)}/cancel`, { revision: b.revision, participantNotification: { notifyParticipants: false }, flowControlSettings: { ignoreCancellationPolicy: true } });
      if (c.ok) return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: prof } = await db.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  const { data: st } = await db.from("staff").select("role").eq("user_id", u.user.id).maybeSingle();
  if (prof?.is_admin !== true && !(st && ["admin", "manager", "reception"].includes(st.role))) return json(req, 403, { ok: false, error: "Only the gym team can book people in." });
  // deno-lint-ignore no-explicit-any
  let b: any; try { b = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }
  const log = (action: string, target: string) => db.from("staff_access_log").insert({ user_id: u.user!.id, action, target: target.slice(0, 200) });

  try {
    if (b.action === "remove") {
      const { data: w } = await db.from("walkin_bookings").select("id, wix_booking_id").eq("id", String(b.id ?? "")).maybeSingle();
      if (!w) return json(req, 404, { ok: false, error: "That booking was not found. Reload the page." });
      if (w.wix_booking_id && !(await wixCancel(w.wix_booking_id))) return json(req, 502, { ok: false, error: "Wix would not cancel it just now. Try again in a minute." });
      if (w.wix_booking_id) await db.from("wix_other_bookings").delete().eq("wix_booking_id", w.wix_booking_id);
      await db.from("walkin_bookings").delete().eq("id", w.id);
      await log("walkin_removed", String(w.id));
      return json(req, 200, { ok: true });
    }
    if (b.action === "remove_booking") {
      const { data: bk } = await db.from("class_bookings").select("id, wix_booking_id, class_id, date").eq("id", String(b.id ?? "")).maybeSingle();
      if (!bk) return json(req, 404, { ok: false, error: "That booking was not found. Reload the page." });
      if (bk.wix_booking_id && !(await wixCancel(bk.wix_booking_id))) return json(req, 502, { ok: false, error: "Wix would not cancel it just now. Try again in a minute." });
      const { error: de } = await db.from("class_bookings").delete().eq("id", bk.id);
      if (de) return json(req, 500, { ok: false, error: "Could not remove it. Reload the page and check." });
      await log("staff_removed_booking", "class " + bk.class_id + " on " + bk.date);
      return json(req, 200, { ok: true });
    }
    if (b.action !== "book") return json(req, 400, { ok: false, error: "Unknown action." });

    const classId = Number(b.class_id), date = String(b.date ?? "");
    if (!Number.isInteger(classId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(req, 400, { ok: false, error: "Bad request" });
    if (date < londonDate(new Date())) return json(req, 422, { ok: false, error: "That date has passed." });
    const { data: cls } = await db.from("classes").select("name, kind, day_name, start_time").eq("id", classId).eq("active", true).maybeSingle();
    if (!cls) return json(req, 404, { ok: false, error: "That class is not available." });
    const dayName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(new Date(date + "T12:00:00Z"));
    if (dayName !== cls.day_name) return json(req, 422, { ok: false, error: "That class does not run on " + dayName + "." });

    // who
    const mode = b.mode === "member" ? "member" : "payg";
    let email = String(b.email ?? "").trim().toLowerCase(), name = String(b.name ?? "").trim().slice(0, 80), phone = String(b.phone ?? "").trim().slice(0, 30), userId: string | null = null;
    if (email && !EMAIL.test(email)) return json(req, 422, { ok: false, error: "That email does not look right." });
    if (mode === "member") {
      if (!email) return json(req, 422, { ok: false, error: "Choose the member." });
      const { data: orders } = await db.from("wix_orders").select("plan_name, status").ilike("email", email).eq("status", "ACTIVE");
      const types = (orders ?? []).map((o: { plan_name: string }) => (/personal training/i.test(o.plan_name) ? "pt" : /payg|pay as you go/i.test(o.plan_name) ? "payg" : /^\s*gym( only)? membership\s*$/i.test(o.plan_name) ? "gym" : /gym/i.test(o.plan_name) ? "gym_classes" : /class/i.test(o.plan_name) ? "classes" : "other"));
      const ok = cls.kind === "gym" ? types.some((t) => t === "gym" || t === "gym_classes") : types.some((t) => t === "classes" || t === "gym_classes");
      if (!ok) return json(req, 422, { ok: false, error: cls.kind === "gym" ? "They do not have a membership that includes the gym. Add them as pay as you go instead." : "They do not have a class membership. Add them as pay as you go instead." });
      userId = (await db.rpc("_uid_by_email", { p_email: email })).data as string | null;
      if (userId) {
        const { data: dup } = await db.from("class_bookings").select("id").eq("class_id", classId).eq("date", date).eq("user_id", userId).maybeSingle();
        if (dup) return json(req, 409, { ok: false, error: "They are already booked into this class." });
      }
      const { data: wc } = await db.from("wix_contacts").select("full_name").ilike("email", email).limit(1).maybeSingle();
      const { data: pr } = userId ? await db.from("profiles").select("full_name").eq("id", userId).maybeSingle() : { data: null };
      name = (pr?.full_name as string) || (wc?.full_name as string) || email;
    } else if (name.length < 2) return json(req, 422, { ok: false, error: "Add their name." });

    // the Wix session, then the Wix booking (a full class is refused here)
    const sv = await wix("POST", "/_api/bookings/v2/services/query", { query: { paging: { limit: 100 } } });
    if (!sv.ok) return json(req, 502, { ok: false, error: "Wix is busy. Try again in a minute." });
    // deno-lint-ignore no-explicit-any
    const serviceId = matchService(cls.kind, cls.name, (sv.data?.services ?? []).map((s: any) => ({ id: s.id, name: String(s.name ?? "") })));
    if (!serviceId) return json(req, 502, { ok: false, error: "No Wix service matches this class." });
    const time = String(cls.start_time).slice(0, 5);
    const ts = await wix("POST", "/_api/service-availability/v2/time-slots/event", { fromLocalDate: `${date}T${time}:00`, toLocalDate: `${date}T${time}:59`, timeZone: "Europe/London", serviceIds: [serviceId], includeNonBookable: true, cursorPaging: { limit: 20 } });
    if (!ts.ok) return json(req, 502, { ok: false, error: "Wix is busy. Try again in a minute." });
    const slot = findSlot(ts.data?.timeSlots ?? [], date, time);
    if (!slot) return json(req, 422, { ok: false, error: "This session is not open for booking in Wix yet." });
    if (slot.remaining !== null && slot.remaining <= 0) return json(req, 409, { ok: false, error: "This class is full." });
    const who = contactName(name, email || "walkin@example.invalid");
    // deno-lint-ignore no-explicit-any
    const contact: any = { firstName: who.firstName, lastName: who.lastName }; if (email) contact.email = email; if (phone) contact.phone = phone;
    const cr = await wix("POST", "/bookings/v2/bookings", { booking: { bookedEntity: { slot: { eventId: slot.eventId } }, contactDetails: contact, totalParticipants: 1, status: "CONFIRMED" }, participantNotification: { notifyParticipants: false } });
    const wixId: string | undefined = cr.data?.booking?.id;
    if (!cr.ok || !wixId) return json(req, cr.status === 400 || cr.status === 428 ? 409 : 502, { ok: false, error: cr.status === 400 || cr.status === 428 ? "Wix would not take this booking (the class may be full, or Wix needs an email or phone for them)." : "Wix is busy. Try again in a minute." });

    // our own records
    if (mode === "member" && userId) {
      const { error } = await db.from("class_bookings").insert({ class_id: classId, date, user_id: userId, wix_booking_id: wixId });
      if (error) { await wixCancel(wixId); return json(req, 409, { ok: false, error: "Could not save the booking. Nothing was booked." }); }
    } else {
      await db.from("wix_other_bookings").upsert({ wix_booking_id: wixId, class_id: classId, date }, { onConflict: "wix_booking_id", ignoreDuplicates: true });
      await db.from("walkin_bookings").insert({ class_id: classId, date, name, phone: phone || null, email: email || null, kind: mode, amount: mode === "payg" ? (Number(b.amount) || null) : null, paid_at_gym: mode === "payg" ? b.paid !== false : false, wix_booking_id: wixId, created_by: u.user.id });
    }
    await log("staff_booked", (mode === "member" ? email : name) + " into class " + classId + " on " + date);
    return json(req, 200, { ok: true, mode, wix: true });
  } catch (e) {
    console.error("admin-book-member failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong. Check the schedule before trying again." });
  }
});
