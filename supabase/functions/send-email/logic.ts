// MY GYM London: the one place that sends an email from the library. Callers (database triggers, schedules, other functions) say WHICH email and for WHOM.
// Rules enforced here, so no caller can forget them: the email must exist; marketing emails need confirmed consent; an email with a dedupe key is sent once;
// a template the owner switched off in the back end is skipped; every attempt is recorded. Network and database are passed in so tests can fake them.
import { templates, render, requiredVars, GLOBALS } from "./lib.js";

export interface Deps {
  getUserEmail(userId: string): Promise<string | null>;
  hasConsent(email: string): Promise<boolean>;
  templateEnabled(template: string): Promise<boolean>;
  claim(key: string, template: string, to: string): Promise<boolean>;     // true = first time, go ahead
  finish(key: string, status: "sent" | "failed", detail: string): Promise<void>;
  unsubscribeUrl(email: string): Promise<string>;
  getOverride?(template: string): Promise<Override | null>;   // wording the owner changed in the back office (optional)
  deliver(mail: { to: string; subject: string; html: string; text: string; replyTo?: string; marketing: boolean; unsubscribeUrl?: string }): Promise<string>;
}
export interface Override { subject?: string; pre?: string; title?: string; cta_label?: string; paragraphs?: string[]; blocks?: unknown[]; }
export interface Req { template?: string; to?: string; user_id?: string; vars?: Record<string, unknown>; dedupe_key?: string; reply_to?: string; test?: boolean; }
export interface Out { status: number; body: Record<string, unknown>; }

// A "notice" is a one-off service message (closure, timetable change, news about your account). It uses the newsletter layout, but needs no marketing
// consent and has no unsubscribe link. It is for service information only: anything promotional must go out as a marketing campaign.
// deno-lint-ignore no-explicit-any
const ALL = templates as any[];
// deno-lint-ignore no-explicit-any
const NEWS = ALL.find((t: any) => t.id === "newsletter");
// deno-lint-ignore no-explicit-any
if (NEWS && !ALL.some((t: any) => t.id === "notice")) ALL.push({ ...NEWS, id: "notice", marketing: false, to: "member", when: "A one-off service notice sent from the back office" });

// Owner wording changes. The built-in wording is remembered the first time an email is seen, and every send starts from it, so removing a change restores the default.
// A change that uses a {{placeholder}} the email cannot fill is ignored completely, so an edit can never break an email.
// The owner can rewrite the whole body of an automatic email: paragraphs, small headings, highlighted boxes, bullet lists, details tables and small print, in any order.
// Every block is checked here again (shape, length, {{placeholders}}); if anything is wrong the whole change is ignored and the built-in email is sent.
const PH = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
// deno-lint-ignore no-explicit-any
function cleanBlocks(blocks: unknown, allowed: Set<string>): any[] | null {
  if (!Array.isArray(blocks) || !blocks.length || blocks.length > 40) return null;
  // deno-lint-ignore no-explicit-any
  const out: any[] = []; const seen: string[] = [];
  const str = (x: unknown, max: number) => typeof x === "string" && x.trim().length > 0 && x.length <= max;
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") return null;
    // deno-lint-ignore no-explicit-any
    const b = raw as Record<string, any>; const keys = ["p", "h", "note", "muted", "list", "kv"].filter((k) => k in b);
    if (keys.length !== 1) return null;
    const k = keys[0]; const nb: Record<string, unknown> = {};
    if (k === "list") {
      if (!Array.isArray(b.list) || !b.list.length || b.list.length > 12 || !b.list.every((x: unknown) => str(x, 600))) return null;
      nb.list = b.list.map((x: string) => x.trim()); seen.push(...(nb.list as string[]));
    } else if (k === "kv") {
      if (!Array.isArray(b.kv) || !b.kv.length || b.kv.length > 14) return null;
      const rows: string[][] = [];
      for (const r of b.kv) {
        if (!Array.isArray(r) || r.length < 2 || r.length > 3 || !str(r[0], 120) || !str(r[1], 400)) return null;
        if (r.length === 3 && !(typeof r[2] === "string" && /^[a-z0-9_]{1,60}$/.test(r[2]))) return null;
        rows.push(r.length === 3 ? [r[0].trim(), r[1].trim(), r[2]] : [r[0].trim(), r[1].trim()]); seen.push(r[0], r[1]);
      }
      nb.kv = rows;
    } else { if (!str(b[k], 1500)) return null; nb[k] = b[k].trim(); seen.push(nb[k] as string); }
    if (b.if !== undefined) { if (typeof b.if !== "string" || !/^[a-z0-9_]{1,60}$/.test(b.if)) return null; nb.if = b.if; }
    out.push(nb);
  }
  for (const t of seen) for (const m of t.matchAll(PH)) if (!allowed.has(m[1])) return null;
  return out;
}

