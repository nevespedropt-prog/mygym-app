// MY GYM London: admin button "Class cancelled: tell the members" (see logic.ts for the rules).
// Verify JWT stays ON (a signed-in person is required) and the code then checks that person is an admin. Secret used: CRON_SECRET (to call send-email).
import { createClient } from "npm:@supabase/supabase-js@2";
import { classCancelled, type Deps } from "./logic.ts";

const ALLOWED_ORIGINS = ["https://app.mygymlondon.co.uk", "https://nevespedropt-prog.github.io", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const londonDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (prof?.is_admin !== true) return json(req, 403, { ok: false, error: "Admins only." });

  let body; try { body = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }

  const deps: Deps = {
    today: londonDate(new Date()),
    getClass: async (id) => (await admin.from("classes").select("id, name, day_name, start_time, kind").eq("id", id).maybeSingle()).data ?? null,
    listBookings: async (classId, date) => (await admin.from("class_bookings").select("id, user_id").eq("class_id", classId).eq("date", date)).data ?? [],
    firstName: async (uid) => (((await admin.from("profiles").select("full_name").eq("id", uid).maybeSingle()).data?.full_name as string) ?? "").trim().split(/\s+/)[0] || "there",
    send: async ({ user_id, vars, key }) => {
      try {
        const r = await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" },
          body: JSON.stringify({ template: "class-cancelled-by-gym", user_id, vars, dedupe_key: key }),
          signal: AbortSignal.timeout(8000),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || !out.ok) return "failed";
        return out.skipped ? "skipped" : "sent";
      } catch { return "failed"; }
    },
  };
  try {
    const out = await classCancelled(body, deps);
    return json(req, out.status, out.body);
  } catch (e) {
    console.error("admin-class-cancelled failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong." });
  }
});
