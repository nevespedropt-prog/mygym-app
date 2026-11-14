// MY GYM London: back office "Add member" (admin and manager only). Does what a person does when they join online, on their behalf, in the gym.
//   {"action":"plans"}  -> the plans you sell in Wix
//   {"action":"create", ...}  -> Wix contact + site member, the plan (recorded as paid in person, or a secure checkout link for card), optional app login + welcome invite,
//        health form, agreements and the news-and-offers choice (each recorded as taken in person by the signed-in staff member), then a copy in the back office.
// Card numbers are NEVER handled here: card payments go through Wix checkout. Each step reports its own result, so a Wix problem never loses the rest.
// Clients with no email are kept in the back office only (Wix needs an email to make someone a member).
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const HEALTH_VERSION = "2026-10-v1";
const CHECKOUT = "https://join.mygymlondon.co.uk";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const typeOf = (n: string) => /personal training/i.test(n) ? "pt" : /gym/i.test(n) ? "gym_classes" : /class/i.test(n) ? "classes" : "other";

async function wix(method: string, path: string, body?: unknown) {
  const r = await fetch("https://www.wixapis.com" + path, { method, signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/json", Authorization: Deno.env.get("WIX_API_KEY")!, "wix-site-id": Deno.env.get("WIX_SITE_ID")! }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data: any = null; try { data = await r.json(); } catch (_e) { /* empty */ }
  return { ok: r.ok, status: r.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: prof } = await db.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  const { data: st } = await db.from("staff").select("role").eq("user_id", u.user.id).maybeSingle();
  if (prof?.is_admin !== true && !(st && ["admin", "manager"].includes(st.role))) return json(req, 403, { ok: false, error: "Only an owner or manager can add members." });
  let b: any; try { b = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }

  if (b.action === "plans") {
    const r = await wix("GET", "/pricing-plans/v2/plans?limit=50");
    if (!r.ok) return json(req, 502, { ok: false, error: "Could not read the plans from Wix." });
    // deno-lint-ignore no-explicit-any
    const plans = (r.data?.plans ?? []).filter((p: any) => !p.archived && p.visible !== false).map((p: any) => ({ id: p.id, name: String(p.name ?? ""), unit: p.pricing?.subscription?.cycleDuration?.unit ?? "", amount: Number(p.pricing?.prices?.[0]?.price?.total ?? p.pricing?.prices?.[0]?.price?.value ?? 0) || null }));
    return json(req, 200, { ok: true, plans });
  }
  if (b.action !== "create") return json(req, 400, { ok: false, error: "Unknown action." });

  // ---- check what was sent
  const first = String(b.first ?? "").trim().slice(0, 60), last = String(b.last ?? "").trim().slice(0, 60), email = String(b.email ?? "").trim().toLowerCase(), phone = String(b.phone ?? "").trim().slice(0, 30);
  if (first.length < 1) return json(req, 422, { ok: false, error: "Add their first name." });
  if (!email && !phone) return json(req, 422, { ok: false, error: "Add an email or a phone number." });
  if (email && !EMAIL.test(email)) return json(req, 422, { ok: false, error: "That email does not look right." });
  const c = b.consents ?? {};
  if (!c.terms || !c.privacy) return json(req, 422, { ok: false, error: "The terms and the privacy notice must be accepted." });
  const h = b.health;
  if (!h || !h.consent_health || !h.consent_truthful) return json(req, 422, { ok: false, error: "Complete the health form and its two confirmations first." });
  const answers = h.answers ?? {}; const anyTick = Object.keys(answers).some((k) => k !== "none" && answers[k]);
  if (!anyTick && !answers.none) return json(req, 422, { ok: false, error: "On the health form, tick what applies or 'None of these apply'." });
  if (!h.no_allergies && !String(h.allergies ?? "").trim()) return json(req, 422, { ok: false, error: "On the health form, tick 'no allergies' or write the allergy." });
  const full = [first, last].filter(Boolean).join(" "), today = new Date().toISOString().slice(0, 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(b.start_date ?? "")) ? String(b.start_date) : today;
  const planId = String(b.plan_id ?? ""), planName = String(b.plan_name ?? "").slice(0, 120), amount = Number(b.plan_amount) || null, unit = String(b.plan_unit ?? "");
  const pay = ["in_person", "card_link", "later"].includes(b.pay) ? b.pay : "later";
  const steps: { name: string; ok: boolean; detail?: string }[] = [];
  const step = (name: string, ok: boolean, detail?: string) => steps.push({ name, ok, detail });
  let contactId: string | null = null, memberId: string | null = null, orderId: string | null = null, orderRow: any = null, userId: string | null = null, checkout: string | null = null;

  // ---- Wix: contact + site member (needs an email)
  if (email) {
    try {
      const { data: ex } = await db.from("wix_contacts").select("contact_id").ilike("email", email).limit(1).maybeSingle();
      if (ex?.contact_id) {
        contactId = ex.contact_id;
        const g = await wix("GET", `/contacts/v4/contacts/${encodeURIComponent(contactId!)}`);
        memberId = g.data?.contact?.memberInfo?.memberId ?? null;
        if (!memberId) {
          const m = await wix("POST", "/members/v1/members", { member: { loginEmail: email, contact: { firstName: first, lastName: last || undefined, phones: phone ? [phone] : undefined } } });
          if (m.ok) memberId = m.data?.member?.id ?? null; else throw new Error("members_" + m.status);
        }
        step("Wix", true, "Already a client in Wix: used the existing record.");
      } else {
        const m = await wix("POST", "/members/v1/members", { member: { loginEmail: email, contact: { firstName: first, lastName: last || undefined, phones: phone ? [phone] : undefined, emails: [email] } } });
        if (!m.ok) throw new Error("members_" + m.status + " " + String(m.data?.message ?? "").slice(0, 120));
        memberId = m.data?.member?.id ?? null; contactId = m.data?.member?.contactId ?? null;
        step("Wix", true, "Created in Wix as a client and site member.");
      }
    } catch (e) { step("Wix", false, String((e as Error).message) + ". The Wix API key may need permission to create members and contacts."); }
  } else step("Wix", true, "No email, so kept in the back office only (Wix needs an email to make someone a member).");

  // ---- the plan
  if (planId && pay === "in_person") {
    if (!memberId) step("Plan", false, "Needs the Wix member first, so the plan was not created.");
    else {
      const body: Record<string, unknown> = { memberId, planId, paid: true }; if (Date.parse(start + "T09:00:00Z") > Date.now()) body.startDate = start + "T09:00:00Z";
      const o = await wix("POST", "/pricing-plans/v2/checkout/orders/offline", body);
      if (o.ok && o.data?.order?.id) { orderId = o.data.order.id; orderRow = o.data.order; step("Plan", true, "Recorded in Wix as paid in person."); }
      else step("Plan", false, "Wix refused it (" + o.status + " " + String(o.data?.message ?? "").slice(0, 120) + "). The Wix API key may need permission to register offline orders.");
    }
  } else if (planId && pay === "card_link") { checkout = CHECKOUT; step("Plan", true, "Open the Wix checkout and let them pay by card."); }
  else if (planId) step("Plan", true, "Plan noted, payment still to come.");

  // ---- app login + welcome
  if (b.create_app && email) {
    try {
      const inv = await db.auth.admin.inviteUserByEmail(email, { data: { full_name: full }, redirectTo: "https://app.mygymlondon.co.uk" });
      if (inv.error) {
        const list = await db.auth.admin.listUsers({ perPage: 1000 }); const ex = list.data?.users?.find((x) => (x.email ?? "").toLowerCase() === email);
        if (ex) { userId = ex.id; step("App login", true, "They already have an app account."); } else throw new Error(inv.error.message);
      } else { userId = inv.data.user?.id ?? null; step("App login", true, "Created, and a welcome email with a link to set their password was sent."); }
      if (userId) await db.from("profiles").upsert({ id: userId, full_name: full, phone: phone || "", birthdate: b.birthdate || null }, { onConflict: "id" });
    } catch (e) { step("App login", false, String((e as Error).message).slice(0, 160)); }
  }

  // ---- health form (also in the app's own table when they have an account, so the app does not ask again)
  const healthRec = { answers, no_allergies: !!h.no_allergies, allergies: String(h.allergies ?? "").slice(0, 500), other_details: String(h.other_details ?? "").slice(0, 1000), consent_health: true, consent_truthful: true, consent_version: HEALTH_VERSION, consented_at: new Date().toISOString() };
  if (userId) { const { error } = await db.from("member_health").upsert({ user_id: userId, ...healthRec }, { onConflict: "user_id" }); step("Health form", !error, error ? error.message : "Saved, taken in person by " + (b.taken_by || "staff") + "."); }
  else step("Health form", true, "Saved in the back office, taken in person by " + (b.taken_by || "staff") + ".");

  // ---- news and offers (only if they said yes, and never over an unsubscribe)
  if (email && c.marketing) {
    const { data: mc } = await db.from("marketing_consent").select("withdrawn_at").eq("email", email).maybeSingle();
    if (mc?.withdrawn_at) step("News and offers", true, "They had unsubscribed before, so they were not re-subscribed.");
    else { const { error } = await db.from("marketing_consent").upsert({ email, user_id: userId, source: "in person: added by staff", wording: "Agreed in person at the gym; recorded by staff.", requested_at: new Date().toISOString(), confirmed_at: new Date().toISOString() }, { onConflict: "email" }); step("News and offers", !error, error ? error.message : "Subscribed."); }
  }

  // ---- the back office copy (shows straight away; the 30-minute sync refreshes it from Wix)
  if (contactId) await db.from("wix_contacts").upsert({ contact_id: contactId, email, first_name: first, last_name: last || null, full_name: full, phone: phone || null, is_member: true, created_wix: new Date().toISOString(), last_activity: new Date().toISOString(), birthdate: b.birthdate || null, updated_at: new Date().toISOString() }, { onConflict: "contact_id" });
  if (orderId && orderRow) await db.from("wix_orders").upsert({ order_id: orderId, contact_id: contactId, email, first_name: first, full_name: full, plan_name: planName || "Membership", plan_includes: "", amount: amount ?? 0, cycle_unit: unit, status: String(orderRow.status ?? "ACTIVE"), last_payment_status: String(orderRow.lastPaymentStatus ?? "PAID"), cycle_index: 0, cycle_started: orderRow.startDate ?? new Date().toISOString(), end_date: orderRow.endDate ?? null, auto_renew_canceled: false, baseline: true, updated_at: new Date().toISOString() }, { onConflict: "order_id" });
  const { data: rec, error: re } = await db.from("manual_members").insert({ email: email || null, full_name: full, phone: phone || null, birthdate: b.birthdate || null, emergency_name: String(b.emergency_name ?? "").slice(0, 80) || null, emergency_phone: String(b.emergency_phone ?? "").slice(0, 30) || null,
    plan_id: planId || null, plan_name: planName || null, plan_type: planName ? typeOf(planName) : null, amount, unit: unit || null, start_date: planId ? start : null, paid_how: planId ? pay : null,
    wix_contact_id: contactId, wix_member_id: memberId, wix_order_id: orderId, user_id: userId, health: { ...healthRec, taken_by: String(b.taken_by ?? "").slice(0, 80) },
    consents: { terms: true, privacy: true, marketing: !!c.marketing, taken_in_person: true, taken_by: String(b.taken_by ?? "").slice(0, 80), at: new Date().toISOString() }, created_by: u.user.id }).select("id").single();
  if (re) step("Back office record", false, re.message); else step("Back office record", true, "Saved.");
  await db.from("staff_access_log").insert({ user_id: u.user.id, action: "member_added_in_person", target: email || phone });
  return json(req, 200, { ok: true, steps, checkout_link: checkout, key: email || (rec ? "manual:" + rec.id : "") });
});
