// Turns a form definition (forms.mjs) into clean, accessible HTML for the website or app.
// Every input has a visible label, errors are announced to screen readers, tick boxes are never pre-ticked,
// and a hidden "honeypot" field catches simple bots. Styling lives in forms.css (the website's look).
import F from "./forms.mjs";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function field(form, fld) {
  const id = `${form.id}-${fld.id}`, req = fld.required ? " required aria-required=\"true\"" : "";
  const help = fld.help ? `<p class="help" id="${id}-help">${esc(fld.help)}</p>` : "";
  const desc = fld.help ? ` aria-describedby="${id}-help"` : "";
  const max = fld.max ? ` maxlength="${fld.max}"` : "";
  const ac = fld.autocomplete ? ` autocomplete="${fld.autocomplete}"` : "";
  const label = `<label for="${id}">${esc(fld.label)}${fld.required ? ' <span class="req" aria-hidden="true">*</span>' : ""}</label>`;
  switch (fld.type) {
    case "hidden": return `<input type="hidden" name="${fld.id}" id="${id}">`;
    case "textarea": return `<div class="field">${label}<textarea name="${fld.id}" id="${id}" rows="${fld.rows || 4}"${max}${req}${desc}></textarea>${help}</div>`;
    case "select": {
      const opts = fld.options ? fld.options.map((o) => `<option>${esc(o)}</option>`).join("") : "";
      const src = fld.optionsFrom ? ` data-options-from="${fld.optionsFrom}"` : "";
      return `<div class="field">${label}<select name="${fld.id}" id="${id}"${src}${req}${desc}><option value="">Choose…</option>${opts}</select>${help}</div>`;
    }
    case "radio": return `<fieldset class="field group"><legend>${esc(fld.label)}${fld.required ? ' <span class="req" aria-hidden="true">*</span>' : ""}</legend>${fld.options.map((o, i) => `<label class="opt"><input type="radio" name="${fld.id}" value="${esc(o)}"${i === 0 && fld.required ? " required" : ""}> <span>${esc(o)}</span></label>`).join("")}</fieldset>`;
    case "checkbox-group": return `<fieldset class="field group">${fld.label ? `<legend>${esc(fld.label)}</legend>` : ""}${fld.options.map((o) => `<label class="opt"><input type="checkbox" name="${fld.id}" value="${esc(o)}"> <span>${esc(o)}</span></label>`).join("")}</fieldset>`;
    case "rating": return `<fieldset class="field group rating"><legend>${esc(fld.label)} <span class="req" aria-hidden="true">*</span></legend><div class="stars">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="${fld.id}" id="${id}-${n}" value="${n}"${n === 5 ? " required" : ""}><label for="${id}-${n}" title="${n} out of 5"><span class="sr">${n} out of 5</span>★</label>`).join("")}</div></fieldset>`;
    case "date": {
      const lim = [fld.minDays !== undefined ? ` data-min-days="${fld.minDays}"` : "", fld.maxDays !== undefined ? ` data-max-days="${fld.maxDays}"` : "", fld.ageMin !== undefined ? ` data-age-min="${fld.ageMin}" data-age-max="${fld.ageMax}"` : ""].join("");
      return `<div class="field">${label}<input type="date" name="${fld.id}" id="${id}"${lim}${req}${desc}>${help}</div>`;
    }
    default: return `<div class="field">${label}<input type="${fld.type}" name="${fld.id}" id="${id}"${max}${ac}${fld.type === "tel" ? ' inputmode="tel"' : ""}${req}${desc}>${help}</div>`;
  }
}

export function renderForm(form) {
  const consents = (form.consents || []).map((c) => `<label class="opt consent"><input type="checkbox" name="consent_${c.id}" value="1"${c.required ? " required aria-required=\"true\"" : ""}> <span>${esc(c.text)}${c.required ? ' <span class="req" aria-hidden="true">*</span>' : ""}</span></label>`).join("");
  return `<form class="mgl-form" data-form="${form.id}" data-min-seconds="${form.minSeconds}" method="post" action="#" novalidate>
  <h2>${esc(form.title)}</h2>
  <p class="intro">${esc(form.intro)}</p>
  ${form.fields.map((f) => field(form, f)).join("\n  ")}
  <div class="hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="${form.honeypot}" tabindex="-1" autocomplete="off"></label></div>
  ${consents ? `<div class="consents">${consents}</div>` : ""}
  <p class="privacy">${form.privacy}</p>
  <button type="submit" class="btn">${form.id === "feedback" ? "Send feedback" : form.id === "refer-a-friend" ? "Send invite" : form.id === "newsletter-signup" ? "Sign me up" : "Send"}</button>
  <p class="status" role="status" aria-live="polite" data-success="${esc(form.success)}"${form.successHigh ? ` data-success-high="${esc(form.successHigh)}"` : ""}></p>
</form>`;
}

export const forms = F;
export const catalog = () => F.map((f) => ({ id: f.id, title: f.title, where: f.where, requiresLogin: f.requiresLogin, sensitive: f.sensitive, fields: f.fields.filter((x) => x.type !== "hidden").map((x) => ({ id: x.id, type: x.type, required: !!x.required })), consents: (f.consents || []).map((c) => ({ id: c.id, required: c.required })), notify: f.notify || null, autoreply: f.autoreply || null, sendsTo: f.sendsTo || null, afterConfirm: f.afterConfirm || null, retentionDays: f.retentionDays, rateLimit: f.rateLimit }));
