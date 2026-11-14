// MY GYM London: serves the forms and landing pages you build in the back office, and receives the answers. Public (no sign-in), so every submission is checked.
//   GET  ?f=<slug>  -> the form        GET ?p=<slug>  -> the landing page (its forms included)
//   POST {slug, data:{name,email,phone,answers:{<question id>:value}}, hp, elapsed, source}  -> stores it as a message (Messages page, form id c-<slug>) and sends the emails
// Emails reuse the standard library templates (admin-new-enquiry to the gym, enquiry-autoreply to the person), so they share the one MY GYM look.
// Spam protection: hidden trap field, minimum fill time, at most 8 submissions per form per hour from one connection. Verify JWT is OFF on purpose.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const f = url.searchParams.get("f"), p = url.searchParams.get("p");
    if (f) {
      const { data } = await db.from("custom_forms").select("slug, title, intro, fields, ask_phone, button, success").eq("slug", f).eq("active", true).maybeSingle();
      return data ? json(200, { ok: true, kind: "form", form: data }) : json(404, { ok: false, error: "This form is not available." });
    }
    if (p) {
      const { data } = await db.from("custom_pages").select("slug, title, blocks").eq("slug", p).eq("active", true).maybeSingle();
      if (!data) return json(404, { ok: false, error: "This page is not available." });
      // deno-lint-ignore no-explicit-any
      const slugs = [...new Set((data.blocks as any[]).filter((b) => b?.type === "form" && b.slug).map((b) => String(b.slug)))];
      const forms: Record<string, unknown> = {};
      for (const s of slugs) { const { data: fm } = await db.from("custom_forms").select("slug, title, intro, fields, ask_phone, button, success").eq("slug", s).eq("active", true).maybeSingle(); if (fm) forms[s] = fm; }
      return json(200, { ok: true, kind: "page", page: data, forms });
    }
    return json(400, { ok: false, error: "Missing form or page." });
  }
  if (req.method !== "POST") return json(405, { ok: false });

  // deno-lint-ignore no-explicit-any
  let b: any; try { b = await req.json(); } catch { return json(400, { ok: false, error: "Bad request" }); }
  const slug = clean(b?.slug, 60);
  const { data: form } = await db.from("custom_forms").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (!form) return json(404, { ok: false, error: "This form is not available." });
  if (b.hp) return json(200, { ok: true, success: form.success });          // a bot filled the hidden field: pretend it worked
  if (!(Number(b.elapsed) >= 3)) return json(429, { ok: false, error: "That was very quick. Please check your answers and send again." });

  const secret = Deno.env.get("EMAIL_TOKEN_SECRET") ?? "";
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const ipHash = await sha256(ip + ":" + secret);
  const formId = "c-" + slug;
  const { count } = await db.from("form_submissions").select("id", { count: "exact", head: true }).eq("form_id", formId).eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 8) return json(429, { ok: false, error: "Too many messages from this connection. Please try again later." });

  const d = b.data ?? {};
  const name = clean(d.name, 80), email = clean(d.email, 120).toLowerCase(), phone = clean(d.phone, 30);
  if (name.length < 2) return json(422, { ok: false, error: "Please add your name." });
  if (!EMAIL.test(email)) return json(422, { ok: false, error: "Please check your email address." });
  const answers: Record<string, unknown> = {}, lines: string[] = [];
  // deno-lint-ignore no-explicit-any
  for (const q of (form.fields as any[])) {
    const raw = (d.answers ?? {})[q.id];
    let v: unknown = null;
    if (q.type === "checkbox") v = raw === true || raw === "true" || raw === "yes";
    else if (q.type === "select") { v = clean(raw, 200); if (v && !(q.options ?? []).includes(v)) return json(422, { ok: false, error: "Please choose one of the options for: " + q.label }); }
    else if (q.type === "number") { v = raw === "" || raw == null ? "" : String(Number(raw)); if (v !== "" && v === "NaN") return json(422, { ok: false, error: "Please enter a number for: " + q.label }); }
    else if (q.type === "date") { v = clean(raw, 10); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v as string)) return json(422, { ok: false, error: "Please enter a date for: " + q.label }); }
    else v = clean(raw, q.type === "textarea" ? 2000 : 300);
    if (q.required && (v === "" || v === null || v === false)) return json(422, { ok: false, error: "Please answer: " + q.label });
    answers[q.id] = v;
    if (v !== "" && v !== null) lines.push(`${q.label}: ${v === true ? "Yes" : v}`);
  }
  const summary = lines.join("\n") || "(no extra questions)";
  const keep = new Date(Date.now() + 730 * 864e5).toISOString().slice(0, 10);
  const { data: row, error } = await db.from("form_submissions").insert({ form_id: formId, data: { full_name: name, email, phone, form_title: form.title, answers, summary }, consent: {}, utm: {}, source_url: clean(b.source, 300), ip_hash: ipHash, status: "new", delete_after: keep }).select("id").single();
  if (error) return json(500, { ok: false, error: "Something went wrong. Please try again or email info@mygymlondon.co.uk." });

  const send = async (template: string, to: string | undefined, vars: Record<string, string>, key: string) => {
    try {
      await fetch(Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-email", { method: "POST", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" }, body: JSON.stringify({ template, ...(to ? { to } : {}), vars, dedupe_key: key }) });
    } catch (_e) { /* the message is already stored; a missing email never loses it */ }
  };
  if (form.notify_staff) await send("admin-new-enquiry", undefined, { form_name: form.title, message: summary, person_email: email, person_name: name, person_phone: phone || "-", source_page: clean(b.source, 200) || "Your form: " + slug }, `cform:${row.id}:staff`);
  if (form.autoreply) await send("enquiry-autoreply", email, { first_name: name.split(/\s+/)[0] || "there", message_preview: summary.slice(0, 200) }, `cform:${row.id}:reply`);
  return json(200, { ok: true, success: form.success });
});
