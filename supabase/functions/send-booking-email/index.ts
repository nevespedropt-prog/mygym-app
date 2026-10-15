// MY GYM London: send the booking confirmation email for a booking made in the app.
// NOT DEPLOYED YET. Deploy with "Verify JWT" OFF (like sync-timetable), after supabase/migration-booking-emails.sql
// and after the RESEND_API_KEY secret is set. See supabase/RESEND-SETUP.md.
//
// How it is called: a database trigger (migration-booking-emails.sql) posts { booking_id } here when a booking row is added.
// It can also be called with an empty body to catch up on bookings from the last 30 minutes that have no email yet.
//
// Safety: the caller only says WHICH booking. The email address, text and recipient always come from the database,
// so nobody can use this function to send arbitrary mail. Each booking is emailed once (public.email_log),
// at most 3 attempts, only for bookings made in the last 6 hours, and never for bookings that came from Wix
// (Wix sends its own confirmation).
//
// Secrets: RESEND_API_KEY (set in Edge Functions -> Secrets). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatic.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmail } from "./email.ts";

const FROM = "MY GYM London <info@mygymlondon.co.uk>";
const REPLY_TO = "info@mygymlondon.co.uk";
const MAX_ATTEMPTS = 3;
const FRESH_HOURS = 6;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const key = (Deno.env.get("RESEND_API_KEY") ?? "").replace(/["'\s]/g, "");
  if (!key) return json(500, { ok: false, error: "RESEND_API_KEY secret is not set" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let bookingId = "";
  try { const b = await req.json(); bookingId = typeof b?.booking_id === "string" ? b.booking_id : ""; } catch { /* empty body = catch-up */ }

  let ids: string[] = [];
  if (bookingId) {
    ids = [bookingId];
  } else {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await db.from("class_bookings").select("id").gte("created_at", since).limit(100);
    if (error) return json(500, { ok: false, error: error.message });
    ids = (data ?? []).map((r) => r.id as string);
  }

  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const id of ids) {
    const out = await sendOne(db, key, id);
    result[out]++;
  }
  return json(200, { ok: true, ...result });
});

// deno-lint-ignore no-explicit-any
async function sendOne(db: any, key: string, id: string): Promise<"sent" | "skipped" | "failed"> {
  const { data: b } = await db.from("class_bookings").select("*").eq("id", id).maybeSingle();
  if (!b) return "skipped";
  if ((b.source ?? "app") !== "app") return "skipped";                       // Wix emails its own
  if (Date.now() - new Date(b.created_at).getTime() > FRESH_HOURS * 3600 * 1000) return "skipped";

  const { data: log } = await db.from("email_log").select("status, attempts").eq("booking_id", id).maybeSingle();
  if (log && (log.status === "sent" || (log.attempts ?? 0) >= MAX_ATTEMPTS)) return "skipped";

  const [{ data: c }, { data: u }, { data: p }] = await Promise.all([
    db.from("classes").select("name, start_time, kind, coach").eq("id", b.class_id).maybeSingle(),
    db.auth.admin.getUserById(b.user_id),
    db.from("profiles").select("full_name").eq("id", b.user_id).maybeSingle(),
  ]);
  const to = u?.user?.email;
  if (!c || !to) return "skipped";

  const mail = buildEmail({ id, date: b.date }, c, p?.full_name);
  const attempts = (log?.attempts ?? 0) + 1;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Idempotency-Key": "booking-" + id },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: mail.subject, text: mail.text, html: mail.html }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((out as { message?: string }).message ?? "Resend error " + r.status);
    await db.from("email_log").upsert({ booking_id: id, status: "sent", attempts, provider_id: (out as { id?: string }).id ?? null, error: null, updated_at: new Date().toISOString() });
    return "sent";
  } catch (e) {
    await db.from("email_log").upsert({ booking_id: id, status: "failed", attempts, error: String((e as Error).message).slice(0, 300), updated_at: new Date().toISOString() });
    return "failed";
  }
}
