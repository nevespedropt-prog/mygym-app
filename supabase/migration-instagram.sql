-- MY GYM London: Instagram feed for the website. Written 2026-10-28. Tables APPLIED 2026-10-28; functions instagram-sync / instagram-feed and the schedule wait for the owner's Instagram token.
-- Both tables are closed to everyone except the two functions (row security on, no policies).
create table if not exists public.instagram_posts (
  id text primary key, permalink text not null, image_url text not null, media_type text, caption text, posted_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.instagram_token (
  id integer primary key check (id = 1), token text not null, expires_at timestamptz, refreshed_at timestamptz
);
alter table public.instagram_posts enable row level security;
alter table public.instagram_token enable row level security;
revoke all on public.instagram_posts, public.instagram_token from anon, authenticated;

-- RUN THIS ONLY AFTER the INSTAGRAM_TOKEN secret is saved and both functions are deployed (copies the secret header from the timetable job, same as the other background jobs):
-- select cron.schedule('instagram-sync', '15 */6 * * *', replace((select command from cron.job where jobname = 'sync-timetable'), '/functions/v1/sync-timetable', '/functions/v1/instagram-sync'));
-- To stop it:  select cron.unschedule('instagram-sync');
