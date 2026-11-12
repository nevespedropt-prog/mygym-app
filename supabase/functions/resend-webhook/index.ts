// MY GYM London: receives delivery feedback from Resend (delivered, bounced, spam complaint, link clicked) and records it on email_events.
// A spam complaint or a permanent bounce also withdraws that address's marketing consent, so it is never sent marketing again.
// Verify JWT is OFF (Resend is not a signed-in person); every request must carry a valid Svix signature made with RESEND_WEBHOOK_SECRET.
// Setup: Resend dashboard, Webhooks, Add endpoint: https://<project>.supabase.co/functions/v1/resend-webhook, events: email.delivered, email.bounced,
// email.complained, email.clicked. Copy its signing secret (starts whsec_) into Supabase Edge Function secrets as RESEND_WEBHOOK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function b64decode(s: string): Uint8Array { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function b64encode(b: ArrayBuffer): string { let s = ""; for (const x of new Uint8Array(b)) s += String.fromCharCode(x); return btoa(s); }
function same(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

async function verified(req: Request, raw: string, secret: string): Promise<boolean> {
  const id = req.headers.get("svix-id") ?? "", ts = req.headers.get("svix-timestamp") ?? "", sigs = req.headers.get("svix-signature") ?? "";
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;   // too old or from the future: refuse (stops replays)
  let key: CryptoKey;
  try { key = await crypto.subtle.importKey("raw", b64decode(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); } catch { return false; }
  const expect = b64encode(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${raw}`)));
  return sigs.split(" ").some((p) => { const [v, s] = p.split(","); return v === "v1" && !!s && same(s, expect); });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false });
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
  if (!secret) return json(500, { ok: false, error: "RESEND_WEBHOOK_SECRET is not set" });
  const raw = await req.text();
  if (!(await verified(req, raw, secret))) return json(401, { ok: false });

  let ev: { type?: string; created_at?: string; data?: { email_id?: string; to?: string[] | string; bounce?: { type?: string } } };
  try { ev = JSON.parse(raw); } catch { return json(400, { ok: false }); }
  const emailId = ev.data?.email_id ?? "";
  const at = ev.created_at && !Number.isNaN(Date.parse(ev.created_at)) ? new Date(ev.created_at).toISOString() : new Date().toISOString();
  if (!emailId) return json(200, { ok: true, ignored: "no email id" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const column: Record<string, string> = { "email.delivered": "delivered_at", "email.bounced": "bounced_at", "email.complained": "complained_at", "email.clicked": "clicked_at" };
  const col = column[ev.type ?? ""];
  if (!col) return json(200, { ok: true, ignored: ev.type ?? "unknown" });

  // keep the first time we heard of it (a person can click many times)
  const { data: rows, error } = await admin.from("email_events").update({ [col]: at }).eq("detail", emailId).is(col, null).select("recipient");
  if (error) { console.error("resend-webhook update failed", error.message); return json(500, { ok: false }); }

  const permanent = ev.type === "email.complained" || (ev.type === "email.bounced" && (ev.data?.bounce?.type ?? "").toLowerCase() === "permanent");
  if (permanent) {
    const to = ev.data?.to;
    const addresses = new Set<string>((Array.isArray(to) ? to : to ? [to] : []).map((a) => String(a).toLowerCase()));
    for (const r of rows ?? []) addresses.add(String(r.recipient).toLowerCase());
    for (const email of addresses) await admin.from("marketing_consent").update({ withdrawn_at: at }).eq("email", email).is("withdrawn_at", null);
  }
  return json(200, { ok: true });
});
