// MY GYM London: watches Wix Pricing Plans orders and sends our own membership and payment emails. Written 2026-10-28. NOT deployed, NOT scheduled.
// Owner decision: when the move off Wix is complete, Wix only takes payments; every email comes from here (see migration-wix-payments.sql).
// Runs every 15 minutes from a database schedule (x-cron-secret = CRON_SECRET). Verify JWT is OFF. Secrets: WIX_API_KEY, WIX_SITE_ID, CRON_SECRET (already set for the other functions).
// SAFETY: app_flags 'wix_payment_emails' = off (default): track only, send nothing. test: send only to its test_emails. on: send to everyone.
// The first run stores every existing order as a baseline and never emails for it, so switching on cannot flood members.
import { createClient } from "npm:@supabase/supabase-js@2";

const MANAGE = "https://join.mygymlondon.co.uk/my-subscriptions";   // where members update their card (the Wix checkout site)
const wixHeaders = () => ({ "Content-Type": "application/json", Authorization: Deno.env.get("WIX_API_KEY")!, "wix-site-id": Deno.env.get("WIX_SITE_ID")! });
async function wix(path: string) {
  const r = await fetch("https://www.wixapis.com" + path, { headers: wixHeaders() });
  let data: any = null; try { data = await r.json(); } catch (_e) { /* empty */ }
  return { ok: r.ok, status: r.status, data };
}
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// ---------- small formatters (UK English, UK time) ----------
const gbp = (n: number) => "£" + n.toFixed(2);
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(d);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
function addCycle(d: Date, unit: string, count = 1) { const x = new Date(d); if (unit === "YEAR") x.setUTCFullYear(x.getUTCFullYear() + count); else if (unit === "WEEK") x.setUTCDate(x.getUTCDate() + 7 * count); else if (unit === "DAY") x.setUTCDate(x.getUTCDate() + count); else x.setUTCMonth(x.getUTCMonth() + count); return x; }
const per = (unit: string) => unit === "YEAR" ? "per year" : unit === "WEEK" ? "per week" : unit === "DAY" ? "per day" : unit ? "per month" : "one off";

/** what a Wix order means for us */
function read(o: any) {
  const cycle = o.currentCycle?.index ?? 0, unit = o.pricing?.subscription?.cycleDuration?.unit ?? "", count = o.pricing?.subscription?.cycleDuration?.count ?? 1;
  const tier = (o.pricing?.prices ?? []).find((p: any) => cycle >= (p.duration?.cycleFrom ?? 0) && cycle < (p.duration?.cycleFrom ?? 0) + (p.duration?.numberOfCycles ?? 1e9)) ?? (o.pricing?.prices ?? [])[0];
  const amount = Number(tier?.price?.total ?? o.planPrice ?? 0);
  const started = o.currentCycle?.startedDate ? new Date(o.currentCycle.startedDate) : (o.startDate ? new Date(o.startDate) : new Date());
  return { id: String(o.id), contact: o.buyer?.contactId ?? o.buyer?.memberId ?? "", plan: String(o.planName ?? "Membership"), includes: String(o.planDescription ?? "Your plan").slice(0, 160), amount, unit, count, status: String(o.status ?? ""), pay: String(o.lastPaymentStatus ?? ""), cycle, started, end: o.endDate ? new Date(o.endDate) : null, cancelled: !!o.autoRenewCanceled };
}

