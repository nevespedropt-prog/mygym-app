// MY GYM London: member-only signup.
// Creates a Supabase account only if the email belongs to an APPROVED member of the MyGymLondon Wix site.
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

async function isWixMember(email: string): Promise<boolean> {
  const res = await fetch("https://www.wixapis.com/members/v1/members/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": Deno.env.get("WIX_API_KEY")!,
      "wix-site-id": Deno.env.get("WIX_SITE_ID")!,
    },
    body: JSON.stringify({
      fieldsets: ["EXTENDED"],
      query: { filter: { loginEmail: { $eq: email } }, paging: { limit: 1 } },
    }),
  });
  if (!res.ok) throw new Error("wix_" + res.status);
  const data = await res.json();
  return (data.members ?? []).some((m: { status?: string }) => m.status === "APPROVED");
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
  if (password.length < 6) return json(req, 400, { error: "Password must be at least 6 characters." });

  let member: boolean;
  try {
    member = await isWixMember(email);
  } catch (_e) {
    return json(req, 503, { error: "We can't check membership right now. Please try again in a few minutes." });
  }
  if (!member) {
    return json(req, 403, {
      code: "NOT_MEMBER",
      error: "This email isn't a MY GYM website member yet. Join on mygymlondon.co.uk first, using the same email, then come back.",
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
