// MY GYM London: weekly health report by email (counts only, no names, emails or health data).
// Deployed with "Verify JWT" OFF like the other background functions. Source of truth: supabase/functions/weekly-report in the app repo.
//
// Called every Monday by a pg_cron schedule (see migration-weekly-report.sql) with the x-cron-secret header.
// It reads public.weekly_report_stats(), checks that the Wix API key still works, and emails the summary to the gym inbox.
// The recipient is fixed in this file, so nobody can use the function to send mail anywhere else.
// To avoid duplicate mail, it sends at most once per 5 days (row 'weekly-report' in public.sync_log).
//
// Secrets: RESEND_API_KEY, WIX_API_KEY, WIX_SITE_ID, CRON_SECRET (all already set). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatic.
import { createClient } from "npm:@supabase/supabase-js@2";

const FROM = "MY GYM London <info@mygymlondon.co.uk>";
const TO = "info@mygymlondon.co.uk";
const MIN_DAYS_BETWEEN = 5;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Only the schedule may call this function: it sends the shared secret in the x-cron-secret header.
// Enforced only when the CRON_SECRET secret exists. Compared in constant time.
const cronOk = (req: Request): boolean => {
  const want = Deno.env.get("CRON_SECRET") ?? "";
  if (!want) return true;
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
};

type Stats = Record<string, number | boolean | null>;

async function wixOk(): Promise<boolean> {
  try {
    const r = await fetch("https://www.wixapis.com/members/v1/members/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": Deno.env.get("WIX_API_KEY") ?? "",
        "wix-site-id": Deno.env.get("WIX_SITE_ID") ?? "",
      },
      body: JSON.stringify({ query: { paging: { limit: 1 } } }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function buildReport(s: Stats, wix: boolean) {
  const n = (k: string) => Number(s[k] ?? 0);
  const problems: string[] = [];
  if (!wix) problems.push("The Wix connection failed (API key refused or Wix unreachable).");
  if (s.wix_sync_age_min == null || n("wix_sync_age_min") > 30 || s.wix_sync_ok !== true) problems.push("The Wix booking sync has not run successfully in the last 30 minutes.");
  if (s.timetable_age_min == null || n("timetable_age_min") > 180 || s.timetable_ok !== true) problems.push("The timetable sync has not run successfully in the last 3 hours.");
  if (n("emails_7d_failed") > 0) problems.push(n("emails_7d_failed") + " booking email(s) failed this week.");
  if (n("cron_failed_7d") > 0) problems.push(n("cron_failed_7d") + " scheduled job run(s) failed this week.");
  if (n("wix_book_issue_rows") > 0) problems.push("A Wix booking rollback problem was logged (sync_log row wix-book-issue). Check it.");

  const lines = [
    "MY GYM London app: weekly health report",
    "",
    problems.length ? "NEEDS ATTENTION:" : "All checks passed.",
    ...problems.map((p) => "- " + p),
    "",
    "Members: " + n("members") + " (" + n("new_members_7d") + " new this week), " + n("gym_members") + " with gym access, " + n("admins") + " admin(s)",
    "Bookings this week: " + n("bookings_7d_app") + " made in the app, " + n("bookings_7d_wix") + " synced from the website",
    "Upcoming bookings: " + n("upcoming_bookings") + " by app members, " + n("upcoming_other_wix") + " by other website customers",
    "Booking emails this week: " + n("emails_7d_sent") + " sent, " + n("emails_7d_failed") + " failed",
    "Wix connection: " + (wix ? "OK" : "FAILED"),
    "Last Wix booking sync: " + (s.wix_sync_age_min == null ? "never" : n("wix_sync_age_min") + " min ago") + " | last timetable sync: " + (s.timetable_age_min == null ? "never" : n("timetable_age_min") + " min ago"),
    "Scheduled job runs this week: " + n("cron_runs_7d") + " (" + n("cron_failed_7d") + " failed)",
    "Database size: " + n("database_mb") + " MB",
    "",
    "Reminder: the free Supabase plan has no automatic backups. If you want a copy of the data, export it from the Supabase dashboard.",
    "This report contains counts only: no names, emails or health data.",
  ];
  return { subject: (problems.length ? "[ATTENTION] " : "") + "MY GYM app weekly report", text: lines.join("\n"), attention: problems.length > 0 };
}

Deno.serve(async (req) => {
  if (!cronOk(req)) return json(401, { error: "Not allowed" });
  const key = (Deno.env.get("RESEND_API_KEY") ?? "").replace(/["'\s]/g, "");
  if (!key) return json(500, { ok: false, error: "RESEND_API_KEY secret is not set" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: prev } = await db.from("sync_log").select("last_run").eq("id", "weekly-report").maybeSingle();
  if (prev?.last_run && Date.now() - new Date(prev.last_run).getTime() < MIN_DAYS_BETWEEN * 86400 * 1000) {
    return json(200, { ok: true, skipped: "already sent recently" });
  }

  const { data: stats, error } = await db.rpc("weekly_report_stats");
  if (error || !stats) return json(500, { ok: false, error: "could not read the numbers" });

  const mail = buildReport(stats as Stats, await wixOk());
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [TO], subject: mail.subject, text: mail.text }),
    });
    if (!r.ok) throw new Error("Resend error " + r.status);
    const now = new Date().toISOString();
    await db.from("sync_log").upsert({ id: "weekly-report", last_call: now, last_run: now, last_result: { ok: true, attention: mail.attention } });
    return json(200, { ok: true, attention: mail.attention });
  } catch (_e) {
    return json(502, { ok: false, error: "email not sent" });
  }
});