Deno.serve(async (req) => {
  const want = Deno.env.get("CRON_SECRET") ?? "";
  if (want && req.headers.get("x-cron-secret") !== want) return json(401, { ok: false });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: flag } = await db.from("app_flags").select("mode, test_emails").eq("key", "wix_payment_emails").maybeSingle();
  const mode = flag?.mode ?? "off", tests: string[] = (flag?.test_emails ?? []).map((e: string) => e.toLowerCase());

  // 1. every order (50 per page)
  const orders: any[] = [];
  for (let off = 0; off < 2000; off += 50) {
    const r = await wix(`/pricing-plans/v2/orders?limit=50&offset=${off}`);
    if (!r.ok) { await db.from("sync_log").upsert({ id: "wix-payments", last_run: new Date().toISOString(), last_result: { ok: false, status: r.status } }); return json(502, { ok: false, step: "orders", status: r.status }); }
    orders.push(...(r.data?.orders ?? []));
    if ((r.data?.orders ?? []).length < 50) break;
  }
  const { data: known } = await db.from("wix_orders").select("*");
  const have = new Map<string, any>((known ?? []).map((k: any) => [k.order_id, k]));
  const firstRun = have.size === 0;
  const contacts = new Map<string, { email: string; first: string; full: string }>();
  async function who(contactId: string, row?: any) {
    if (row?.email) return { email: row.email as string, first: (row.first_name as string) || "there", full: (row.full_name as string) || "" };
    if (!contactId) return null;
    if (contacts.has(contactId)) return contacts.get(contactId)!;
    const r = await wix(`/contacts/v4/contacts/${encodeURIComponent(contactId)}`);
    const c = r.data?.contact, email = c?.primaryInfo?.email ?? c?.info?.emails?.items?.[0]?.email;
    if (!email) return null;
    const first = String(c?.info?.name?.first ?? "").trim() || "there", full = [c?.info?.name?.first, c?.info?.name?.last].filter(Boolean).join(" ");
    const v = { email: String(email).toLowerCase(), first, full }; contacts.set(contactId, v); return v;
  }

  let sent = 0, tracked = 0, skipped = 0;
  async function mail(template: string, to: string, vars: Record<string, string>, key: string) {
    if (mode === "off" || (mode === "test" && !tests.includes(to.toLowerCase()))) { skipped++; return; }
    try {
      const r = await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-email", { method: "POST", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, "x-cron-secret": want }, body: JSON.stringify({ template, to, vars, dedupe_key: key }) });
      if (r.ok) sent++;
    } catch (_e) { /* the dedupe key lets the next run try again */ }
  }
  const adminTo = "info@mygymlondon.co.uk";

  for (const raw of orders) {
    const n = read(raw), old = have.get(n.id), p = await who(n.contact, old);
    const row: Record<string, unknown> = { order_id: n.id, contact_id: n.contact, email: p?.email ?? old?.email ?? null, first_name: p?.first ?? old?.first_name ?? null, full_name: p?.full ?? old?.full_name ?? null,
      plan_name: n.plan, plan_includes: n.includes, amount: n.amount, cycle_unit: n.unit, status: n.status, last_payment_status: n.pay, cycle_index: n.cycle, cycle_started: n.started.toISOString(), end_date: n.end?.toISOString() ?? null,
      auto_renew_canceled: n.cancelled, updated_at: new Date().toISOString(), baseline: old ? old.baseline : firstRun };
    tracked++;
    const to = String(row.email ?? ""), first = String(row.first_name ?? "there"), full = String(row.full_name ?? to), key = (s: string) => `wixpay:${n.id}:${s}`;
    let failedSince: string | null = old?.failed_since ?? null, failedSteps: number = old?.failed_steps ?? 0;
    const next = addCycle(n.started, n.unit, n.count), live = n.status === "ACTIVE", base = { first_name: first, plan_name: n.plan, amount: gbp(n.amount) };

    if (old && !firstRun && to) {
      // new or newly active order
      const becameActive = live && old.status !== "ACTIVE" && old.status !== "PAUSED";
      if (becameActive) {
        await mail("subscription-started", to, { ...base, billing_period: per(n.unit), start_date: day(n.started), next_payment_date: n.unit ? day(next) : "No further payment", plan_includes: n.includes }, key("started"));
        await mail("admin-new-member", adminTo, { person_name: full, plan_name: n.plan, source_page: "Wix checkout" }, key("admin-started"));
      }
      // a payment arrived for a new billing cycle (or the first payment)
      if (n.pay === "PAID" && (old.last_payment_status !== "PAID" || n.cycle > (old.cycle_index ?? 0)) && live && n.amount > 0) {
        await mail("payment-receipt", to, { ...base, billing_period: per(n.unit), payment_date: day(new Date()), payment_method: "Your saved card", next_payment_date: n.unit ? day(next) : "No further payment", receipt_number: `MGL-${n.started.toISOString().slice(2, 4)}${n.started.toISOString().slice(5, 7)}-${n.id.slice(0, 4).toUpperCase()}-${n.cycle}` }, key("receipt-" + n.cycle));
        failedSince = null; failedSteps = 0;
      }
      // a payment failed
      if ((n.pay === "FAILED" || (n.pay === "UNPAID" && old.last_payment_status === "PAID")) && live && !failedSince) {
        failedSince = new Date().toISOString(); failedSteps = 1;
        await mail("payment-failed-1", to, { ...base, retry_date: day(addDays(new Date(), 5)), update_payment_url: MANAGE }, key("failed-1-" + n.cycle));
        await mail("admin-payment-failed", adminTo, { person_name: full, plan_name: n.plan, amount: gbp(n.amount), retry_date: day(addDays(new Date(), 5)) }, key("admin-failed-" + n.cycle));
      }
      if (n.pay === "REFUNDED" && old.last_payment_status !== "REFUNDED") await mail("refund-issued", to, { first_name: first, amount: gbp(n.amount), payment_date: day(new Date()), refund_reason: "a refund you were due" }, key("refund-" + n.cycle));
      if (n.status === "PAUSED" && old.status !== "PAUSED") await mail("membership-paused", to, { first_name: first, plan_name: n.plan, pause_date: day(new Date()), resume_date: "when you ask us to restart it" }, key("paused-" + n.cycle));
      if (n.status === "ACTIVE" && old.status === "PAUSED") await mail("membership-resumed", to, { first_name: first, plan_name: n.plan, next_payment_date: n.unit ? day(next) : "No further payment" }, key("resumed-" + n.cycle));
      if ((n.cancelled && !old.auto_renew_canceled) || (n.status === "CANCELED" && old.status !== "CANCELED")) {
        const end = n.end ?? next;
        await mail("membership-cancelled", to, { first_name: first, plan_name: n.plan, end_date: day(end), final_payment: n.unit ? "Your last payment has already been taken. There is nothing more to pay." : "Nothing more to pay" }, key("cancelled"));
        await mail("admin-membership-cancelled", adminTo, { person_name: full, plan_name: n.plan, end_date: day(end), reason: "Cancelled in Wix" }, key("admin-cancelled"));
      }
      if (n.status === "ENDED" && old.status !== "ENDED") await mail("membership-ended", to, { first_name: first, plan_name: n.plan, end_date: day(n.end ?? new Date()) }, key("ended"));
    }
    // follow-ups for a payment that is still failing (day 5 and day 14); a staff task on day 21 to pause it by hand
    if (failedSince && !(n.pay === "PAID") && live && to && !firstRun) {
      const age = (Date.now() - new Date(failedSince).getTime()) / 864e5, final = day(addDays(new Date(failedSince), 21));
      if (age >= 5 && failedSteps < 2) { await mail("payment-failed-2", to, { ...base, final_date: final, update_payment_url: MANAGE }, key("failed-2-" + n.cycle)); failedSteps = 2; }
      if (age >= 14 && failedSteps < 3) { await mail("payment-failed-final", to, { ...base, final_date: final, update_payment_url: MANAGE }, key("failed-3-" + n.cycle)); failedSteps = 3; }
      if (age >= 21 && failedSteps < 4 && mode !== "off") {
        await db.from("staff_tasks").insert({ title: `Payment still failing for ${full} (${n.plan}). Pause or cancel the plan in Wix, as the emails promised.`, assigned: "Pedro" }); failedSteps = 4;
      }
    }
    // renewal reminder for yearly plans, 7 days before the cycle ends
    if (live && to && n.unit === "YEAR" && !n.cancelled && !firstRun) {
      const renew = next, days = (renew.getTime() - Date.now()) / 864e5;
      if (days > 0 && days <= 7) await mail("renewal-reminder", to, { first_name: first, plan_name: n.plan, amount: gbp(n.amount), renewal_date: day(renew) }, key("renewal-" + n.cycle));
    }
    row.failed_since = failedSince; row.failed_steps = failedSteps;
    await db.from("wix_orders").upsert(row);
  }
  await db.from("sync_log").upsert({ id: "wix-payments", last_run: new Date().toISOString(), last_result: { ok: true, mode, orders: tracked, sent, skipped, firstRun } });
  return json(200, { ok: true, mode, orders: tracked, sent, skipped, firstRun });
});
