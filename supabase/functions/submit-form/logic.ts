// MY GYM London: what happens when someone sends a form. No network in here: the database and the mailer are passed in, so tests can fake them.
// Order: unknown form -> bot traps -> login -> rate limit -> validation -> store -> consent -> emails (emails never undo a stored submission).
import { forms, validate, GLOBALS } from "./lib.js";

export interface Deps {
  now: Date;
  countByIp(formId: string, ipHash: string, sinceISO: string): Promise<number>;
  countByUser(formId: string, userId: string, sinceISO: string): Promise<number>;
  insertSubmission(row: Record<string, unknown>): Promise<string>;
  upsertConsent(row: Record<string, unknown>): Promise<void>;
  getConsent(email: string): Promise<{ confirmed_at: string | null; withdrawn_at: string | null } | null>;
  profileName(userId: string): Promise<string>;
  token(purpose: "confirm" | "unsubscribe", email: string): Promise<string>;
  send(mail: { template: string; to: string; vars: Record<string, string>; replyTo?: string }): Promise<void>;
}
export interface Input { form_id?: string; data?: unknown; consent?: unknown; hp?: unknown; elapsed?: unknown; }
export interface Ctx { ipHash: string; user: { id: string; email: string } | null; functionsUrl: string; }
export interface Result { status: number; body: Record<string, unknown>; }

const ADMIN_EMAIL = "info@mygymlondon.co.uk";
const ADMIN_URL = "https://admin.mygymlondon.co.uk/";
const londonDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const niceDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00Z"));
const firstWord = (s: string) => (String(s).trim().split(/\s+/)[0] || "there");
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const LABELS: Record<string, string> = { full_name: "Name", parent_name: "Parent", email: "Email", phone: "Phone", topic: "Topic", goal: "Goal", experience: "Experience", times: "Best times", health_note: "Health note", class: "Class", date: "Day", company: "Company", team_size: "Team size", days: "Days", child_first_name: "Child first name", child_last_name: "Child last name", child_dob: "Child date of birth", emergency_name: "Emergency contact", emergency_phone: "Emergency phone", medical: "Medical", message: "Message" };
const SKIP = new Set(["full_name", "parent_name", "email", "phone", "message"]);

