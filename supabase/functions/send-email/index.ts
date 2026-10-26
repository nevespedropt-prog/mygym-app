// MY GYM London: sends one email from the library (see logic.ts for the rules). Only the database triggers, schedules and our other functions may call it:
// they send the shared secret in the x-cron-secret header (CRON_SECRET). Verify JWT is OFF. Secrets: RESEND_API_KEY, EMAIL_TOKEN_SECRET, CRON_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { makeToken, GLOBALS } from "./lib.js";
import { sendEmail, type Deps } from "./logic.ts";

const FROM = "MY GYM London <info@mygymlondon.co.uk>";
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Enforced only when CRON_SECRET exists, same as the other background functions.
const cronOk = (req: Request): boolean => {
  const want = Deno.env.get("CRON_SECRET") ?? "";
  if (!want) return false;   // this function can send email to anyone, so unlike the others it refuses to run without the secret
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false });
  if (!cronOk(req)) return json(401, { ok: false });
  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "bad_json" }); }

  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").replace(/["'\s]/g, "");
  const secret = Deno.env.get("EMAIL_TOKEN_SECRET") ?? "";
  if (!resendKey) return json(500, { ok: false, error: "RESEND_API_KEY not set" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const deps: Deps = {
    getUserEmail: async (id) => (await admin.auth.admin.getUserById(id)).data?.user?.email ?? null,
    hasConsent: async (email) => {
      const { data } = await admin.from("marketing_consent").select("confirmed_at, withdrawn_at").eq("email", email).maybeSingle();
      return !!data?.confirmed_at && !data?.withdrawn_at;
    },
    templateEnabled: async (t) => {
      const { data } = await admin.from("email_overrides").select("enabled").eq("template_id", t).maybeSingle();
      return data?.enabled !== false;
    },
    claim: async (key, template, to) => {
      const { error } = await admin.from("email_events").insert({ dedupe_key: key, template, recipient: to, status: "sending" });
      if (!error) return true;
      if (error.code === "23505") {
        // seen before: retry only if the last try failed
        const { data } = await admin.from("email_events").update({ status: "sending", updated_at: new Date().toISOString() }).eq("dedupe_key", key).eq("status", "failed").select("dedupe_key");
        return (data?.length ?? 0) > 0;
      }
      throw new Error("log_failed");
    },
    finish: async (key, status, detail) => { await admin.from("email_events").update({ status, detail, updated_at: new Date().toISOString() }).eq("dedupe_key", key); },
    unsubscribeUrl: async (email) => `${GLOBALS.app_url}email.html?a=unsubscribe&t=${await makeToken(secret, "unsubscribe", email)}`,
    deliver: async (m) => {
      const headers: Record<string, string> = {};
      if (m.marketing && m.unsubscribeUrl) { headers["List-Unsubscribe"] = `<${m.unsubscribeUrl}>`; }
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [m.to], reply_to: m.replyTo ?? "info@mygymlondon.co.uk", subject: m.subject, text: m.text, html: m.html, headers }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((out as { message?: string }).message ?? "Resend error " + r.status);
      return String((out as { id?: string }).id ?? "");
    },
  };
  try {
    const out = await sendEmail(body, deps);
    return json(out.status, out.body);
  } catch (e) {
    console.error("send-email failed", String((e as Error)?.message ?? e));
    return json(500, { ok: false, error: "failed" });
  }
});
