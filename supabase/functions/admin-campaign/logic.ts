// MY GYM London: send a marketing email ("campaign") to everyone who confirmed they want news and offers. Admin only (checked in index.ts).
// Safety: only people with confirmed, not-withdrawn consent are ever emailed (send-email checks this again); each person gets a campaign once
// (key campaign:<id>:<email>), so pressing Send twice or retrying after an error never doubles up; a test goes only to the admin's own address.
// Large lists are sent in batches: the page keeps calling "send" until nothing remains. No network in here: everything is passed in.
export interface Person { email: string; user_id: string | null }
export interface Deps {
  audience(): Promise<Person[]>;
  alreadySent(campaignId: string): Promise<Set<string>>;          // emails this campaign already reached
  firstName(p: Person): Promise<string>;
  adminEmail: string;
  send(m: { to: string; user_id: string | null; vars: Record<string, string>; key: string; test: boolean }): Promise<"sent" | "skipped" | "failed">;
  pause(ms: number): Promise<void>;
}
export interface Input { action?: string; campaign_id?: unknown; subject?: unknown; preheader?: unknown; title?: unknown; body?: unknown; button?: unknown; url?: unknown }
export interface Out { status: number; body: Record<string, unknown> }
export const BATCH = 40;

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

export function checkContent(i: Input): { ok: true; vars: Record<string, string> } | { ok: false; error: string } {
  const subject = clean(i.subject, 200), preheader = clean(i.preheader, 200), title = clean(i.title, 200), body = clean(i.body, 4000), button = clean(i.button, 60), url = clean(i.url, 500);
  if (!subject) return { ok: false, error: "Add a subject line." };
  if (subject.length > 78) return { ok: false, error: "Make the subject 78 characters or fewer." };
  if (title.length < 2) return { ok: false, error: "Add a heading." };
  if (title.length > 60) return { ok: false, error: "Make the heading 60 characters or fewer." };
  if (body.length < 10) return { ok: false, error: "Write the message (at least a sentence)." };
  if (!button) return { ok: false, error: "Add the button text." };
  if (!/^https:\/\/[^\s]+$/.test(url)) return { ok: false, error: "The button link must start with https://" };
  return { ok: true, vars: { campaign_subject: subject, campaign_preheader: preheader || subject, campaign_title: title, campaign_body: body, campaign_button: button, campaign_url: url } };
}

export async function campaign(i: Input, d: Deps): Promise<Out> {
  const action = ["audience", "test", "send"].includes(String(i.action)) ? String(i.action) : null;
  if (!action) return { status: 400, body: { ok: false, error: "Unknown action." } };

  if (action === "audience") return { status: 200, body: { ok: true, count: (await d.audience()).length } };

  const c = checkContent(i);
  if (!c.ok) return { status: 422, body: { ok: false, error: c.error } };

  if (action === "test") {
    const r = await d.send({ to: d.adminEmail, user_id: null, vars: { ...c.vars, first_name: "there" }, key: "campaign-test", test: true });
    return r === "failed" ? { status: 502, body: { ok: false, error: "The test email did not send. Please try again." } } : { status: 200, body: { ok: true, sent_to: d.adminEmail } };
  }

  const id = String(i.campaign_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { status: 400, body: { ok: false, error: "Missing campaign id. Reload the page." } };
  const all = await d.audience();
  const done = await d.alreadySent(id);
  const todo = all.filter((p) => !done.has(p.email));
  const batch = todo.slice(0, BATCH);
  let sent = 0, skipped = 0, failed = 0;
  for (const p of batch) {
    const r = await d.send({ to: p.email, user_id: p.user_id, vars: { ...c.vars, first_name: await d.firstName(p) }, key: `campaign:${id}:${p.email}`, test: false });
    if (r === "sent") sent++; else if (r === "skipped") skipped++; else failed++;
    await d.pause(600);
  }
  return { status: 200, body: { ok: true, audience: all.length, already_sent: done.size, sent, skipped, failed, remaining: Math.max(0, todo.length - sent - skipped) } };
}
