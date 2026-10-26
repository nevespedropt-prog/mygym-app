// MY GYM London: turns an email definition (templates.mjs) into subject, plain text and HTML.
// Pure functions, no network, no database: safe to test and to reuse inside an Edge Function.
// Look: the website's style. Barlow Condensed ExtraBold capitals for headings, red band with a slanted edge, red-accent panels,
// dark footer. Table based with inline styles so it renders in Gmail, Apple Mail and Outlook. Headings fall back to Arial Narrow where a client blocks web fonts.
import T from "./templates.mjs";
import { SETTINGS } from "./settings.mjs";

export const GLOBALS = {
  gym_name: "MY GYM London",
  gym_address: "MY GYM London, Main Avenue, Bush Hill Park, Enfield EN1 1DS",
  gym_email: "info@mygymlondon.co.uk",
  app_url: "https://app.mygymlondon.co.uk/",
  site_url: "https://www.mygymlondon.co.uk/",
  assets_url: "https://app.mygymlondon.co.uk/",
  instagram_url: "https://www.instagram.com/mygym_london",
  review_url: "https://search.google.com/local/writereview?placeid=ChIJJQwaPxwfdkgRGf9RbcUzAnA",
  directions_url: "https://maps.app.goo.gl/EhoXHJ5Em9nMYn8U6",
  cancel_minutes: "10",
  reminder_hours: "2",
  // Cancellation and refund wording below is copied from the live Terms (terms.html). Items still to confirm are listed in README.
  business_legal_name: "MyGym London",
  vat_line: "",
  refund_timing: "Refunds usually reach your account within 5 to 10 working days.",
  cancellation_terms: "To cancel, give us at least 1 week's notice before your next billing date.",
  refund_policy: "You can ask for a refund within 1 month of paying. After that, any refund is worked out by taking off the months you have already used.",
};

const C = { red: "#e03939", deep: "#a03535", pink: "#fdecec", ink: "#17171a", mut: "#62616a", line: "#e6e4e4", alt: "#f6f5f4", white: "#ffffff" };
const DISP = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";
const BODY = "Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const VAR = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
export const varsIn = (s) => [...String(s ?? "").matchAll(VAR)].map((m) => m[1]);

