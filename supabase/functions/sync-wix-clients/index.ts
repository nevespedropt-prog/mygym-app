// MY GYM London: copies your Wix clients into the back office (read-only on the Wix side). Runs every 30 minutes from the database (x-cron-secret = CRON_SECRET).
//   * contacts (name, email, phone, labels, member, newsletter status, dates)            -> public.wix_contacts
//   * Pricing Plans orders (plan, status, payment status, amount, dates)                  -> public.wix_orders (same table the payments sync uses; rows are marked baseline so no email is ever triggered by this)
//   * confirmed bookings of the last 60 days (per client: last booked, how many)           -> columns on wix_contacts
// Nothing is ever deleted here. If Wix returns an error the run stops and reports it, leaving the old copy in place.
// Deployed 2026-11-12 (version 1); the deployed copy is the one that runs. Secrets: WIX_API_KEY, WIX_SITE_ID, CRON_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const hdr = () => ({ "Content-Type": "application/json", Authorization: Deno.env.get("WIX_API_KEY")!, "wix-site-id": Deno.env.get("WIX_SITE_ID")! });
async function wix(method: string, path: string, body?: unknown) {
  const r = await fetch("https://www.wixapis.com" + path, { method, headers: hdr(), body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`wix_${r.status}_${path.split("?")[0]}`);
  return await r.json();
}
const cronOk = (req: Request) => {
  const want = Deno.env.get("CRON_SECRET") ?? "";
  if (!want) return false;
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
};
const londonDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(iso));
const chunks = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false });
  if (!cronOk(req)) return json(401, { ok: false });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const labelName = new Map<string, string>();
    for (let off = 0; off < 500; off += 100) {
      const r = await wix("GET", `/contacts/v4/labels?paging.limit=100&paging.offset=${off}`);
      for (const l of r.labels ?? []) labelName.set(l.key, l.displayName);
      if ((r.labels ?? []).length < 100) break;
    }
    const now = Date.now(), from = new Date(now - 60 * 864e5).toISOString(), to = new Date(now + 864e5).toISOString();
    const byEmail = new Map<string, { last: string; n: number }>();
    let body: Record<string, unknown> = { query: { filter: { $and: [{ status: { $in: ["CONFIRMED"] } }, { startDate: { $gte: from } }, { startDate: { $lt: to } }] }, cursorPaging: { limit: 100 } } };
    for (let p = 0; p < 40; p++) {
      const d = await wix("POST", "/_api/bookings-reader/v2/extended-bookings/query", body);
      for (const x of d.extendedBookings ?? []) {
        const b = x.booking ?? {}; const em = String(b.contactDetails?.email ?? "").toLowerCase(); if (!em || !b.startDate || Date.parse(b.startDate) > now) continue;
        const day = londonDay(b.startDate); const cur = byEmail.get(em);
        byEmail.set(em, { last: !cur || day > cur.last ? day : cur.last, n: (cur?.n ?? 0) + 1 });
      }
      const next = d.pagingMetadata?.cursors?.next; if (!d.pagingMetadata?.hasNext || !next) break;
      body = { query: { cursorPaging: { cursor: next, limit: 100 } } };
    }
    const byContact = new Map<string, string>(), byMember = new Map<string, string>();
    // deno-lint-ignore no-explicit-any
    const rows: any[] = [];
    for (let off = 0; off < 5000; off += 100) {
      const d = await wix("POST", "/contacts/v4/contacts/query", { query: { paging: { limit: 100, offset: off } } });
      const cs = d.contacts ?? [];
      for (const c of cs) {
        const email = String(c.primaryInfo?.email ?? c.info?.emails?.items?.[0]?.email ?? "").toLowerCase();
        const first = String(c.info?.name?.first ?? "").trim(), last = String(c.info?.name?.last ?? "").trim();
        if (email) { byContact.set(c.id, email); if (c.memberInfo?.memberId) byMember.set(c.memberInfo.memberId, email); }
        const bk = byEmail.get(email);
        rows.push({ contact_id: c.id, email: email || null, first_name: first || null, last_name: last || null, full_name: [first, last].filter(Boolean).join(" ") || null, phone: c.primaryInfo?.phone || null,
          labels: (c.info?.labelKeys?.items ?? []).map((k: string) => labelName.get(k) ?? k), subscription: c.primaryEmail?.subscriptionStatus ?? null, is_member: !!c.memberInfo?.memberId,
          created_wix: c.createdDate ?? null, last_activity: c.lastActivity?.date ?? null, last_booked: bk?.last ?? null, bookings_60d: bk?.n ?? 0, updated_at: new Date().toISOString() });
      }
      if (cs.length < 100) break;
    }
    for (const part of chunks(rows, 200)) { const { error } = await db.from("wix_contacts").upsert(part, { onConflict: "contact_id" }); if (error) throw new Error("contacts_store:" + error.message); }
    // deno-lint-ignore no-explicit-any
    const orders: any[] = [];
    for (let off = 0; off < 3000; off += 50) {
      const r = await wix("GET", `/pricing-plans/v2/orders?limit=50&offset=${off}`);
      orders.push(...(r.orders ?? []));
      if ((r.orders ?? []).length < 50) break;
    }
    // deno-lint-ignore no-explicit-any
    const orows = orders.map((o: any) => {
      const cycle = o.currentCycle?.index ?? 0, unit = o.pricing?.subscription?.cycleDuration?.unit ?? "";
      const prices = o.pricing?.prices ?? [];
      // deno-lint-ignore no-explicit-any
      const tier = prices.find((p: any) => cycle >= (p.duration?.cycleFrom ?? 0) && cycle < (p.duration?.cycleFrom ?? 0) + (p.duration?.numberOfCycles ?? 1e9)) ?? prices[0];
      const cid = o.buyer?.contactId ?? "", mid = o.buyer?.memberId ?? "";
      const email = byContact.get(cid) ?? byMember.get(mid) ?? null;
      const ct = rows.find((r) => r.contact_id === cid);
      return { order_id: String(o.id), contact_id: cid || mid || null, email, first_name: ct?.first_name ?? null, full_name: ct?.full_name ?? null, plan_name: String(o.planName ?? "Membership"),
        plan_includes: String(o.planDescription ?? "").slice(0, 160), amount: Number(tier?.price?.total ?? o.planPrice ?? 0), cycle_unit: unit, status: String(o.status ?? ""), last_payment_status: String(o.lastPaymentStatus ?? ""),
        cycle_index: cycle, cycle_started: o.currentCycle?.startedDate ?? o.startDate ?? null, end_date: o.endDate ?? null, auto_renew_canceled: !!o.autoRenewCanceled, baseline: true, updated_at: new Date().toISOString() };
    });
    for (const part of chunks(orows, 200)) { const { error } = await db.from("wix_orders").upsert(part, { onConflict: "order_id" }); if (error) throw new Error("orders_store:" + error.message); }
    const result = { ok: true, contacts: rows.length, orders: orows.length, with_bookings: byEmail.size };
    await db.from("sync_log").upsert({ id: "wix-clients", last_call: new Date().toISOString(), last_run: new Date().toISOString(), last_result: result });
    return json(200, result);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error("sync-wix-clients failed", msg);
    await db.from("sync_log").upsert({ id: "wix-clients", last_call: new Date().toISOString(), last_result: { ok: false, error: msg } });
    return json(502, { ok: false, error: msg });
  }
});
