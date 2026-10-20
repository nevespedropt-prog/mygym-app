-- ============================================================
-- MY GYM London: security pass 2 (written 2026-10-20). NOT APPLIED YET.
-- Safe to run more than once. Changes permissions only: no table, row or function body is touched.
-- Run in the Supabase SQL editor (paste the statements only, without these comment lines).
--
-- Why: an outside test found that logged-out visitors can still SELECT from public.email_log (row security hides the
-- rows today, but one mistake would expose them), and that new tables get open permissions by default.
-- To undo: nothing needs undoing; to re-open a table for members, grant the exact privilege it needs.
-- ============================================================

-- 1. Logged-out visitors may only READ the timetable. Nothing else.
revoke all on all tables in schema public from anon;
grant select on public.classes to anon;

-- 2. Signed-in members get no raw access to server-only tables.
revoke all on public.email_log, public.app_flags, public.wix_other_bookings, public.sync_log,
              public.signup_attempts, public.gym_access_plans, public.class_access_plans from authenticated;

-- 3. Tables and functions created in future are closed by default (grant exactly what each one needs).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 4. Server-only functions: nobody but the server can run them.
do $$ declare r record; begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('purge_inactive_health', 'due_class_reminders', 'notify_booking_email', 'enforce_cancel_limit', 'enforce_booking_rules', 'handle_new_user')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);   -- the server (edge functions) keeps access
  end loop;
end $$;

-- ============================================================
-- CHECKS (run each separately, read the result):
--
-- A. Tables with row security OFF (expect: no rows)
--   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
--
-- B. What logged-out visitors can do (expect: one row: classes, SELECT)
--   select table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants
--   where table_schema = 'public' and grantee = 'anon' group by 1;
--
-- C. Functions members or visitors can run (expect: booking_counts and is_admin for authenticated; is_admin may show for anon)
--   select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_can, has_function_privilege('authenticated', p.oid, 'execute') as member_can
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1;
--
-- D. Who is an admin (expect: only the right people)
--   select u.email, p.is_admin from profiles p join auth.users u on u.id = p.id where p.is_admin;
-- ============================================================
