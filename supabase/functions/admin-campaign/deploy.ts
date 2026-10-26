import { createClient } from "npm:@supabase/supabase-js@2";
// ---- logic ----
// MY GYM London: send a marketing email ("campaign") to everyone who confirmed they want news and offers. Admin only (checked in index.ts).
// Safety: only people with confirmed, not-withdrawn consent are ever emailed (send-email checks this again); each person gets a campaign once
// (key campaign:<id>:<email>), so pressing Send twice or retrying after an error never doubles up; a test goes only to the admin's own address.
// Large lists are sent in batches: the page keeps calling "send" until nothing remains. No network in here: everything is passed in.
interface Person { email: string; user_id: string | null }
interface Deps {
  audience(): Promise<Person[]>;
  alreadySent(campaignId: string): Promise<Set<string>>;          // emails this campaign already reached
  firstName(p: Person): Promise<string>;
  adminEmail: string;
  send(m: { to: string; user_id: string | null; vars: Record<string, string>; key: string; test: boolean }): Promise<"sent" | "skipped" | "failed">;
  pause(ms: number): Promise<void>;
}
interface Input { action?: string; campaign_id?: unknown; subject?: unknown; preheader?: unknown; title?: unknown; body?: unknown; button?: unknown; url?: unknown }
interface Out { status: number; body: Record<string, unknown> }
const BATCH = 40;

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

function checkContent(i: Input): { ok: true; vars: Record<string, string> } | { ok: false; error: string } {
  const subject = clean(i.subject, 200), preheader = clean(i.preheader, 200), title = clean(i.title, 200), body = clean(i.body, 4000), button = clean(i.button, 60), url = clean(i.url, 500);
  if (!subject) return { ok: false, error: "Add a subject line." };
  if (subject.length > 78) return { ok: false, error: "Make the subject 78 characters or fewer." };
  if (title.length < 2) return { ok: false, error: "Add a heading." };
  if (title.length > 60) return { ok: false, error: "Make the heading 60 characters or fewer." };
  if (body.length < 10) return { ok: false, error: "Write the message (at least a sentence)." };
  if (!button) return { ok: false, error: "Add the button text." };
  if (!/^https:\/\/[^\s]+$/.test(url)) return { ok: false, error: "The button link must start with https://" };
  return { ok: true, vars: { campaign_subject: subject, campaign_preheader: preheader || subject, campaign_title: title, campaign_body: body, campaign_button: button, campaign_url: url } };
}

async function campaign(i: Input, d: Deps): Promise<Out> {
  const action = ["audience", "test", "send"].includes(String(i.action)) ? String(i.action) : null;
  if (!action) return { status: 400, body: { ok: false, error: "Unknown action." } };

  if (action === "audience") return { status: 200, body: { ok: true, count: (await d.audience()).length } };

  const c = checkContent(i);
  if (!c.ok) return { status: 422, body: { ok: false, error: c.error } };

  if (action === "test") {
    const r = await d.send({ to: d.adminEmail, user_id: null, vars: { ...c.vars, first_name: "there" }, key: "campaign-test", test: true });
    return r === "failed" ? { status: 502, body: { ok: false, error: "The test email did not send. Please try again." } } : { status: 200, body: { ok: true, sent_to: d.adminEmail } };
  }

  const id = String(i.campaign_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { status: 400, body: { ok: false, error: "Missing campaign id. Reload the page." } };
  const all = await d.audience();
  const done = await d.alreadySent(id);
  const todo = all.filter((p) => !done.has(p.email));
  const batch = todo.slice(0, BATCH);
  let sent = 0, skipped = 0, failed = 0;
  for (const p of batch) {
    const r = await d.send({ to: p.email, user_id: p.user_id, vars: { ...c.vars, first_name: await d.firstName(p) }, key: `campaign:${id}:${p.email}`, test: false });
    if (r === "sent") sent++; else if (r === "skipped") skipped++; else failed++;
    await d.pause(600);
  }
  return { status: 200, body: { ok: true, audience: all.length, already_sent: done.size, sent, skipped, failed, remaining: Math.max(0, todo.length - sent - skipped) } };
}

// ---- function ----
// MY GYM London: admin "Send a campaign" (see logic.ts). Verify JWT stays ON; the code then checks the signed-in person is an admin.
// Uses: CRON_SECRET (to call send-email). Only people with confirmed marketing consent are ever emailed.



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
