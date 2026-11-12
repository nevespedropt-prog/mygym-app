// MY GYM London: back office campaign actions (the wording and audience live in the marketing_campaigns table; see migration-marketing-campaigns.sql).
//   {"action":"test", "campaign_id"}  sends the saved campaign to the signed-in admin's own address only
//   {"action":"send", "campaign_id"}  starts or carries on sending to the campaign's segment (the page repeats this until nothing remains)
// Verify JWT stays ON (a signed-in person is required) and the code then checks that person is an admin. Secret used: CRON_SECRET (to call send-email and send-scheduled-campaigns).
// Content is always read from the saved campaign, never trusted from the page, so what was tested is what is sent.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

interface Campaign { id: string; subject: string; preheader: string; title: string; body: string; button: string; url: string; segment: string; status: string }

function problem(c: Campaign): string {
  if (!c.subject) return "Add a subject line.";
  if (c.subject.length > 78) return "Make the subject 78 characters or fewer.";
  if (c.title.length < 2) return "Add a heading.";
  if (c.title.length > 60) return "Make the heading 60 characters or fewer.";
  if (c.body.length < 10) return "Write the message (at least a sentence).";
  if (!c.button) return "Add the button text.";
  if (!/^https:\/\/[^\s]+$/.test(c.url)) return "The button link must start with https://";
  if (/\[[^\]]{2,}\]/.test(c.subject + c.preheader + c.title + c.body + c.button)) return "There is still [placeholder] text to fill in.";
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user?.email) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (prof?.is_admin !== true) return json(req, 403, { ok: false, error: "Admins only." });

  let body: { action?: string; campaign_id?: string };
  try { body = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }
  const action = body.action === "test" || body.action === "send" ? body.action : null;
  if (!action) return json(req, 400, { ok: false, error: "Unknown action." });
  const id = String(body.campaign_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(req, 400, { ok: false, error: "Save the campaign first." });

  const { data: row } = await admin.from("marketing_campaigns").select("*").eq("id", id).maybeSingle();
  if (!row) return json(req, 404, { ok: false, error: "Campaign not found. Reload the page." });
  const c = row as Campaign & { failed: number };
  const bad = problem(c);
  if (bad) return json(req, 422, { ok: false, error: bad });
  const cron = Deno.env.get("CRON_SECRET") ?? "";
  const base = Deno.env.get("SUPABASE_URL")! + "/functions/v1";

  try {
    if (action === "test") {
      const r = await fetch(base + "/send-email", {
        method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": cron },
        body: JSON.stringify({ template: "newsletter", to: u.user.email.toLowerCase(), test: true, vars: { campaign_subject: c.subject, campaign_preheader: c.preheader || c.subject, campaign_title: c.title, campaign_body: c.body, campaign_button: c.button, campaign_url: c.url, first_name: "there" } }),
        signal: AbortSignal.timeout(15000),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || !out.ok) return json(req, 502, { ok: false, error: "The test email did not send. Please try again." });
      return json(req, 200, { ok: true, sent_to: u.user.email.toLowerCase() });
    }

    // send: a draft or scheduled campaign starts now; one that finished with failures can be retried; one that is already sending carries on
    if (c.status === "sent" && !(c.failed > 0)) return json(req, 409, { ok: false, error: "This campaign was already sent to everyone." });
    if (c.status !== "sending") {
      const patch = { status: "sending", finished_at: null, updated_at: new Date().toISOString(), ...(c.status === "sent" ? {} : { started_at: new Date().toISOString(), scheduled_for: null, sent: 0, failed: 0, skipped: 0 }) };
      const { error } = await admin.from("marketing_campaigns").update(patch).eq("id", id).in("status", ["draft", "scheduled", "sent"]);
      if (error) return json(req, 500, { ok: false, error: "Could not start the send." });
      await admin.from("staff_access_log").insert({ user_id: u.user.id, action: "campaign_send_now", target: id });
    }
    const r = await fetch(base + "/send-scheduled-campaigns", {
      method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": cron }, body: JSON.stringify({ campaign_id: id }), signal: AbortSignal.timeout(120000),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.ok) return json(req, 502, { ok: false, error: "The send was interrupted. Press Send again to carry on where it stopped. Nobody gets it twice." });
    return json(req, 200, { ok: true, audience: out.audience, sent: out.sent, failed: out.failed, skipped: out.skipped, remaining: out.remaining, total_sent: out.total_sent });
  } catch (e) {
    console.error("admin-campaign failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong." });
  }
});
