// MY GYM London: back office "delete a member". Owners only. Separate from admin-edit-member so a mistake here can never affect editing.
//   {"action":"preview","key"}                  what a permanent delete would remove, and anything that blocks it
//   {"action":"delete","key","confirm":"DELETE"} removes the person from Wix (contact + site member, into Wix's 90-day trash), then from the back office copies and the app
// Refused for: a live (active/paused/pending) plan, team members, and an app account that has class bookings (use Hide instead). Wix is changed first: if Wix says no, nothing local is touched.
// Verify JWT stays ON and the code checks for an owner.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
async function wix(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch("https://www.wixapis.com" + path, { method, signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/json", Authorization: Deno.env.get("WIX_API_KEY")!, "wix-site-id": Deno.env.get("WIX_SITE_ID")! }, body: body === undefined ? undefined : JSON.stringify(body) });
  // deno-lint-ignore no-explicit-any
  let data: any = null; try { data = await r.json(); } catch (_e) { /* empty answer */ }
  return { ok: r.ok, status: r.status, data };
}
const why = (r: { status: number; data: { message?: string } | null }) => `Wix said no (${r.status}${r.data?.message ? " " + String(r.data.message).slice(0, 140) : ""}).` + (r.status === 403 ? " The Wix API key needs permission for this." : "");

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
    if (b.action === "preview" || b.action === "delete") {
      if (!isAdmin) return json(req, 403, { ok: false, error: "Only an owner can delete a member." });
      const m = await who(); if (!m) return json(req, 404, { ok: false, error: "That member was not found. Reload the page." });
      const e = m.email;
      const blockers: string[] = [], will: string[] = [];
      const contactIds: string[] = [];
      let uid: string | null = null, bookings = 0, orderRows: { order_id: string; status: string; plan_name: string | null }[] = [];
      if (e) {
        const { data: wcs } = await db.from("wix_contacts").select("contact_id, is_member").eq("email", e);
        for (const c of wcs ?? []) contactIds.push(c.contact_id as string);
        const { data: ors } = await db.from("wix_orders").select("order_id, status, plan_name").ilike("email", e);
        orderRows = (ors ?? []) as typeof orderRows;
        uid = ((await db.rpc("_uid_by_email", { p_email: e })).data as string | null) ?? null;
      }
      if (m.contactId && !contactIds.includes(m.contactId)) contactIds.push(m.contactId);
      const live = orderRows.filter((o) => ["ACTIVE", "PAUSED", "PENDING"].includes(String(o.status)));
      if (live.length) blockers.push(`They have ${live.length} live membership${live.length > 1 ? "s" : ""} (${live.map((o) => o.plan_name || "plan").join(", ")}). Cancel ${live.length > 1 ? "them" : "it"} first, then delete.`);
      if (uid) {
        const [{ data: p2 }, { data: s2 }, { count }] = await Promise.all([
          db.from("profiles").select("is_admin").eq("id", uid).maybeSingle(), db.from("staff").select("role").eq("user_id", uid).maybeSingle(),
          db.from("class_bookings").select("id", { count: "exact", head: true }).eq("user_id", uid)]);
        bookings = count ?? 0;
        if (p2?.is_admin || s2?.role) blockers.push("They are on your team. Remove them from Team first.");
        if (bookings > 0) blockers.push(`Their app account has ${bookings} class booking${bookings > 1 ? "s" : ""}, so it is kept. Use Hide instead.`);
      }
      if (contactIds.length) will.push(`Remove ${contactIds.length > 1 ? contactIds.length + " Wix contacts" : "the Wix contact"} (and the Wix site member). Wix keeps deleted contacts in its trash for 90 days.`);
      if (uid) will.push("Delete their app account (no bookings).");
      if (orderRows.length) will.push(`Remove ${orderRows.length} finished plan record${orderRows.length > 1 ? "s" : ""} from the back office (Wix keeps its own payment history).`);
      if (m.manualId) will.push("Remove their in-person record.");
      will.push("Remove their private notes and take them off the list for good.");
      if (b.action === "preview") return json(req, 200, { ok: true, blockers, will });
      if (blockers.length) return json(req, 409, { ok: false, error: blockers[0], blockers });
      if (String(b.confirm ?? "") !== "DELETE") return json(req, 400, { ok: false, error: "Type DELETE to confirm." });

      // 1. Wix first: if Wix refuses, nothing local is touched
      for (const id of contactIds) {
        const d = await wix("DELETE", `/contacts/v5/contacts/${id}?deleteMember=true`);
        const gone = d.ok || d.status === 404; step("Wix contact", gone, d.ok ? "Removed from Wix." : d.status === 404 ? "Already gone from Wix." : why(d) + (d.status === 400 || d.status === 409 ? " Wix will not delete a contact that still has an active plan or is a site owner." : ""));
        if (!gone) { await log("member_delete_failed", key); return json(req, 502, { ok: false, steps, error: steps[steps.length - 1].detail + " Nothing else was removed." }); }
        await db.from("wix_contacts").delete().eq("contact_id", id);
      }
      // 2. our own copies
      if (e) {
        await db.from("hidden_members").upsert({ email: e, name: null, hidden_by: u.user!.id, reason: "deleted" });
        const o = await db.from("wix_orders").delete().ilike("email", e); step("Plan records", !o.error, o.error ? o.error.message : "Removed.");
        await db.from("member_notes").delete().ilike("email", e);
        await db.from("manual_members").delete().eq("email", e);
        if (uid) { const x = await db.auth.admin.deleteUser(uid); step("App account", !x.error, x.error ? "Could not delete the app account: " + x.error.message : "Deleted."); }
      }
      if (m.manualId) { const x = await db.from("manual_members").delete().eq("id", m.manualId); step("Back office record", !x.error, x.error ? x.error.message : "Removed."); if (!x.error && !e) await db.from("hidden_members").upsert({ email: "manual:" + m.manualId, name: null, hidden_by: u.user!.id, reason: "deleted" }); }
      await log("member_deleted", key);
      const bad = steps.some((s) => !s.ok);
      return json(req, bad ? 502 : 200, { ok: !bad, steps, error: steps.find((s) => !s.ok)?.detail });
    }

    return json(req, 400, { ok: false, error: "Unknown action." });
  } catch (e) {
    console.error("admin-delete-member failed", String((e as Error)?.message ?? e));
    return json(req, 500, { ok: false, error: "Something went wrong. Nothing more was changed after the last step shown.", steps });
  }
});
