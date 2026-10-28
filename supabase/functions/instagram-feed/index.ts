// MY GYM London: gives the website the latest Instagram posts (read only, public). Written 2026-10-28, NOT deployed yet. Verify JWT is OFF.
// Returns up to 6 posts: link, picture and a short caption. Cached for 30 minutes. If there are none, the website keeps showing its own photos.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = ["https://www.mygymlondon.co.uk", "https://mygymlondon.co.uk", "http://localhost:8658"];
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ALLOWED.includes(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : ALLOWED[0],
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, x-client-info", "Vary": "Origin",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors(req) });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data } = await db.from("instagram_posts").select("id, permalink, image_url, caption, media_type, posted_at").order("posted_at", { ascending: false }).limit(6);
  return new Response(JSON.stringify({ posts: data ?? [] }), { headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" } });
});
