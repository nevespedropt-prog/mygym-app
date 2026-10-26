// Builds the standalone form pages the website embeds (or links to): app/f/<form>.html plus forms.css, forms.js and config.js.
// Run:  node supabase/forms/build-pages.mjs     (rebuild after changing forms.mjs, forms.css or forms.js)
// Public forms only: member forms (feedback, pause/cancel, refer a friend) live inside the app and need a sign-in.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderForm, forms } from "./render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "..", "f");
mkdirSync(out, { recursive: true });

const FONT = `@font-face{font-family:"Barlow Condensed";font-weight:800;font-style:normal;font-display:swap;src:url("../fonts/barlow-condensed-800.woff2") format("woff2")}
@font-face{font-family:"Barlow Condensed";font-weight:700;font-style:normal;font-display:swap;src:url("../fonts/barlow-condensed-700.woff2") format("woff2")}
html,body{margin:0;background:transparent}body{padding:0}
.mgl-form{margin:0 auto}
`;
writeFileSync(resolve(out, "forms.css"), FONT + readFileSync(resolve(here, "forms.css"), "utf8"));
writeFileSync(resolve(out, "forms.js"), readFileSync(resolve(here, "forms.js"), "utf8"));
writeFileSync(resolve(out, "config.js"), `window.MGL_FORMS = { endpoint: "https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/submit-form", supabaseUrl: "https://ldmksxyilykyfnqnuytv.supabase.co", anonKey: "sb_publishable_gboSvVSFxQT0xDSEzbeYxw_E1OO3TRp" };\n`);

const pub = forms.filter((f) => !f.requiresLogin);
for (const f of pub) {
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${f.title} | MY GYM London</title>
<link rel="stylesheet" href="forms.css">
</head>
<body>
${renderForm(f)}
<script src="config.js"></script>
<script src="forms.js"></script>
</body>
</html>
`;
  writeFileSync(resolve(out, f.id + ".html"), html);
}
console.log("wrote", pub.length, "form pages to", out, ":", pub.map((f) => f.id).join(", "));
