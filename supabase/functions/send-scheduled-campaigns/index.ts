// MY GYM London: sends marketing campaigns, one batch at a time. Two callers, both holding the shared secret (x-cron-secret):
//   * the database schedule (every minute): starts campaigns whose send time has come and carries on any that stalled
//   * admin-campaign ("Send now" in the back office): {"campaign_id": "..."} sends the next batch of that campaign and reports what is left
// Safety: only people with confirmed, not withdrawn consent are in the audience (database function _campaign_audience; send-email checks again).
// Each person gets a campaign once (dedupe key campaign:<id>:<email>), so retries and overlapping runs never double up.
// Verify JWT is OFF (the schedule is not a signed-in person); the shared secret is the lock. Secrets: CRON_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";

const BATCH = 40;
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const cronOk = (req: Request): boolean => {
  const want = Deno.env.get("CRON_SECRET") ?? "";
  if (!want) return false;   // this function can email many people, so it refuses to run without the secret
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
};

interface Campaign { id: string; subject: string; preheader: string; title: string; body: string; button: string; url: string; segment: string; status: string; scheduled_for: string | null; started_at: string | null; audience: number | null; sent: number; failed: number; skipped: number }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false });
  if (!cronOk(req)) return json(401, { ok: false });
  let input: { campaign_id?: string } = {};
  try { input = await req.json(); } catch { /* an empty body is fine for the schedule */ }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const base = Deno.env.get("SUPABASE_URL")! + "/functions/v1";
  const cron = Deno.env.get("CRON_SECRET") ?? "";

  // which campaigns to work on
  let ids: string[] = [];
  const direct = typeof input.campaign_id === "string" && /^[0-9a-f-]{36}$/i.test(input.campaign_id) ? input.campaign_id : null;
  if (direct) ids = [direct];
  else {
    // claim campaigns that are due (the update is the lock: a second run finds nothing left to claim)
    const { data: due } = await admin.from("marketing_campaigns").update({ status: "sending", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("status", "scheduled").lte("scheduled_for", new Date().toISOString()).select("id");
    ids = (due ?? []).map((r) => r.id as string);
    // pick up one that was sending but has not moved for 3 minutes (for example the page was closed halfway)
    const { data: stalled } = await admin.from("marketing_campaigns").select("id").eq("status", "sending").lt("updated_at", new Date(Date.now() - 3 * 60_000).toISOString()).limit(2);
    for (const r of stalled ?? []) if (!ids.includes(r.id as string)) ids.push(r.id as string);
  }
  if (!ids.length) return json(200, { ok: true, campaigns: 0 });

  const results: Record<string, unknown>[] = [];
  for (const id of ids) {
    const { data: c } = await admin.from("marketing_campaigns").select("*").eq("id", id).maybeSingle();
    if (!c || (c as Campaign).status !== "sending") { results.push({ id, skipped: "not sending" }); continue; }
    results.push(await runBatches(admin, base, cron, c as Campaign, direct ? 1 : 3));
  }
  // for a direct call there is exactly one campaign: hand its numbers straight back
  return json(200, direct ? { ok: true, ...results[0] } : { ok: true, campaigns: ids.length, results });
});

async function runBatches(admin: ReturnType<typeof createClient>, base: string, cron: string, c: Campaign, maxBatches: number) {
  let sentNow = 0, failedNow = 0, skippedNow = 0, remaining = 0, audienceN = c.audience ?? 0, doneN = 0;
  for (let n = 0; n < maxBatches; n++) {
    const { data: aud, error: ae } = await admin.rpc("_campaign_audience", { p_segment: c.segment });
    if (ae) return { id: c.id, ok: false, error: "audience_failed" };
    const all = (aud ?? []) as { email: string; user_id: string | null }[];
    const { data: ev } = await admin.from("email_events").select("recipient").like("dedupe_key", `campaign:${c.id}:%`).eq("status", "sent").limit(20000);
    const done = new Set((ev ?? []).map((r) => r.recipient as string));
    const todo = all.filter((p) => !done.has(p.email));
    const batch = todo.slice(0, BATCH);
    let sent = 0, failed = 0, skipped = 0;
    for (const p of batch) {
      let first = "there";
      if (p.user_id) {
        const { data: pr } = await admin.from("profiles").select("full_name").eq("id", p.user_id).maybeSingle();
        first = ((pr?.full_name as string) ?? "").trim().split(/\s+/)[0] || "there";
      }
      try {
        const r = await fetch(base + "/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cron-secret": cron },
          body: JSON.stringify({
            template: "newsletter", to: p.email, user_id: p.user_id ?? undefined, dedupe_key: `campaign:${c.id}:${p.email}`,
            vars: { campaign_subject: c.subject, campaign_preheader: c.preheader || c.subject, campaign_title: c.title, campaign_body: c.body, campaign_button: c.button, campaign_url: c.url, first_name: first },
          }),
          signal: AbortSignal.timeout(8000),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || !out.ok) failed++; else if (out.skipped) skipped++; else sent++;
      } catch { failed++; }
      await new Promise((res) => setTimeout(res, 600));
    }
    sentNow += sent; failedNow += failed; skippedNow += skipped;
    audienceN = all.length; doneN = done.size + sent;
    remaining = Math.max(0, todo.length - batch.length);
    const finished = remaining === 0;
    const skippedTotal = c.skipped + skippedNow;
    await admin.from("marketing_campaigns").update({
      audience: audienceN, sent: doneN, skipped: skippedTotal,
      failed: finished ? Math.max(0, audienceN - doneN - skippedTotal) : 0,
      status: finished ? "sent" : "sending", finished_at: finished ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }).eq("id", c.id);
    if (finished) break;
  }
  return { id: c.id, audience: audienceN, sent: sentNow, failed: failedNow, skipped: skippedNow, remaining, total_sent: doneN };
}
