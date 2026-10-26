// MY GYM London: the one place that sends an email from the library. Callers (database triggers, schedules, other functions) say WHICH email and for WHOM.
// Rules enforced here, so no caller can forget them: the email must exist; marketing emails need confirmed consent; an email with a dedupe key is sent once;
// a template the owner switched off in the back end is skipped; every attempt is recorded. Network and database are passed in so tests can fake them.
import { templates, render, requiredVars } from "./lib.js";

export interface Deps {
  getUserEmail(userId: string): Promise<string | null>;
  hasConsent(email: string): Promise<boolean>;
  templateEnabled(template: string): Promise<boolean>;
  claim(key: string, template: string, to: string): Promise<boolean>;     // true = first time, go ahead
  finish(key: string, status: "sent" | "failed", detail: string): Promise<void>;
  unsubscribeUrl(email: string): Promise<string>;
  deliver(mail: { to: string; subject: string; html: string; text: string; replyTo?: string; marketing: boolean; unsubscribeUrl?: string }): Promise<string>;
}
export interface Req { template?: string; to?: string; user_id?: string; vars?: Record<string, unknown>; dedupe_key?: string; reply_to?: string; test?: boolean; }
export interface Out { status: number; body: Record<string, unknown>; }

const ADMIN = "info@mygymlondon.co.uk";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function sendEmail(r: Req, d: Deps): Promise<Out> {
  const def = (templates as any[]).find((t) => t.id === r.template);
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
