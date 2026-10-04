-- ============================================================
-- MY GYM London: tighten database permissions (defence in depth)
-- Row-level security already decides which rows each member can touch.
-- This also removes permissions the app never uses.
--
-- After this:
--   * logged-out visitors can only READ the class timetable (public.classes)
--   * signed-in members keep read/write on their own data (row security still decides which rows),
--     but can no longer TRUNCATE tables or create triggers/references on them
--   * server-only tables (gym_access_plans, signup_attempts, sync_log) are closed to members completely,
--     and members can only READ their own member_access row
-- The server (service role, used by the Edge Functions) is not affected.
--
-- Run once in: Supabase Dashboard -> SQL Editor. Safe to re-run.
-- UNDO (restores the old, wider permissions):
--   grant all on all tables in schema public to anon, authenticated;
-- Note: tables created in future get Supabase's default grants again; re-run this file after adding tables.
-- ============================================================
begin;

-- logged-out visitors: only the public timetable
revoke all on all tables in schema public from anon;
grant select on public.classes to anon;

-- signed-in members: drop the powers the app never uses
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- server-only tables
revoke all on public.gym_access_plans, public.signup_attempts, public.sync_log from authenticated;
revoke insert, update, delete, truncate on public.member_access from authenticated;

commit;
