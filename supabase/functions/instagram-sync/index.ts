// MY GYM London: copies the latest Instagram posts into the database so the website can show them. Written 2026-10-28, NOT deployed yet.
// Runs every 6 hours from a database schedule (x-cron-secret header = CRON_SECRET). Verify JWT is OFF.
// Needs the secret INSTAGRAM_TOKEN: a long-lived token from the Instagram API with Instagram Login (the owner makes it in Meta for Developers and pastes it into Supabase Secrets).
// The token lasts 60 days; this function renews it when it has under 20 days left and keeps the newest token in the table instagram_token.
import { createClient } from "npm:@supabase/supabase-js@2";

const GRAPH = "https://graph.instagram.com";
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const want = Deno.env.get("CRON_SECRET") ?? "";
  if (want && req.headers.get("x-cron-secret") !== want) return json(401, { ok: false });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // 0. ALTERNATIVE SOURCE: a Behold feed (behold.so) instead of our own Instagram token. Set the secret BEHOLD_FEED_URL (the JSON feed address from Behold) to use it.
  const beholdUrl = Deno.env.get("BEHOLD_FEED_URL") ?? "";
  if (beholdUrl) {
    const r0 = await fetch(beholdUrl); const j0 = await r0.json().catch(() => ({}));
    const list: any[] = Array.isArray(j0) ? j0 : Array.isArray(j0.posts) ? j0.posts : [];
    const rows0 = list.map((m: any) => ({
      id: String(m.id), permalink: String(m.permalink ?? ""), image_url: String(m.mediaType === "VIDEO" ? (m.thumbnailUrl ?? "") : (m.sizes?.medium?.mediaUrl ?? m.mediaUrl ?? "")),
      media_type: String(m.mediaType ?? "IMAGE"), caption: String(m.caption ?? "").slice(0, 300), posted_at: m.timestamp ?? null, updated_at: new Date().toISOString(),
    })).filter((x) => x.permalink && x.image_url);
    if (!r0.ok || !rows0.length) {
      await db.from("sync_log").upsert({ id: "instagram", last_run: new Date().toISOString(), last_result: { ok: false, source: "behold", status: r0.status } });
      return json(502, { ok: false, reason: "Could not read the Behold feed" });
    }
    await db.from("instagram_posts").upsert(rows0);
    await db.from("instagram_posts").delete().not("id", "in", `(${rows0.map((x) => `"${x.id}"`).join(",")})`);
    await db.from("sync_log").upsert({ id: "instagram", last_run: new Date().toISOString(), last_result: { ok: true, source: "behold", posts: rows0.length } });
    return json(200, { ok: true, source: "behold", posts: rows0.length });
  }

  // 1. the token: newest saved one, else the one the owner pasted into Secrets
  const { data: saved } = await db.from("instagram_token").select("token, expires_at").eq("id", 1).maybeSingle();
  let token = saved?.token ?? Deno.env.get("INSTAGRAM_TOKEN") ?? "";
  if (!token) return json(200, { ok: false, reason: "No INSTAGRAM_TOKEN yet. Nothing to do." });
  let expires = saved?.expires_at ? new Date(saved.expires_at).getTime() : 0;

  // 2. renew when it is close to expiry (or when we do not know yet)
  if (!expires || expires - Date.now() < 20 * 864e5) {
    const r = await fetch(`${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.access_token) {
      token = j.access_token; expires = Date.now() + (Number(j.expires_in) || 5184000) * 1000;
      await db.from("instagram_token").upsert({ id: 1, token, expires_at: new Date(expires).toISOString(), refreshed_at: new Date().toISOString() });
    } else if (!expires) {
      await db.from("sync_log").upsert({ id: "instagram", last_run: new Date().toISOString(), last_result: { ok: false, what: "token refresh failed", status: r.status } });
      return json(502, { ok: false, reason: "Token refresh failed" });
    }
  }

  // 3. the latest posts
  const r = await fetch(`${GRAPH}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=12&access_token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !Array.isArray(j.data)) {
    await db.from("sync_log").upsert({ id: "instagram", last_run: new Date().toISOString(), last_result: { ok: false, what: "media fetch failed", status: r.status } });
    return json(502, { ok: false, reason: "Could not read Instagram" });
  }
  const rows = j.data.filter((m: any) => m.permalink && (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url)).map((m: any) => ({
    id: String(m.id), permalink: String(m.permalink), image_url: String(m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url),
    media_type: String(m.media_type), caption: String(m.caption ?? "").slice(0, 300), posted_at: m.timestamp, updated_at: new Date().toISOString(),
  }));
  if (rows.length) {
    await db.from("instagram_posts").upsert(rows);
    await db.from("instagram_posts").delete().not("id", "in", `(${rows.map((x: any) => `"${x.id}"`).join(",")})`);
  }
  await db.from("sync_log").upsert({ id: "instagram", last_run: new Date().toISOString(), last_result: { ok: true, posts: rows.length, token_days_left: Math.round((expires - Date.now()) / 864e5) } });
  return json(200, { ok: true, posts: rows.length });
});
