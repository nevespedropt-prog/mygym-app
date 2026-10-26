// Tests the cancellation email code in index.ts with a fake database and fake network. Run: node --experimental-strip-types --no-warnings supabase/functions/book-class/cancel-email.test.mjs
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), tmp = mkdtempSync(join(tmpdir(), "bc-"));
copyFileSync(join(here, "logic.ts"), join(tmp, "logic.ts"));
writeFileSync(join(tmp, "index.ts"), readFileSync(join(here, "index.ts"), "utf8").replace(/^import \{ createClient \} from "npm:.*$/m, "const createClient = () => ({});").replace("async function emailCancelled", "export async function emailCancelled"));
process.argv[2] = join(tmp, "index.ts");
import { pathToFileURL } from "node:url";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
globalThis.Deno = { serve() {}, env: { get: (k) => ({ SUPABASE_URL: "https://x.supabase.co", CRON_SECRET: "sec" }[k]) } };
const m = await import(pathToFileURL(process.argv[2]).href);
ok(m.cancelEmailVars({ date: "2026-10-29" }, { name: "BoxFit", start_time: "18:30:00", kind: "class" }, "Sara Jones").when === "Thursday 29 October at 18:30", "when text");
let v = m.cancelEmailVars({ date: "2026-10-29" }, { name: "x", start_time: "07:00", kind: "gym" }, null);
ok(v.class_name === "Gym session" && v.first_name === "there", "gym session and no name");
const calls = []; globalThis.fetch = async (u, o) => { calls.push([u, o]); return new Response("{}"); };
const db = { from: (t) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: t === "classes" ? { name: "HIIT", start_time: "07:00", kind: "class" } : { full_name: "Sara Jones" } }) }) }) }) };
await m.emailCancelled(db, { id: "b1", class_id: 1, user_id: "u1", date: "2026-10-28" }, "sara@x.co");
const body = JSON.parse(calls[0][1].body);
ok(calls.length === 1 && calls[0][0] === "https://x.supabase.co/functions/v1/send-email" && calls[0][1].headers["x-cron-secret"] === "sec", "calls send-email with the secret");
ok(body.template === "booking-cancelled" && body.to === "sara@x.co" && body.dedupe_key === "cancel-b1" && body.vars.when === "Wednesday 28 October at 07:00" && body.vars.first_name === "Sara", "payload " + JSON.stringify(body));
// failures never throw
globalThis.fetch = async () => { throw new Error("down"); }; await m.emailCancelled(db, { id: "b2", class_id: 1, user_id: "u1", date: "2026-10-28" }, "sara@x.co"); ok(true, "network failure is swallowed");
await m.emailCancelled({ from: () => { throw new Error("db"); } }, { id: "b3", class_id: 1, user_id: "u", date: "2026-10-28" }, "a@b.co"); ok(true, "db failure is swallowed");
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
