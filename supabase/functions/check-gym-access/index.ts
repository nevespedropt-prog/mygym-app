// MY GYM London: does this member have a Gym & Exercise Class plan?
// Called by the app after login (and when the gym booking tab is opened).
// It asks Wix Pricing Plans whether the signed-in member has an ACTIVE order on one of the plans listed in
// public.gym_access_plans, then stores the answer in public.member_access. Only this function can write that table,
// and the booking rules (enforce_booking_rules) read it, so the check can't be skipped from the browser.
//
// Secrets (set in Supabase, never in the repo): WIX_API_KEY, WIX_SITE_ID  (same as member-signup).
// The Wix API key also needs the permission "Read Orders" for Pricing Plans (SCOPE.DC-PAIDPLANS.READ-ORDERS).
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

async function wixMemberId(email: string): Promise<string | null> {
  const res = await fetch("https://www.wixapis.com/members/v1/members/query", {
    method: "POST",
    headers: wixHeaders(),
    body: JSON.stringify({ query: { filter: { loginEmail: { $eq: email } }, paging: { limit: 1 } } }),
  });
  if (!res.ok) throw new Error("wix_members_" + res.status);
  const data = await res.json();
  const m = (data.members ?? []).find((x: { status?: string }) => x.status === "APPROVED");
  return m?.id ?? null;
}

async function hasActiveGymOrder(memberId: string, planIds: string[]): Promise<boolean> {
  if (!planIds.length) return false;
  const q = new URLSearchParams();
  q.set("limit", "50");
  q.set("fieldSet", "BASIC");
  q.append("orderStatuses", "ACTIVE");
  q.append("buyerIds", memberId);
  planIds.forEach((id) => q.append("planIds", id));
  const res = await fetch("https://www.wixapis.com/pricing-plans/v2/orders?" + q.toString(), { headers: wixHeaders() });
  if (!res.ok) throw new Error("wix_orders_" + res.status);
  const data = await res.json();
  // the query already limits results to ACTIVE orders on the gym plans for this buyer
  return (data.orders ?? []).length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, 401, { error: "Not signed in" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u, error: uerr } = await admin.auth.getUser(token);
  const user = u?.user;
  if (uerr || !user?.email) return json(req, 401, { error: "Not signed in" });
  const email = user.email.toLowerCase();

  // protect the Wix API: reuse the stored answer if it is under a minute old
  const { data: prev } = await admin.from("member_access").select("gym_access, checked_at").eq("user_id", user.id).maybeSingle();
  if (prev && Date.now() - new Date(prev.checked_at).getTime() < 60_000) {
    return json(req, 200, { gym_access: prev.gym_access, cached: true });
  }

  try {
    const { data: plans } = await admin.from("gym_access_plans").select("plan_id");
    const planIds = (plans ?? []).map((p: { plan_id: string }) => p.plan_id);
    const memberId = await wixMemberId(email);
    const gym = memberId ? await hasActiveGymOrder(memberId, planIds) : false;
    await admin.from("member_access").upsert({ user_id: user.id, gym_access: gym, checked_at: new Date().toISOString() });
    return json(req, 200, { gym_access: gym });
  } catch (_e) {
    // fail closed: keep the previous answer untouched; it stops counting after 24 hours
    return json(req, 503, { error: "We can't check your membership right now. Please try again in a few minutes." });
  }
});