/** Replace {{name}} with a value. mode "html" escapes, "text" does not, "keep" leaves unknown ones as they are. */
function fill(str, vars, mode) {
  return String(str ?? "").replace(VAR, (whole, k) => {
    const v = vars[k];
    if (v === undefined || v === null) return whole;
    const s = String(v).replace(/[\r\n]+/g, " ");
    return mode === "html" ? esc(s) : s;
  });
}
const safeUrl = (u) => (/^(https:\/\/|http:\/\/|mailto:|\{\{)/i.test(u) ? u : "#");

/** All variables a template needs from the caller (everything except the global ones). */
export function requiredVars(def) {
  const bits = [def.subject, def.pre, def.title, def.cta?.label, def.cta?.url];
  for (const b of def.body) {
    if (b.p) bits.push(b.p); if (b.h) bits.push(b.h); if (b.note) bits.push(b.note); if (b.muted) bits.push(b.muted);
    if (b.list) bits.push(...b.list); if (b.kv) for (const r of b.kv) bits.push(r[0], r[1]);
  }
  const set = new Set(bits.flatMap(varsIn));
  for (const k of Object.keys(GLOBALS)) set.delete(k);
  return [...set].sort();
}

const hero = (title, kicker) => `
<tr><td style="background:${C.red};padding:34px 32px 30px 32px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid ${C.white};padding:1px 0 1px 11px;font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${C.white}">${esc(kicker)}</td></tr></table>
  <h1 style="margin:14px 0 0 0;font-family:${DISP};font-weight:800;font-size:46px;line-height:46px;letter-spacing:.02em;text-transform:uppercase;color:${C.white}">${title}</h1>
</td></tr>
<tr><td style="line-height:0;font-size:0;background-color:${C.red};background-image:linear-gradient(to bottom right,${C.red} 49.6%,${C.white} 50%);height:26px">&nbsp;</td></tr>`;

const kvTable = (rows) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px 0;background:${C.alt};border-left:4px solid ${C.red}">
<tr><td style="padding:14px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map(([k, v]) => `
<tr><td style="padding:7px 14px 7px 0;width:34%;vertical-align:top;font-family:${BODY};font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.mut}">${k}</td><td style="padding:7px 0;vertical-align:top;font-family:${BODY};font-size:16px;font-weight:600;color:${C.ink};line-height:1.45">${v}</td></tr>`).join("")}
</table></td></tr></table>`;

const button = (label, url) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px 0"><tr>
<td style="background:${C.red};padding:15px 14px 13px 26px"><a href="${esc(safeUrl(url))}" style="font-family:${DISP};font-weight:800;font-size:21px;line-height:21px;letter-spacing:.1em;text-transform:uppercase;color:${C.white};text-decoration:none;display:inline-block">${label} &rarr;</a></td>
<td style="width:0;line-height:0;font-size:0"><div style="width:0;height:0;border-top:51px solid ${C.red};border-right:14px solid ${C.white};line-height:0;font-size:0">&nbsp;</div></td>
</tr></table>`;

function bodyBlocks(def, vars) {
  const f = (s) => fill(s, vars, "html");
  const out = [];
  for (const b of def.body) {
    if (b.if && !String(vars[b.if] ?? "").trim()) continue;
    if (b.p) out.push(`<p style="margin:0 0 16px 0;font-family:${BODY};font-size:16px;line-height:1.65;color:${C.ink}">${f(b.p)}</p>`);
    else if (b.h) out.push(`<h2 style="margin:22px 0 8px 0;font-family:${DISP};font-weight:800;font-size:24px;line-height:26px;letter-spacing:.04em;text-transform:uppercase;color:${C.ink}">${f(b.h)}</h2>`);
    else if (b.kv) {
      const rows = b.kv.filter((r) => !r[2] || String(vars[r[2]] ?? "").trim()).map((r) => [f(r[0]), f(r[1])]);
      if (rows.length) out.push(kvTable(rows));
    } else if (b.note) out.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px 0"><tr><td style="background:${C.pink};border-left:4px solid ${C.deep};padding:15px 18px;font-family:${BODY};font-size:15px;line-height:1.6;color:#5a1f1f">${f(b.note)}</td></tr></table>`);
    else if (b.list) out.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 18px 0">${b.list.map((i) => `<tr><td style="vertical-align:top;padding:5px 12px 5px 0;font-family:${BODY};font-size:16px;line-height:1.6;color:${C.red};font-weight:800">&#9632;</td><td style="padding:5px 0;font-family:${BODY};font-size:16px;line-height:1.6;color:${C.ink}">${f(i)}</td></tr>`).join("")}</table>`);
    else if (b.muted) out.push(`<p style="margin:0 0 14px 0;font-family:${BODY};font-size:13.5px;line-height:1.6;color:${C.mut}">${f(b.muted)}</p>`);
  }
  return out.join("\n");
}

const footer = (def, vars) => {
  const link = (t, u) => `<a href="${esc(u)}" style="color:#ffffff;text-decoration:underline">${t}</a>`;
  const why = def.marketing
    ? `You are receiving this because you agreed to hear from MY GYM London. ${vars.unsubscribe_url ? link("Unsubscribe", vars.unsubscribe_url) + " at any time." : "You can unsubscribe at any time using the link in this email."}`
    : def.to === "admin" ? "This message is for the MY GYM London team." : "This is a service email about your MY GYM London account or booking, so it is sent even if you have unsubscribed from marketing.";
  return `
<tr><td style="background:${C.red};line-height:0;font-size:0;height:5px">&nbsp;</td></tr>
<tr><td style="background:${C.ink};padding:28px 32px">
  <p style="margin:0 0 6px 0;font-family:${DISP};font-weight:800;font-size:22px;letter-spacing:.1em;text-transform:uppercase;color:#ffffff">MY GYM London</p>
  <p style="margin:0 0 14px 0;font-family:${BODY};font-size:13px;line-height:1.6;color:#cfcdd1">${esc(vars.gym_address)}<br>${link(esc(vars.gym_email), "mailto:" + vars.gym_email)}</p>
  <p style="margin:0 0 16px 0;font-family:${BODY};font-size:13px;color:#cfcdd1">${link("Timetable", vars.site_url + "timetable")} &nbsp;&middot;&nbsp; ${link("Memberships", vars.site_url + "memberships")} &nbsp;&middot;&nbsp; ${link("Instagram", vars.instagram_url)}</p>
  <p style="margin:0;font-family:${BODY};font-size:11.5px;line-height:1.6;color:#9a99a1">${why}<br>${esc(vars.business_legal_name)}${vars.vat_line ? ". " + esc(vars.vat_line) : ""}</p>
</td></tr>`;
};

