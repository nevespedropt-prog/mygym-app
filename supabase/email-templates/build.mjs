// Builds the files from the definitions. Run: node supabase/email-templates/build.mjs
//   html/<id>.html  and  text/<id>.txt : the email with the global details filled in and {{member_specific}} variables left in place
//   catalog.json                       : every email, who gets it, when, and which variables it needs
//   ../../../website-redesign/email-previews/ : a gallery you can open in a browser to look at every email with sample values
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render, templates, catalog } from "./render.mjs";
import { SAMPLE } from "./sample.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (p) => path.join(here, p);
for (const d of ["html", "text"]) { fs.rmSync(out(d), { recursive: true, force: true }); fs.mkdirSync(out(d), { recursive: true }); }

for (const d of templates) {
  const r = render(d.id, {}, { keep: true });
  fs.writeFileSync(out(`html/${d.id}.html`), r.html);
  fs.writeFileSync(out(`text/${d.id}.txt`), r.text);
}
fs.writeFileSync(out("catalog.json"), JSON.stringify(catalog(), null, 2) + "\n");

// preview gallery (for people, not for sending): every email rendered with the sample values
const prev = path.resolve(here, "../../../website-redesign/email-previews");
fs.mkdirSync(prev, { recursive: true });
// the gallery uses local copies of the fonts and logo so it works offline
const appDir = path.resolve(here, "../..");
fs.mkdirSync(path.join(prev, "fonts"), { recursive: true }); fs.mkdirSync(path.join(prev, "icons"), { recursive: true });
for (const f of ["barlow-condensed-700.woff2", "barlow-condensed-800.woff2"]) fs.copyFileSync(path.join(appDir, "fonts", f), path.join(prev, "fonts", f));
fs.copyFileSync(path.join(appDir, "icons/logo-header.png"), path.join(prev, "icons/logo-header.png"));
const items = templates.map((d) => { const r = render(d.id, { ...SAMPLE, assets_url: "./" }); return { id: d.id, group: d.group, to: d.to, marketing: d.marketing, when: d.when, subject: r.subject, html: r.html, text: r.text }; });
const groups = [...new Set(items.map((i) => i.group))];
const page = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MY GYM London: email previews</title>
<style>
@font-face{font-family:"Barlow Condensed";font-weight:800;src:url(fonts/barlow-condensed-800.woff2) format("woff2")}
*{box-sizing:border-box;margin:0;padding:0}body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f5f4;color:#17171a;display:grid;grid-template-columns:330px 1fr;height:100vh}
aside{background:#fff;border-right:1px solid #e6e4e4;overflow:auto;padding:16px 0}aside h1{font:800 22px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:0 18px 4px}aside p.s{padding:0 18px 12px;color:#62616a;font-size:12.5px}
aside h2{font:800 13px "Barlow Condensed",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#9a99a1;padding:14px 18px 6px}
aside button{display:block;width:100%;text-align:left;background:none;border:0;border-left:3px solid transparent;padding:8px 18px;cursor:pointer;font:inherit}aside button:hover{background:#faf9f8}aside button.on{background:#fdecec;border-left-color:#e03939;font-weight:650}
aside button small{display:block;color:#62616a;font-weight:400;font-size:12px}
main{display:flex;flex-direction:column;min-width:0}.bar{display:flex;gap:10px;align-items:center;padding:12px 18px;background:#fff;border-bottom:1px solid #e6e4e4;flex-wrap:wrap}.bar b{font-size:15px;flex:1;min-width:200px}
.bar button{border:1px solid #e6e4e4;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit;font-weight:600}.bar button.on{background:#e03939;border-color:#e03939;color:#fff}
.stage{flex:1;overflow:auto;padding:22px;display:flex;justify-content:center;align-items:flex-start}iframe{border:0;background:#fff;box-shadow:0 8px 30px rgba(20,20,25,.15);width:680px;height:2000px;border-radius:4px;transition:width .2s}iframe.m{width:390px}
pre{background:#fff;padding:24px;border-radius:8px;white-space:pre-wrap;font:13px/1.6 ui-monospace,Consolas,monospace;max-width:720px;box-shadow:0 8px 30px rgba(20,20,25,.1)}
@media(max-width:800px){body{grid-template-columns:1fr;height:auto}aside{max-height:240px}iframe{width:100%}}
</style></head><body>
<aside><h1>Emails</h1><p class="s">${items.length} emails, sample data. Click one to see it.</p><div id="list"></div></aside>
<main><div class="bar"><b id="sub"></b><button id="bd" class="on">Desktop</button><button id="bm">Phone</button><button id="bt">Plain text</button></div><div class="stage" id="stage"></div></main>
<script>
const items=${JSON.stringify(items).replace(/</g, "\\u003c")};const groups=${JSON.stringify(groups)};let cur=0,mode="d";
const list=document.getElementById("list");
groups.forEach(g=>{const h=document.createElement("h2");h.textContent=g;list.appendChild(h);items.forEach((it,i)=>{if(it.group!==g)return;const b=document.createElement("button");b.dataset.i=i;b.innerHTML=it.id.replace(/-/g," ")+"<small>"+({member:"to the member",lead:"to a visitor",admin:"to the gym",auth:"sign-in email"}[it.to])+(it.marketing?" · marketing":"")+"</small>";b.onclick=()=>{cur=i;show()};list.appendChild(b)})});
function show(){document.querySelectorAll("aside button").forEach(b=>b.classList.toggle("on",+b.dataset.i===cur));const it=items[cur];document.getElementById("sub").textContent="Subject: "+it.subject;const st=document.getElementById("stage");st.innerHTML="";
if(mode==="t"){const p=document.createElement("pre");p.textContent=it.text;st.appendChild(p)}else{const f=document.createElement("iframe");f.srcdoc=it.html;f.className=mode==="m"?"m":"";f.onload=()=>{f.style.height=f.contentDocument.documentElement.scrollHeight+"px"};st.appendChild(f)}
["bd","bm","bt"].forEach(id=>document.getElementById(id).classList.toggle("on",{bd:"d",bm:"m",bt:"t"}[id]===mode))}
document.getElementById("bd").onclick=()=>{mode="d";show()};document.getElementById("bm").onclick=()=>{mode="m";show()};document.getElementById("bt").onclick=()=>{mode="t";show()};show();
</script></body></html>`;
fs.writeFileSync(path.join(prev, "index.html"), page);
console.log("built", templates.length, "emails ->", out("html"), "and the gallery at", path.join(prev, "index.html"));
