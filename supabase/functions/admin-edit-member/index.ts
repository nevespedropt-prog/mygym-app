// MY GYM London: back office "edit a member". Changes go to Wix (the source of truth for clients and memberships) and to our own copies, and every step reports its own result.
//   {"action":"check"}                                   admin: asks Wix whether the API key may edit contacts and orders (harmless probes on ids that do not exist)
//   {"action":"details","key","first","last","phone","birthdate"}   admin or manager: name, phone, date of birth (Wix contact, back office copy, app profile, in-person record)
//   {"action":"order","key","order_id","op"}              admin: op = pause | resume | cancel_now | cancel_end, on one membership (a Wix pricing plan order)
//   {"action":"change_plan","key","plan_id",...}          admin: start a plan, or switch to another plan (records the new plan, then cancels the old one)
// Card numbers are never handled here: card payments go through the Wix checkout. No email is sent to the member from here.
// Verify JWT stays ON (a signed-in person is required) and the code then checks the role.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const CHECKOUT = "https://join.mygymlondon.co.uk";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^[0-9 +()\-]{7,25}$/;
const NOBODY = "00000000-0000-4000-8000-000000000000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// deno-lint-ignore no-explicit-any
async function wix(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch("https://www.wixapis.com" + path, { method, signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/json", Authorization: Deno.env.get("WIX_API_KEY")!, "wix-site-id": Deno.env.get("WIX_SITE_ID")! }, body: body === undefined ? undefined : JSON.stringify(body) });
  // deno-lint-ignore no-explicit-any
  let data: any = null; try { data = await r.json(); } catch (_e) { /* empty answer */ }
  return { ok: r.ok, status: r.status, data };
}
const why = (r: { status: number; data: { message?: string } | null }) => `Wix said no (${r.status}${r.data?.message ? " " + String(r.data.message).slice(0, 140) : ""}).` + (r.status === 403 ? " The Wix API key needs permission for this." : "");
// "07911 123456" -> "+447911123456"; anything else is passed on as typed
const normPhone = (p: string) => { const d = p.replace(/[\s()\-]/g, ""); return /^0\d{9,10}$/.test(d) ? "+44" + d.slice(1) : d; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: prof } = await db.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  const { data: st } = await db.from("staff").select("role").eq("user_id", u.user.id).maybeSingle();
  const isAdmin = prof?.is_admin === true || st?.role === "admin";
  const isManager = isAdmin || st?.role === "manager";
  // deno-lint-ignore no-explicit-any
  let b: any; try { b = await req.json(); } catch { return json(req, 400, { ok: false, error: "Bad request" }); }
  const steps: { name: string; ok: boolean; detail?: string }[] = [];
  const step = (name: string, ok: boolean, detail?: string) => steps.push({ name, ok, detail });
  const log = (action: string, target: string) => db.from("staff_access_log").insert({ user_id: u.user!.id, action, target: target.slice(0, 200) });

  // ---- who is this member? (key is their email, or manual:<id> for someone added in person without an email)
  const key = String(b.key ?? "").trim().toLowerCase().slice(0, 200);
  async function who() {
    if (key.startsWith("manual:")) {
      const id = key.slice(7); if (!GUID.test(id)) return null;
      const { data } = await db.from("manual_members").select("*").eq("id", id).maybeSingle();
      return data ? { email: (data.email as string | null) ?? null, contactId: (data.wix_contact_id as string | null) ?? null, manualId: data.id as string } : null;
    }
    if (!key) return null;
    const { data: wc } = await db.from("wix_contacts").select("contact_id").eq("email", key).limit(1).maybeSingle();
    const { data: mm } = await db.from("manual_members").select("id, wix_contact_id").eq("email", key).limit(1).maybeSingle();
    if (!wc && !mm) { const uid = (await db.rpc("_uid_by_email", { p_email: key })).data; if (!uid) return null; }
    return { email: key, contactId: (wc?.contact_id as string | undefined) ?? (mm?.wix_contact_id as string | undefined) ?? null, manualId: (mm?.id as string | undefined) ?? null };
  }

  try {
    // ================= check: can the Wix API key edit things?
    if (b.action === "check") {
      if (!isAdmin) return json(req, 403, { ok: false, error: "Only an owner can run this." });
      const { data: one } = await db.from("wix_contacts").select("contact_id").limit(1).maybeSingle();
      const read = one?.contact_id ? await wix("GET", `/contacts/v5/contacts/${one.contact_id}`) : { ok: false, status: 0, data: null };
      const pauseProbe = await wix("POST", `/pricing-plans/v2/orders/${NOBODY}/pause`, {});
      const editProbe = await wix("PATCH", `/contacts/v5/contacts/${NOBODY}`, { contact: { id: NOBODY, revision: "1", name: { first: "x" } } });
      const memberProbe = await wix("POST", "/pricing-plans/v2/checkout/orders/offline", { planId: NOBODY, memberId: NOBODY, paid: true });
      const denied = (s: number) => s === 401 || s === 403;
      const out = {
        read_contacts: { status: read.status, ok: read.ok },
        edit_contacts: { status: editProbe.status, allowed: !denied(editProbe.status) },
        manage_orders: { status: pauseProbe.status, allowed: !denied(pauseProbe.status) },
        create_offline_order: { status: memberProbe.status, allowed: !denied(memberProbe.status) },
      };
      return json(req, 200, { ok: true, ...out });
    }

    // ================= details
    if (b.action === "details") {
      if (!isManager) return json(req, 403, { ok: false, error: "Only an owner or manager can edit members." });
      const first = String(b.first ?? "").trim().slice(0, 60), last = String(b.last ?? "").trim().slice(0, 60), phone = String(b.phone ?? "").trim().slice(0, 30), birthdate = String(b.birthdate ?? "").trim();
      if (!first) return json(req, 422, { ok: false, error: "The first name cannot be empty." });
      if (phone && !PHONE.test(phone)) return json(req, 422, { ok: false, error: "That phone number does not look right." });
      if (birthdate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || birthdate < "1900-01-01" || birthdate > new Date().toISOString().slice(0, 10))) return json(req, 422, { ok: false, error: "That date of birth does not look right." });
      const m = await who(); if (!m) return json(req, 404, { ok: false, error: "That member was not found. Reload the page." });
      const full = [first, last].filter(Boolean).join(" ");

      if (m.contactId) {
        const g = await wix("GET", `/contacts/v5/contacts/${m.contactId}`);
        if (!g.ok) step("Wix", false, "Could not read them from Wix. " + why(g));
        else {
          // deno-lint-ignore no-explicit-any
          const patch: any = { id: m.contactId, revision: String(g.data?.contact?.revision ?? ""), name: last ? { first, last } : { first } };
          if (phone) patch.phone = { phone: normPhone(phone) };
          if (birthdate) patch.birthdate = birthdate;
          const p = await wix("PATCH", `/contacts/v5/contacts/${m.contactId}`, { contact: patch });
          step("Wix", p.ok, p.ok ? "Updated in Wix." : why(p));
        }
        const wixOk = steps[steps.length - 1].ok;
        // our own copy follows Wix only when Wix accepted it (the 30-minute sync would undo anything else)
        if (wixOk) await db.from("wix_contacts").update({ first_name: first, last_name: last || null, full_name: full, ...(phone ? { phone } : {}), ...(birthdate ? { birthdate } : {}), updated_at: new Date().toISOString() }).eq("contact_id", m.contactId);
      } else step("Wix", true, "Not a Wix client, so only the back office record is updated.");

      const wixFailed = steps.some((s) => s.name === "Wix" && !s.ok);
      if (!wixFailed) {
        if (m.email) {
          const uid = (await db.rpc("_uid_by_email", { p_email: m.email })).data as string | null;
          if (uid) { const { error } = await db.from("profiles").update({ full_name: full, ...(phone ? { phone } : {}), ...(birthdate ? { birthdate } : {}) }).eq("id", uid); step("App profile", !error, error ? error.message : "Updated."); }
        }
        if (m.manualId) { const { error } = await db.from("manual_members").update({ full_name: full, ...(phone ? { phone } : {}), ...(birthdate ? { birthdate } : {}) }).eq("id", m.manualId); step("Back office record", !error, error ? error.message : "Updated."); }
      }
      await log("member_details_edited", key);
      return json(req, steps.some((s) => !s.ok) ? 502 : 200, { ok: !steps.some((s) => !s.ok), steps, error: steps.find((s) => !s.ok)?.detail });
    }

    // everything below changes memberships: owners only
    if (b.action === "order" || b.action === "change_plan") {
      if (!isAdmin) return json(req, 403, { ok: false, error: "Only an owner can change a membership." });
      const m = await who(); if (!m) return json(req, 404, { ok: false, error: "That member was not found. Reload the page." });

      // read one order live from Wix, and check it belongs to this member
      const readOrder = async (id: string) => {
        const { data: row } = await db.from("wix_orders").select("order_id, email").eq("order_id", id).maybeSingle();
        if (!row || (row.email ?? "").toLowerCase() !== (m.email ?? "")) return { err: "That membership does not belong to this member. Reload the page." };
        const g = await wix("GET", `/pricing-plans/v2/orders/${id}`);
        if (!g.ok || !g.data?.order) return { err: "Could not read the membership from Wix. " + why(g) };
        return { order: g.data.order };
      };
      const mirror = async (id: string, o: { status?: string; autoRenewCanceled?: boolean; endDate?: string }) => {
        await db.from("wix_orders").update({ status: String(o.status ?? ""), auto_renew_canceled: !!o.autoRenewCanceled, end_date: o.endDate ?? null, updated_at: new Date().toISOString() }).eq("order_id", id);
      };
      // after a change Wix shows it one or two seconds later: read until it does, at most three times
      // deno-lint-ignore no-explicit-any
      const settle = async (id: string, done: (o: any) => boolean) => {
        // deno-lint-ignore no-explicit-any
        let o: any = null;
        for (let i = 0; i < 3; i++) { await sleep(1500); const g = await wix("GET", `/pricing-plans/v2/orders/${id}`); if (g.ok && g.data?.order) { o = g.data.order; if (done(o)) break; } }
        return o;
      };
      const cancelOld = async (id: string, effectiveAt: "IMMEDIATELY" | "NEXT_PAYMENT_DATE") => {
        const c = await wix("POST", `/pricing-plans/v2/orders/${id}/cancel`, { effectiveAt });
        if (!c.ok) return { ok: false, detail: why(c) };
        const o = await settle(id, (x) => effectiveAt === "IMMEDIATELY" ? x.status === "CANCELED" : x.autoRenewCanceled === true);
        if (o) await mirror(id, o);
        return { ok: true, detail: effectiveAt === "IMMEDIATELY" ? "Cancelled now." : "Set to stop at the end of the period they have paid for.", o };
      };

      if (b.action === "order") {
        const id = String(b.order_id ?? ""); if (!GUID.test(id)) return json(req, 400, { ok: false, error: "Bad request" });
        const op = ["pause", "resume", "cancel_now", "cancel_end"].includes(b.op) ? String(b.op) : null; if (!op) return json(req, 400, { ok: false, error: "Unknown change." });
        const cur = await readOrder(id); if (cur.err) return json(req, 409, { ok: false, error: cur.err });
        const o = cur.order, status = String(o.status ?? "");
        if (op === "pause" && status !== "ACTIVE") return json(req, 409, { ok: false, error: "Only a membership that is active can be paused." });
        if (op === "resume" && status !== "PAUSED") return json(req, 409, { ok: false, error: "Only a paused membership can be resumed." });
        if ((op === "cancel_now") && !["ACTIVE", "PAUSED", "PENDING"].includes(status)) return json(req, 409, { ok: false, error: "This membership is already finished." });
        if (op === "cancel_end") {
          if (status !== "ACTIVE") return json(req, 409, { ok: false, error: "Only an active membership can be set to stop at the end of its period." });
          if (!o.pricing?.subscription) return json(req, 409, { ok: false, error: "This plan does not renew: it ends by itself on its end date." });
          if (o.autoRenewCanceled === true) return json(req, 409, { ok: false, error: "It is already set to stop at the end of the period." });
        }
        const call = op === "pause" ? wix("POST", `/pricing-plans/v2/orders/${id}/pause`, {}) : op === "resume" ? wix("POST", `/pricing-plans/v2/orders/${id}/resume`, {})
          : wix("POST", `/pricing-plans/v2/orders/${id}/cancel`, { effectiveAt: op === "cancel_now" ? "IMMEDIATELY" : "NEXT_PAYMENT_DATE" });
        const r = await call;
        if (!r.ok) return json(req, 502, { ok: false, error: why(r) });
        const fin = await settle(id, (x) => op === "pause" ? x.status === "PAUSED" : op === "resume" ? x.status === "ACTIVE" : op === "cancel_now" ? x.status === "CANCELED" : x.autoRenewCanceled === true);
        if (fin) await mirror(id, fin);
        await log("member_order_" + op, id);
        return json(req, 200, { ok: true, status: fin?.status ?? status, ends: fin?.endDate ?? null, set_to_cancel: fin?.autoRenewCanceled === true, confirmed: !!fin });
      }

      // ----- change_plan: start a plan, or switch (new plan first, then the old one stops)
      const planId = String(b.plan_id ?? ""); if (!GUID.test(planId)) return json(req, 400, { ok: false, error: "Choose the new plan." });
      const planName = String(b.plan_name ?? "").slice(0, 120), amount = Number(b.plan_amount) || 0, unit = String(b.plan_unit ?? "");
      const pay = b.pay === "card_link" ? "card_link" : "in_person", when = b.when === "period_end" ? "period_end" : "now";
      const oldId = b.old_order_id ? String(b.old_order_id) : "";
      // deno-lint-ignore no-explicit-any
      let old: any = null;
      if (oldId) {
        if (!GUID.test(oldId)) return json(req, 400, { ok: false, error: "Bad request" });
        const cur = await readOrder(oldId); if (cur.err) return json(req, 409, { ok: false, error: cur.err });
        old = cur.order;
        if (old.status !== "ACTIVE") return json(req, 409, { ok: false, error: "Only an active membership can be switched. Resume it first if it is paused." });
        if (old.planId === planId) return json(req, 409, { ok: false, error: "They are already on that plan." });
      }
      const effective = !old ? "IMMEDIATELY" : (when === "now" || !old.pricing?.subscription) ? "IMMEDIATELY" : "NEXT_PAYMENT_DATE";
      const periodEnd: string | null = old ? (old.currentCycle?.endedDate ?? old.endDate ?? null) : null;

      if (pay === "in_person") {
        if (!m.email) return json(req, 422, { ok: false, error: "Wix needs an email address for a plan. Add one first." });
        if (!m.contactId) return json(req, 422, { ok: false, error: "This person is not in Wix yet. Use Add member to create them with their plan." });
        const c = await wix("GET", `/contacts/v4/contacts/${m.contactId}`);
        let memberId: string | null = c.data?.contact?.memberInfo?.memberId ?? null;
        if (!memberId) {
          const mem = await wix("POST", "/members/v1/members", { member: { loginEmail: m.email, contact: { firstName: String(b.first ?? "") || undefined } } });
          if (!mem.ok) return json(req, 502, { ok: false, error: "They have no Wix member account and it could not be created. " + why(mem) });
          memberId = mem.data?.member?.id ?? null; step("Wix member", true, "Created their Wix member account (needed to record a plan).");
        }
        // deno-lint-ignore no-explicit-any
        const body: any = { memberId, planId, paid: true };
        if (effective === "NEXT_PAYMENT_DATE" && periodEnd && Date.parse(periodEnd) > Date.now()) body.startDate = periodEnd;
        const n = await wix("POST", "/pricing-plans/v2/checkout/orders/offline", body);
        if (!n.ok || !n.data?.order?.id) return json(req, 502, { ok: false, error: "The new plan was not created, so nothing was changed. " + why(n), steps });
        step("New plan", true, "Recorded in Wix as paid in person" + (body.startDate ? ", starting when the old plan ends." : ", starting now."));
        await db.from("wix_orders").upsert({ order_id: n.data.order.id, contact_id: m.contactId, email: m.email, first_name: String(b.first ?? "") || null, full_name: String(b.name ?? "") || null, plan_name: planName || "Membership", plan_includes: "", amount, cycle_unit: unit, status: String(n.data.order.status ?? "ACTIVE"), last_payment_status: String(n.data.order.lastPaymentStatus ?? "PAID"), cycle_index: 0, cycle_started: n.data.order.startDate ?? new Date().toISOString(), end_date: n.data.order.endDate ?? null, auto_renew_canceled: false, baseline: true, updated_at: new Date().toISOString() }, { onConflict: "order_id" });
      } else step("New plan", true, "To be paid by card: open the Wix checkout with them, or send them the link.");

      if (old) {
        const c = await cancelOld(oldId, effective as "IMMEDIATELY" | "NEXT_PAYMENT_DATE");
        step("Old plan", c.ok, c.ok ? c.detail : "The old plan could NOT be stopped: " + c.detail + " Cancel it by hand now, or they will be charged for both.");
      }
      await log("member_plan_changed", (oldId || "new") + " -> " + planId);
      const bad = steps.some((s) => !s.ok);
      return json(req, bad ? 502 : 200, { ok: !bad, steps, checkout_link: pay === "card_link" ? CHECKOUT : null, error: steps.find((s) => !s.ok)?.detail });
    }
    return json(req, 400, { ok: false, error: "Unknown action." });
  } catch (e) {
    console.error("admin-edit-member failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong. Nothing more was changed after the last step shown.", steps });
  }
});
