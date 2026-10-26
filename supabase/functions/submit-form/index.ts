// MY GYM London: receives every website and app form, stores it, records marketing consent and sends the emails.
// Public (Verify JWT off) because website visitors are not signed in; the checks are in logic.ts. Signed-in app forms send the member's token.
// Secrets: RESEND_API_KEY, EMAIL_TOKEN_SECRET (any long random text, 32+ characters). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatic.
import { createClient } from "npm:@supabase/supabase-js@2";
import { render } from "./lib.js";
import { processSubmission, type Deps } from "./logic.ts";

const ALLOWED_ORIGINS = [
  "https://app.mygymlondon.co.uk",
  "https://www.mygymlondon.co.uk",
  "https://mygymlondon.co.uk",
  "https://nevespedropt-prog.github.io",
  "http://localhost:8137",
];
const FROM = "MY GYM London <info@mygymlondon.co.uk>";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false, error: "Method not allowed" });
  // browsers only: a cross-site page that is not ours cannot read the answer, and we do not store its submissions
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json(req, 403, { ok: false, error: "Not allowed" });

  const secret = Deno.env.get("EMAIL_TOKEN_SECRET") ?? "";
  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").replace(/["'\s]/g, "");
  if (secret.length < 32) return json(req, 500, { ok: false, error: "EMAIL_TOKEN_SECRET is not set" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const ipHash = await sha256(ip + ":" + secret);

  let user: { id: string; email: string } | null = null;
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);   // fails for the public key, which is fine: that means "not signed in"
    if (data?.user?.email) user = { id: data.user.id, email: data.user.email.toLowerCase() };
  }

  const deps: Deps = {
    now: new Date(),
    countByIp: async (formId, h, since) => (await admin.from("form_submissions").select("id", { count: "exact", head: true }).eq("form_id", formId).eq("ip_hash", h).gte("created_at", since)).count ?? 0,
    countByUser: async (formId, uid, since) => (await admin.from("form_submissions").select("id", { count: "exact", head: true }).eq("form_id", formId).eq("user_id", uid).gte("created_at", since)).count ?? 0,
    insertSubmission: async (row) => {
      const { data, error } = await admin.from("form_submissions").insert(row).select("id").single();
      if (error) throw new Error("store_failed");
      return data.id as string;
    },
    upsertConsent: async (row) => { const { error } = await admin.from("marketing_consent").upsert(row, { onConflict: "email" }); if (error) throw new Error("consent_failed"); },
    getConsent: async (email) => (await admin.from("marketing_consent").select("confirmed_at, withdrawn_at").eq("email", email).maybeSingle()).data ?? null,
    profileName: async (uid) => ((await admin.from("profiles").select("full_name").eq("id", uid).maybeSingle()).data?.full_name as string) ?? "",
    token: async (purpose, email) => (await import("./lib.js")).makeToken(secret, purpose, email),
    send: async ({ template, to, vars, replyTo }) => {
      if (!resendKey) throw new Error("RESEND_API_KEY not set");
      const mail = render(template, vars);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [to], reply_to: replyTo ?? "info@mygymlondon.co.uk", subject: mail.subject, text: mail.text, html: mail.html }),
      });
      if (!r.ok) throw new Error("resend_" + r.status);
    },
  };

  try {
    const result = await processSubmission(body as never, { ipHash, user, functionsUrl: `${url}/functions/v1` }, deps);
    return json(req, result.status, result.body);
  } catch (e) {
    console.error("submit-form failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong. Please try again or email info@mygymlondon.co.uk." });
  }
});
