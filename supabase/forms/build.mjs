// Builds ready-to-paste HTML for every form, a catalog, and a preview gallery. Run: node supabase/forms/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forms, renderForm, catalog } from "./render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
fs.rmSync(path.join(here, "html"), { recursive: true, force: true });
fs.mkdirSync(path.join(here, "html"), { recursive: true });
for (const f of forms) fs.writeFileSync(path.join(here, `html/${f.id}.html`), renderForm(f) + "\n");
fs.writeFileSync(path.join(here, "catalog.json"), JSON.stringify(catalog(), null, 2) + "\n");

const prev = path.resolve(here, "../../../website-redesign/form-previews");
fs.mkdirSync(path.join(prev, "fonts"), { recursive: true });
const appDir = path.resolve(here, "../..");
for (const f of ["barlow-condensed-700.woff2", "barlow-condensed-800.woff2"]) fs.copyFileSync(path.join(appDir, "fonts", f), path.join(prev, "fonts", f));
fs.copyFileSync(path.join(here, "forms.css"), path.join(prev, "forms.css"));
fs.copyFileSync(path.join(here, "forms.js"), path.join(prev, "forms.js"));
const nav = forms.map((f, i) => `<button data-i="${i}">${f.title}<small>${f.where}${f.requiresLogin ? " · members only" : ""}</small></button>`).join("");
const panes = forms.map((f, i) => `<section data-i="${i}" hidden>${renderForm(f)}<p class="meta">Sent to the gym as: <b>${f.notify || "none"}</b> · to the person: <b>${f.autoreply || f.sendsTo || "none"}</b> · kept for ${f.retentionDays} days</p></section>`).join("\n");
const page = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MY GYM London: form previews</title><link rel="stylesheet" href="forms.css">
<style>@font-face{font-family:"Barlow Condensed";font-weight:800;src:url(fonts/barlow-condensed-800.woff2) format("woff2")}@font-face{font-family:"Barlow Condensed";font-weight:700;src:url(fonts/barlow-condensed-700.woff2) format("woff2")}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 Inter,-apple-system,Segoe UI,Arial,sans-serif;background:#f6f5f4;display:grid;grid-template-columns:320px 1fr;min-height:100vh}
nav{background:#fff;border-right:1px solid #e6e4e4;padding:16px 0;position:sticky;top:0;height:100vh;overflow:auto}nav h1{font:800 22px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:0 18px 12px}
nav button{display:block;width:100%;text-align:left;background:none;border:0;border-left:3px solid transparent;padding:9px 18px;cursor:pointer;font:600 14px inherit}nav button small{display:block;font-weight:400;color:#62616a;font-size:12px}nav button.on{background:#fdecec;border-left-color:#e03939}
main{padding:28px 20px}.meta{max-width:560px;margin:14px auto 0;color:#62616a;font-size:12.5px;text-align:center}@media(max-width:800px){body{grid-template-columns:1fr}nav{position:static;height:auto;max-height:220px}}</style></head><body>
<nav><h1>Forms</h1>${nav}</nav><main>${panes}</main>
<script>window.MGL_FORMS={endpoint:"about:blank"};
const b=[...document.querySelectorAll("nav button")],s=[...document.querySelectorAll("main section")];function show(i){b.forEach((x,k)=>x.classList.toggle("on",k===i));s.forEach((x,k)=>x.hidden=k!==i)}b.forEach((x,i)=>x.onclick=()=>show(i));show(0);
document.addEventListener("submit",e=>{e.preventDefault();e.stopImmediatePropagation();const f=e.target;if(!f.checkValidity()){f.reportValidity();return}const st=f.querySelector(".status");st.textContent=st.dataset.success+" (preview only, nothing was sent)";st.className="status ok"},true);</script>
<script src="forms.js"></script></body></html>`;
fs.writeFileSync(path.join(prev, "index.html"), page);
console.log("built", forms.length, "forms ->", path.join(here, "html"), "and", path.join(prev, "index.html"));