const ORIGINAL = new Map<string, string>();
// deno-lint-ignore no-explicit-any
function applyOverride(def: any, ov: Override | null) {
  if (!ORIGINAL.has(def.id)) ORIGINAL.set(def.id, JSON.stringify(def));
  const base = JSON.parse(ORIGINAL.get(def.id)!);
  for (const k of Object.keys(def)) delete def[k];
  Object.assign(def, base);
  if (!ov) return;
  const allowed = new Set<string>([...(requiredVars(def) as string[]), ...Object.keys(GLOBALS as Record<string, unknown>)]);
  const paras = Array.isArray(ov.paragraphs) ? ov.paragraphs.filter((x) => typeof x === "string" && x.trim()) : [];
  const texts = [ov.subject, ov.pre, ov.title, ov.cta_label, ...paras].filter((x): x is string => typeof x === "string");
  for (const t of texts) for (const m of t.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) if (!allowed.has(m[1])) return;
  let newBody: unknown[] | null = null;
  if (ov.blocks !== undefined && ov.blocks !== null) { newBody = cleanBlocks(ov.blocks, allowed); if (!newBody) return; }
  if (typeof ov.subject === "string" && ov.subject.trim()) def.subject = ov.subject.trim();
  if (typeof ov.pre === "string" && ov.pre.trim()) def.pre = ov.pre.trim();
  if (typeof ov.title === "string" && ov.title.trim()) def.title = ov.title.trim();
  if (typeof ov.cta_label === "string" && ov.cta_label.trim() && def.cta) def.cta = { ...def.cta, label: ov.cta_label.trim() };
  if (newBody) def.body = newBody;
  else if (paras.length && Array.isArray(def.body)) {
    let i = 0;
    for (const item of def.body) if (item && "p" in item && i < paras.length) item.p = paras[i++];
    while (i < paras.length) { let last = -1; def.body.forEach((it: Record<string, unknown>, ix: number) => { if (it && "p" in it) last = ix; }); def.body.splice(last + 1, 0, { p: paras[i++] }); }
  }
}

const ADMIN = "info@mygymlondon.co.uk";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function sendEmail(r: Req, d: Deps): Promise<Out> {
  const def = ALL.find((t) => t.id === r.template);
  if (!def) return { status: 400, body: { ok: false, error: "unknown_template" } };

  let to = String(r.to ?? "").trim().toLowerCase();
  if (def.to === "admin" && !to) to = ADMIN;
  if (!to && r.user_id) to = (await d.getUserEmail(r.user_id))?.toLowerCase() ?? "";
  if (!EMAIL.test(to)) return { status: 400, body: { ok: false, error: "no_recipient" } };

  if (!(await d.templateEnabled(def.id))) return { status: 200, body: { ok: true, skipped: "switched_off" } };
  if (def.marketing && !r.test && !(await d.hasConsent(to))) return { status: 200, body: { ok: true, skipped: "no_consent" } };

  const key = (r.test ? "test:" + crypto.randomUUID() : String(r.dedupe_key ?? "").slice(0, 200)) || `${def.id}:${to}:${crypto.randomUUID()}`;
  if (!(await d.claim(key, def.id, to))) return { status: 200, body: { ok: true, skipped: "already_sent" } };

  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.vars ?? {})) if (v !== null && v !== undefined) vars[k] = String(v);
  let unsub: string | undefined;
  if (def.marketing) { unsub = await d.unsubscribeUrl(to); vars.unsubscribe_url = unsub; }

  let mail;
  try {
    if (d.getOverride) applyOverride(def, await d.getOverride(def.id).catch(() => null)); else applyOverride(def, null);
    const missing = (requiredVars(def) as string[]).filter((k) => !(k in vars));
    if (missing.length) throw new Error("missing: " + missing.join(", "));
    mail = render(def.id, vars);
  } catch (e) { await d.finish(key, "failed", "render: " + String((e as Error).message).slice(0, 200)); return { status: 422, body: { ok: false, error: "missing_details", detail: String((e as Error).message) } }; }

  try {
    const id = await d.deliver({ to, subject: (r.test ? "[TEST] " : "") + mail.subject, html: mail.html, text: mail.text, replyTo: r.reply_to, marketing: !!def.marketing, unsubscribeUrl: unsub });
    await d.finish(key, "sent", id);
    return { status: 200, body: { ok: true, sent: true } };
  } catch (e) {
    await d.finish(key, "failed", String((e as Error).message).slice(0, 200));
    return { status: 502, body: { ok: false, error: "send_failed" } };
  }
}