const shell = (def, vars, inner) => `<!doctype html>
<html lang="en-GB" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(fill(def.subject, vars, "text"))}</title>
<style>
@font-face{font-family:'Barlow Condensed';font-weight:800;font-style:normal;src:url(${vars.assets_url}fonts/barlow-condensed-800.woff2) format('woff2')}
@font-face{font-family:'Barlow Condensed';font-weight:700;font-style:normal;src:url(${vars.assets_url}fonts/barlow-condensed-700.woff2) format('woff2')}
body{margin:0;padding:0;background:${C.alt};-webkit-text-size-adjust:100%}
a{color:${C.red}}
@media only screen and (max-width:620px){.wrap{width:100%!important}h1{font-size:38px!important;line-height:38px!important}.pad{padding-left:22px!important;padding-right:22px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.alt}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.alt};font-size:1px;line-height:1px">${esc(fill(def.pre, vars, "text"))}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.alt}"><tr><td align="center" style="padding:22px 12px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.white}">
<tr><td style="padding:18px 32px;background:${C.white}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${vars.assets_url}icons/logo-header.png" width="132" alt="MY GYM London" style="display:block;border:0;height:auto;max-width:132px"></td>
<td align="right" style="vertical-align:middle;font-family:${BODY};font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.mut}">${esc(def.group)}</td></tr></table></td></tr>
${inner}
</table></td></tr></table>
</body></html>`;

/** Render one email. keep = leave {{member_specific}} variables in place (for stored copies); otherwise they must all be supplied. */
export function render(id, given = {}, opts = {}) {
  const def = T.find((x) => x.id === id);
  if (!def) throw new Error("Unknown email: " + id);
  const vars = { ...GLOBALS, ...given };
  const mode = opts.keep ? "keep" : "html";
  const title = fill(def.title, vars, mode === "keep" ? "keep" : "html");
  const inner = `${hero(title, def.group)}
<tr><td class="pad" style="padding:30px 32px 8px 32px;background:${C.white}">
${bodyBlocks(def, vars)}
${def.cta ? button(esc(fill(def.cta.label, vars, "text")), fill(def.cta.url, vars, "text")) : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line};margin-top:6px"><tr><td style="padding:16px 0 22px 0;font-family:${BODY};font-size:13px;line-height:1.6;color:${C.mut}">${def.to === "admin" ? "Reply to this email to answer the person directly." : `Questions? Just reply to this email or write to <a href="mailto:${esc(vars.gym_email)}" style="color:${C.red}">${esc(vars.gym_email)}</a>.`}</td></tr></table>
</td></tr>${footer(def, vars)}`;
  const html = shell(def, vars, inner);
  const subject = fill(def.subject, vars, "text");
  return { subject, html, text: toText(def, vars), id, group: def.group, to: def.to, marketing: def.marketing };
}

function toText(def, vars) {
  const f = (s) => fill(s, vars, "text");
  const L = [f(def.title).toUpperCase(), ""];
  for (const b of def.body) {
    if (b.if && !String(vars[b.if] ?? "").trim()) continue;
    if (b.p) L.push(f(b.p), "");
    else if (b.h) L.push(f(b.h).toUpperCase());
    else if (b.kv) { for (const r of b.kv) if (!r[2] || String(vars[r[2]] ?? "").trim()) L.push(f(r[0]) + ": " + f(r[1])); L.push(""); }
    else if (b.note) L.push(f(b.note), "");
    else if (b.list) { for (const i of b.list) L.push("- " + f(i)); L.push(""); }
    else if (b.muted) L.push(f(b.muted), "");
  }
  if (def.cta) L.push(f(def.cta.label) + ": " + f(def.cta.url), "");
  L.push("MY GYM London", vars.gym_address, vars.gym_email);
  if (def.marketing && vars.unsubscribe_url) L.push("", "Unsubscribe: " + vars.unsubscribe_url);
  return L.join("\n");
}

export const catalog = () => T.map((d) => ({ id: d.id, group: d.group, to: d.to, marketing: d.marketing, when: d.when, subject: d.subject, needs: requiredVars(d), auth: !!d.auth, onAtLaunch: SETTINGS.optional[d.id] !== false, trigger: SETTINGS.triggers[d.id] || null }));
export const templates = T;