function summary(data: Record<string, unknown>): string {
  if (typeof data.message === "string" && Object.keys(data).filter((k) => !SKIP.has(k)).length === 0) return data.message;
  const lines = Object.entries(data).filter(([k]) => !SKIP.has(k)).map(([k, v]) => `${LABELS[k] ?? k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  if (typeof data.message === "string") lines.push("Message: " + data.message);
  return lines.join("\n");
}

export async function processSubmission(input: Input, ctx: Ctx, d: Deps): Promise<Result> {
  const form = (forms as Record<string, unknown>[]).find((f) => f.id === input?.form_id) as any;
  if (!form) return { status: 404, body: { ok: false, error: "Unknown form." } };

  // bot traps: a filled hidden field is a robot (pretend it worked, store nothing); sent faster than a person can type
  if (typeof input.hp === "string" && input.hp.trim() !== "") return { status: 200, body: { ok: true, message: form.success } };
  const elapsed = Number(input.elapsed);
  if (!Number.isFinite(elapsed) || elapsed < form.minSeconds) return { status: 429, body: { ok: false, error: "Please take a moment and try again." } };

  if (form.requiresLogin && !ctx.user) return { status: 401, body: { ok: false, error: "Please sign in and try again." } };

  const hourAgo = new Date(d.now.getTime() - 3600_000).toISOString();
  if ((await d.countByIp(form.id, ctx.ipHash, hourAgo)) >= (form.rateLimit?.perIpHour ?? form.rateLimit?.perIpPerHour ?? 5)) return { status: 429, body: { ok: false, error: "Too many messages from this connection. Please try again later." } };
  if (ctx.user && form.rateLimit?.perUserPerDay) {
    const dayAgo = new Date(d.now.getTime() - 86400_000).toISOString();
    if ((await d.countByUser(form.id, ctx.user.id, dayAgo)) >= form.rateLimit.perUserPerDay) return { status: 429, body: { ok: false, error: "You have reached today's limit. Please try again tomorrow." } };
  }

  const today = londonDate(d.now);
  const v = validate(form, { data: input.data, consent: input.consent }, today);
  if (!v.ok) return { status: 422, body: { ok: false, error: "Please check the form.", errors: v.errors } };

  const data = v.data as Record<string, any>;
  const personEmail: string = data.email ?? ctx.user?.email ?? "";
  const personName: string = data.full_name ?? data.parent_name ?? (ctx.user ? await d.profileName(ctx.user.id) : "") ?? "";

  const id = await d.insertSubmission({
    form_id: form.id, data, consent: v.consent, source_url: v.meta.page_url ?? null,
    utm: { utm_source: v.meta.utm_source, utm_medium: v.meta.utm_medium, utm_campaign: v.meta.utm_campaign }, ip_hash: ctx.ipHash,
    user_id: ctx.user?.id ?? null, delete_after: addDays(today, form.retentionDays ?? 730),
  });

  // consent record (kept with the exact words the person saw)
  const marketingBox = (form.consents ?? []).find((c: any) => c.id === "marketing");
  let sentConfirm = false;
  if (marketingBox && v.consent.marketing && personEmail) {
    const prev = await d.getConsent(personEmail);
    const wording = marketingBox.text;
    if (form.doubleOptIn) {
      if (!(prev?.confirmed_at && !prev?.withdrawn_at)) {
        await d.upsertConsent({ email: personEmail, user_id: ctx.user?.id ?? null, source: form.source, wording, requested_at: d.now.toISOString(), confirmed_at: null, withdrawn_at: null });
        sentConfirm = true;
      }
    } else if (!(prev?.confirmed_at && !prev?.withdrawn_at)) {
      await d.upsertConsent({ email: personEmail, user_id: ctx.user?.id ?? null, source: form.source, wording, requested_at: d.now.toISOString(), confirmed_at: d.now.toISOString(), withdrawn_at: null });
    }
  }

  // emails: best effort, each one on its own
  const tasks: Promise<void>[] = [];
  const safe = (p: Promise<void>) => tasks.push(p.catch((e) => console.error("email failed", form.id, String(e?.message ?? e))));
  const first = firstWord(personName);

  if (sentConfirm) {
    const t = await d.token("confirm", personEmail);
    safe(d.send({ template: "newsletter-welcome", to: personEmail, vars: { first_name: data.first_name ? firstWord(data.first_name) : "there", confirm_url: `${GLOBALS.app_url}email.html?a=confirm&t=${t}` } }));
  }

  const notifyOk = form.notify && (!form.notifyWhen || (form.notifyWhen === "rating <= 3" && Number(data.rating) <= 3));
  if (notifyOk) {
    let vars: Record<string, string>;
    if (form.notify === "admin-change-request") vars = { admin_url: ADMIN_URL, person_name: personName, request_type: data.request_type, from_date: niceDate(data.from_date), reason: data.reason ?? "Not given", sla: "2 working days" };
    else if (form.notify === "admin-new-review") vars = { admin_url: ADMIN_URL, person_name: personName, class_name: data.class ?? "Not said", rating: String(data.rating), message: data.message ?? "No comment" };
    else vars = { admin_url: ADMIN_URL, form_name: String(form.title).toLowerCase(), person_name: personName, person_email: personEmail, person_phone: data.phone ?? "Not given", message: summary(data), source_page: v.meta.page_url ?? form.where };
    safe(d.send({ template: form.notify, to: ADMIN_EMAIL, vars, replyTo: personEmail || undefined }));
  }

  if (form.autoreply && personEmail) {
    const vars: Record<string, string> = { first_name: first, message_preview: String(data.message ?? summary(data)).slice(0, 140), offer_name: v.meta.offer_name ?? "our offer", offer_terms: "", company: data.company ?? "your company", child_first_name: data.child_first_name ?? "your child" };
    safe(d.send({ template: form.autoreply, to: personEmail, vars }));
  }

  if (form.sendsTo === "referral-invite" && ctx.user && data.friend_email && data.friend_email !== ctx.user.email.toLowerCase()) {
    const refName = firstWord(await d.profileName(ctx.user.id));
    safe(d.send({ template: "referral-invite", to: data.friend_email, vars: { friend_name: firstWord(data.friend_name), referrer_name: refName, referral_url: GLOBALS.app_url, reward: "a free week" }, replyTo: ctx.user.email }));
  }

  await Promise.all(tasks);
  const message = form.successHigh && Number(data.rating) >= 4 ? form.successHigh : form.success;
  return { status: 200, body: { ok: true, id, message } };
}
