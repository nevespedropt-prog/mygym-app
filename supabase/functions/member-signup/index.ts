// MY GYM London: member-only signup.
// Creates a Supabase account only if the email belongs to an APPROVED Wix member WITH an active pricing plan.
// PAYG customers and lapsed members are rejected — they must get a membership on mygymlondon.co.uk first.
// Secrets (set in Supabase, never in the repo): WIX_API_KEY, WIX_SITE_ID.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://app.mygymlondon.co.uk",
  "https://nevespedropt-prog.github.io",
  "http://localhost:8137",
];

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

const wixHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": Deno.env.get("WIX_API_KEY")!,
  "wix-site-id": Deno.env.get("WIX_SITE_ID")!,
});

async function getWixMember(email: string): Promise<{ approved: boolean; id: string | null }> {
  const res = await fetch("https://www.wixapis.com/members/v1/members/query", {
    method: "POST",
    headers: wixHeaders(),
    body: JSON.stringify({
      fieldsets: ["EXTENDED"],
      query: { filter: { loginEmail: { $eq: email } }, paging: { limit: 1 } },
    }),
  });
  if (!res.ok) throw new Error("wix_" + res.status);
  const data = await res.json();
  const m = (data.members ?? []).find((x: { status?: string }) => x.status === "APPROVED");
  return { approved: !!m, id: m?.id ?? null };
}

async function hasActivePlan(memberId: string): Promise<boolean> {
  const q = new URLSearchParams();
  q.set("limit", "1");
  q.set("fieldSet", "BASIC");
  q.append("orderStatuses", "ACTIVE");
  q.append("buyerIds", memberId);
  const res = await fetch("https://www.wixapis.com/pricing-plans/v2/orders?" + q.toString(), {
    headers: wixHeaders(),
  });
  if (!res.ok) throw new Error("wix_plans_" + res.status);
  const data = await res.json();
  return (data.orders ?? []).length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  let body: { email?: string; password?: string; name?: string };
  try { body = await req.json(); } catch { return json(req, 400, { error: "Bad request" }); }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim().slice(0, 100);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(req, 400, { error: "Enter a valid email." });
  if (password.length < 8) return json(req, 400, { error: "Password must be at least 8 characters." });

  // rate limit: 10 attempts / IP and 5 / email per 15 minutes (stops membership guessing and Wix API abuse)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  const emailHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [byIp, byEmail] = await Promise.all([
    admin.from("signup_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).gte("at", since),
    admin.from("signup_attempts").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("at", since),
  ]);
  if ((byIp.count ?? 0) >= 10 || (byEmail.count ?? 0) >= 5) {
    return json(req, 429, { error: "Too many attempts. Please wait 15 minutes and try again." });
  }
  await admin.from("signup_attempts").insert({ ip, email_hash: emailHash });
  await admin.from("signup_attempts").delete().lt("at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

  let wixMember: { approved: boolean; id: string | null };
  try {
    wixMember = await getWixMember(email);
  } catch (_e) {
    return json(req, 503, { error: "We can't check membership right now. Please try again in a few minutes." });
  }
  if (!wixMember.approved) {
    return json(req, 403, {
      code: "NOT_MEMBER",
      error: "This email isn't a MY GYM website member yet. Join on mygymlondon.co.uk first, using the same email, then come back.",
    });
  }

  let activePlan: boolean;
  try {
    activePlan = wixMember.id ? await hasActivePlan(wixMember.id) : false;
  } catch (_e) {
    return json(req, 503, { error: "We can't check membership right now. Please try again in a few minutes." });
  }
  if (!activePlan) {
    return json(req, 403, {
      code: "NO_ACTIVE_PLAN",
      error: "The app is for MY GYM members only. Your account doesn't have an active membership plan — visit mygymlondon.co.uk to get one, then come back.",
    });
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return json(req, 409, { error: "An account with this email already exists. Log in instead." });
    }
    return json(req, 500, { error: "Could not create the account. Please try again." });
  }
  return json(req, 200, { ok: true });
});
