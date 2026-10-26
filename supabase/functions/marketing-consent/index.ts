// MY GYM London: handles the "confirm my email" and "unsubscribe" links in emails. The links open /email.html on the app site, which posts here.
// Public (Verify JWT off). The signed token proves the link came from us (see shared/tokens.mjs). Secret: EMAIL_TOKEN_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkToken } from "./lib.js";

const ALLOWED_ORIGINS = ["https://app.mygymlondon.co.uk", "https://nevespedropt-prog.github.io", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  let b: { a?: string; t?: string };
  try { b = await req.json(); } catch { return json(req, 400, { ok: false }); }
  const action = b.a === "confirm" ? "confirm" : b.a === "unsubscribe" ? "unsubscribe" : null;
  if (!action) return json(req, 400, { ok: false, error: "Unknown link." });
  const email = await checkToken(Deno.env.get("EMAIL_TOKEN_SECRET") ?? "", action, b.t);
  if (!email) return json(req, 400, { ok: false, error: "This link is not valid. Please use the latest email we sent you." });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date().toISOString();
  if (action === "confirm") {
    // only confirms a request that exists and was not withdrawn after it was made
    const { data } = await admin.from("marketing_consent").select("requested_at, confirmed_at, withdrawn_at").eq("email", email).maybeSingle();
    if (!data) return json(req, 404, { ok: false, error: "We could not find your sign-up. Please sign up again." });
    if (!data.confirmed_at || data.withdrawn_at) {
      const { error } = await admin.from("marketing_consent").update({ confirmed_at: now, withdrawn_at: null }).eq("email", email);
      if (error) return json(req, 500, { ok: false, error: "Something went wrong. Please try again." });
    }
    return json(req, 200, { ok: true, action });
  }
  // unsubscribe works even if there is no record yet: keep a withdrawn record so nothing is ever sent
  const { error } = await admin.from("marketing_consent").upsert({ email, source: "unsubscribe-link", wording: "Unsubscribed by link", withdrawn_at: now }, { onConflict: "email" });
  if (error) return json(req, 500, { ok: false, error: "Something went wrong. Please try again." });
  return json(req, 200, { ok: true, action });
});
