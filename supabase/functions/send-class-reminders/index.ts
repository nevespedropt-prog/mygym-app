// MY GYM London: send a push reminder about one hour before a member's class or gym booking.
// Runs every 5 minutes from the database (see supabase/schedule-class-reminders.sql) and can be called by hand.
//
// What it does:
//   1. Asks the database which bookings start in 55 to 65 minutes (UK time), were made more than an hour ahead,
//      have no reminder yet, and belong to a member who switched reminders on (public.due_class_reminders()).
//   2. Sends each of that member's phones a push notification.
//   3. Marks the booking as reminded so it is never sent twice. Phones that no longer exist (404/410) are removed.
//
// Safe to call at any time and as often as you like: it only sends reminders that are due, once each.
// Secrets: VAPID_PRIVATE_KEY (set it in Edge Functions -> Secrets). The public key below is not secret.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = "BGl8sNUKAjTm2bGsfgJwXXW9D6uVUMHakouwzBVSbHUuEUDIJHiwmHZA24HRL8AawIWcvTkEgWVL-rKDCGbj1p0";
const VAPID_SUBJECT = "mailto:info@mygymlondon.co.uk";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!priv) return json(500, { ok: false, error: "VAPID_PRIVATE_KEY secret is not set" });
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, priv);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data, error } = await db.rpc("due_class_reminders");
  if (error) return json(500, { ok: false, error: error.message });

  // group the phones by booking
  const byBooking = new Map<string, { kind: string; name: string; at: string; subs: { endpoint: string; p256dh: string; auth: string }[] }>();
  for (const r of data ?? []) {
    const b = byBooking.get(r.booking_id) ?? { kind: r.kind, name: r.class_name, at: r.start_hhmm, subs: [] };
    b.subs.push({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth });
    byBooking.set(r.booking_id, b);
  }

  let sent = 0, failed = 0, removed = 0;
  for (const [bookingId, b] of byBooking) {
    const title = b.kind === "gym" ? "Gym session in 1 hour" : b.name + " in 1 hour";
    const body = b.kind === "gym" ? "Your gym slot starts at " + b.at + ". See you there!" : "Starts at " + b.at + ". See you there!";
    const payload = JSON.stringify({ title, body, url: "./#bookings", tag: "booking-" + bookingId });
    let delivered = 0;
    for (const s of b.subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3000 });
        delivered++; sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          removed++;
        }
      }
    }
    // mark as handled once at least one phone got it, or when every phone turned out to be gone
    if (delivered > 0 || removed > 0) {
      await db.from("booking_reminders").upsert({ booking_id: bookingId }, { onConflict: "booking_id", ignoreDuplicates: true });
    }
  }
  return json(200, { ok: true, bookings: byBooking.size, sent, failed, removed });
});
