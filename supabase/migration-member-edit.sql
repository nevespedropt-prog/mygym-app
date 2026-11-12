-- APPLIED to the live database 2026-11-13 (project ldmksxyilykyfnqnuytv). Safe to re-run.
-- Editing a member from the back office (edge function admin-edit-member): the member profile now carries each membership's Wix order id,
-- and the function can look an email up to an app account without listing every user.
do $$
declare d text;
begin
  d := pg_get_functiondef('public._member_profile_core(text)'::regprocedure);
  if position('''id'', o.order_id' in d) = 0 then
    d := replace(d, 'jsonb_build_object(''plan'', o.plan_name,', 'jsonb_build_object(''id'', o.order_id, ''plan'', o.plan_name,');
    if position('''id'', o.order_id' in d) = 0 then raise exception 'replace failed'; end if;
    execute d;
  end if;
end $$;
create or replace function public._uid_by_email(p_email text) returns uuid language sql stable security definer set search_path to 'public', 'auth', 'pg_temp' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke all on function public._uid_by_email(text) from public, anon, authenticated;
grant execute on function public._uid_by_email(text) to service_role;
notify pgrst, 'reload schema';
