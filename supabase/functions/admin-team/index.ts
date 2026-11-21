// MY GYM London: back office "Team". The owner adds a co-worker or another admin and chooses their first password; they change it when they first sign in.
//   {"action":"add","name","email","role","password","must_change"}   role = admin | manager | reception | coach
//        creates the login (email already confirmed) with the password the owner typed, gives the role, and marks the login "must change the password".
//        If the person already has an account (for example a member), they keep their own password and only get the role.
//   {"action":"set_password","user_id","password","must_change"}      new temporary password for someone on the team who is locked out
//   {"action":"set_role","user_id","role"}                            change the role of someone on the team
//   {"action":"remove","user_id"}                                     takes away their team access (their login stays, so a member keeps their app)
// Only an admin (the owner) can call this. Verify JWT stays ON, and the code checks the caller is an admin. Passwords are never logged or returned.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://admin.mygymlondon.co.uk", "https://mygym-admin.pages.dev", "http://localhost:8137"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const json = (req: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const ROLES = ["admin", "manager", "reception", "coach"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A first password must be at least 10 characters with letters and a number. Returns the problem, or null when it is fine. */
export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "The password must be at least 10 characters.";
  if (pw.length > 72) return "The password is too long (72 characters at most).";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number in the password.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: au } = await db.auth.getUser(token);
  const caller = au?.user;
  if (!caller) return json(req, 401, { ok: false, error: "Please sign in." });
  const { data: me } = await db.from("profiles").select("is_admin").eq("id", caller.id).maybeSingle();
  if (!me?.is_admin) return json(req, 403, { ok: false, error: "Only the owner can manage the team." });

  // deno-lint-ignore no-explicit-any
  let b: any; try { b = await req.json(); } catch (_e) { return json(req, 400, { ok: false, error: "Bad request." }); }
  const action = String(b?.action ?? "");
  const log = (what: string, target: string) => db.from("staff_access_log").insert({ user_id: caller.id, action: what, target: target.slice(0, 200) });
  const adminCount = async () => (await db.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true)).count ?? 0;

  /** gives the person exactly one role: admin (profiles.is_admin) or one of the staff roles (staff table) */
  const setRole = async (uid: string, role: string) => {
    if (role === "admin") {
      await db.from("profiles").update({ is_admin: true }).eq("id", uid);
      await db.from("staff").delete().eq("user_id", uid);
    } else {
      const { data: p } = await db.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
      if (p?.is_admin) { if ((await adminCount()) < 2) return "There must always be at least one admin."; await db.from("profiles").update({ is_admin: false }).eq("id", uid); }
      await db.from("staff").upsert({ user_id: uid, role, added_by: caller.id }, { onConflict: "user_id" });
    }
    return null;
  };
  const isTeam = async (uid: string) => {
    const [{ data: p }, { data: s }] = await Promise.all([db.from("profiles").select("is_admin").eq("id", uid).maybeSingle(), db.from("staff").select("user_id").eq("user_id", uid).maybeSingle()]);
    return !!(p?.is_admin || s);
  };

  // ------------------------------------------------------------ add
  if (action === "add") {
    const name = String(b.name ?? "").trim(), email = String(b.email ?? "").trim().toLowerCase(), role = String(b.role ?? "");
    if (name.length < 2 || name.length > 80) return json(req, 400, { ok: false, error: "Please add their name." });
    if (!EMAIL.test(email) || email.length > 120) return json(req, 400, { ok: false, error: "That email address does not look right." });
    if (!ROLES.includes(role)) return json(req, 400, { ok: false, error: "Choose a role." });
    // find out whether they already have a login (the user list is small; look through up to 5 pages)
    let existing: { id: string } | null = null;
    for (let page = 1; page <= 5 && !existing; page++) {
      const r = await db.auth.admin.listUsers({ page, perPage: 1000 });
      const list = r.data?.users ?? [];
      existing = list.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
      if (list.length < 1000) break;
    }
    let uid: string, existed = false;
    if (existing) { uid = existing.id; existed = true; }
    else {
      const bad = passwordProblem(b.password); if (bad) return json(req, 400, { ok: false, error: bad });
      const c = await db.auth.admin.createUser({ email, password: String(b.password), email_confirm: true, user_metadata: { full_name: name, must_change_password: b.must_change !== false } });
      if (c.error || !c.data?.user) return json(req, 400, { ok: false, error: "We could not create the login. " + (c.error?.message ?? "") });
      uid = c.data.user.id;
    }
    await db.from("profiles").upsert({ id: uid, full_name: name }, { onConflict: "id", ignoreDuplicates: true });
    const problem = await setRole(uid, role); if (problem) return json(req, 400, { ok: false, error: problem });
    await log("team_add", uid + ":" + role + (existed ? ":existing account" : ":new login"));
    return json(req, 200, { ok: true, existed, user_id: uid });
  }

  // ------------------------------------------------------------ the rest act on one person already on the team
  const uid = String(b.user_id ?? "");
  if (!GUID.test(uid)) return json(req, 400, { ok: false, error: "Bad request." });
  if (!(await isTeam(uid))) return json(req, 404, { ok: false, error: "That person is not on the team." });

  if (action === "set_password") {
    const bad = passwordProblem(b.password); if (bad) return json(req, 400, { ok: false, error: bad });
    const { data: u } = await db.auth.admin.getUserById(uid);
    const meta = { ...(u?.user?.user_metadata ?? {}), must_change_password: b.must_change !== false };
    const r = await db.auth.admin.updateUserById(uid, { password: String(b.password), user_metadata: meta });
    if (r.error) return json(req, 400, { ok: false, error: "We could not change the password. " + r.error.message });
    await log("team_set_password", uid);
    return json(req, 200, { ok: true });
  }
  if (action === "set_role") {
    const role = String(b.role ?? ""); if (!ROLES.includes(role)) return json(req, 400, { ok: false, error: "Choose a role." });
    if (uid === caller.id) return json(req, 400, { ok: false, error: "You cannot change your own role." });
    const problem = await setRole(uid, role); if (problem) return json(req, 400, { ok: false, error: problem });
    await log("team_set_role", uid + ":" + role);
    return json(req, 200, { ok: true });
  }
  if (action === "remove") {
    if (uid === caller.id) return json(req, 400, { ok: false, error: "You cannot remove yourself." });
    const { data: p } = await db.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
    if (p?.is_admin) { if ((await adminCount()) < 2) return json(req, 400, { ok: false, error: "There must always be at least one admin." }); await db.from("profiles").update({ is_admin: false }).eq("id", uid); }
    await db.from("staff").delete().eq("user_id", uid);
    await log("team_remove", uid);
    return json(req, 200, { ok: true });
  }
  return json(req, 400, { ok: false, error: "Bad request." });
});
