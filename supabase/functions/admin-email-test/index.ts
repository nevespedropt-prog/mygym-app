// MY GYM London: "Send me a test" for the automatic emails in the back office Emails page.
//   {"template":"booking-confirmation","vars":{"first_name":"Pedro",...}}  sends that email, with the wording currently saved in email_overrides, to the signed-in admin's OWN address only.
// The email goes through send-email in test mode (subject starts with [TEST], no consent check, nothing recorded as a real send to a member).
// Verify JWT stays ON (a signed-in person is required) and the code then checks that person is an admin. Secret used: CRON_SECRET (to call send-email).
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user?.email) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (prof?.is_admin !== true) return json(req, 403, { ok: false, error: "Admins only." });

  let body: { template?: string; vars?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }
  const template = String(body.template ?? "");
  if (!/^[a-z0-9-]{2,60}$/.test(template) || template === "newsletter" || template === "notice" || template.startsWith("auth-")) return json(req, 400, { ok: false, error: "This email cannot be tested here." });
  const vars: Record<string, string> = {};
  const given = body.vars && typeof body.vars === "object" ? body.vars : {};
  const keys = Object.keys(given).slice(0, 40);
  for (const k of keys) if (/^[a-z][a-z0-9_]{0,40}$/.test(k) && typeof given[k] === "string") vars[k] = (given[k] as string).slice(0, 300);

  try {
    const r = await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-email", {
      method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" },
      body: JSON.stringify({ template, to: u.user.email.toLowerCase(), test: true, vars }), signal: AbortSignal.timeout(15000),
    });
    const out = await r.json().catch(() => ({}));
    if (out.skipped === "switched_off") return json(req, 200, { ok: true, sent_to: null, note: "This email is switched off, so nothing was sent. Switch it on first." });
    if (!r.ok || !out.ok) return json(req, 502, { ok: false, error: out.error === "missing_details" ? "The test could not be built: " + String(out.detail ?? "") : "The test email did not send. Please try again." });
    return json(req, 200, { ok: true, sent_to: u.user.email.toLowerCase() });
  } catch (e) {
    console.error("admin-email-test failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong." });
  }
});
