// Makes ONE pasteable file per function (the Supabase dashboard editor takes one file easily): lib.js + logic.ts + index.ts joined, with the local imports removed.
// Usage: node supabase/shared/single.mjs   (run bundle.mjs first)   ->  supabase/functions/<name>/deploy.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "functions");
for (const name of ["submit-form", "send-email", "marketing-consent", "admin-class-cancelled"]) {
  const dir = resolve(root, name);
  const parts = [];
  if (existsSync(resolve(dir, "lib.js"))) parts.push("// ---- shared library (generated) ----\n" + readFileSync(resolve(dir, "lib.js"), "utf8").replace(/^export\s+/gm, ""));
  if (existsSync(resolve(dir, "logic.ts"))) {
    const logic = readFileSync(resolve(dir, "logic.ts"), "utf8").replace(/^import .*\.\/lib\.js";\s*$/gm, "").replace(/^export\s+/gm, "");
    parts.push("// ---- logic ----\n" + logic);
  }
  let index = readFileSync(resolve(dir, "index.ts"), "utf8");
  const npmImports = index.match(/^import .*npm:.*$/gm) ?? [];
  index = index.replace(/^import .*$/gm, "").replace(/\(await import\("\.\/lib\.js"\)\)\./g, "");
  const out = npmImports.join("\n") + "\n" + parts.join("\n") + "\n// ---- function ----\n" + index;
  writeFileSync(resolve(dir, "deploy.ts"), out);
  // syntax check: strip types, then parse as a module
  const stripped = stripTypeScriptTypes(out.replace(/^import .*npm:.*$/gm, "const createClient = () => ({});"));
  new Function("return 0;"); // keep linter quiet
  try { new (Object.getPrototypeOf(async function () {}).constructor)(stripped.replace(/^\s*Deno\.serve/m, "void 0;Deno.serve")); } catch (e) { if (!/await|import|export/.test(String(e.message))) { console.log(name, "SYNTAX PROBLEM:", e.message); process.exit(1); } }
  console.log(name, "->", out.length, "chars");
}
