// MY GYM London: admin "Send a campaign" (see logic.ts). Verify JWT stays ON; the code then checks the signed-in person is an admin.
// Uses: CRON_SECRET (to call send-email). Only people with confirmed marketing consent are ever emailed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { campaign, type Deps, type Person } from "./logic.ts";

const ALLOWED_ORIGINS = ["https://app.mygymlondon.co.uk", "https://nevespedropt-prog.github.io", "http://localhost:8137"];
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

  let body; try { body = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }

  const deps: Deps = {
    adminEmail: u.user.email.toLowerCase(),
    audience: async () => {
      const { data } = await admin.from("marketing_consent").select("email, user_id").not("confirmed_at", "is", null).is("withdrawn_at", null).order("email").limit(5000);
      return (data ?? []) as Person[];
    },
    alreadySent: async (id) => {
      const { data } = await admin.from("email_events").select("recipient").like("dedupe_key", `campaign:${id}:%`).eq("status", "sent").limit(10000);
      return new Set((data ?? []).map((r) => r.recipient as string));
    },
    firstName: async (p) => {
      if (!p.user_id) return "there";
      const { data } = await admin.from("profiles").select("full_name").eq("id", p.user_id).maybeSingle();
      return ((data?.full_name as string) ?? "").trim().split(/\s+/)[0] || "there";
    },
    send: async ({ to, user_id, vars, key, test }) => {
      try {
        const r = await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" },
          body: JSON.stringify({ template: "newsletter", to, user_id: user_id ?? undefined, vars, dedupe_key: key, test }),
          signal: AbortSignal.timeout(8000),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || !out.ok) return "failed";
        return out.skipped ? "skipped" : "sent";
      } catch { return "failed"; }
    },
    pause: (ms) => new Promise((res) => setTimeout(res, ms)),
  };
  try {
    const out = await campaign(body, deps);
    return json(req, out.status, out.body);
  } catch (e) {
    console.error("admin-campaign failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong." });
  }
});
