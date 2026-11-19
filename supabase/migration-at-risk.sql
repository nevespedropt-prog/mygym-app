-- MY GYM London: who and what is at risk, for the back office dashboard. Written 2026-11-19.
-- Not training lately (active plan, no booking for 21+ days), plans ending in the next 14 days, payments that are failing.
-- Built on the same member list the Members page uses, so the numbers always match it. Read only (admin, manager, reception).
create or replace function public.admin_at_risk() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']); d jsonb := public._member_directory_core(5000);
begin
  return jsonb_build_object(
    'lapsed', coalesce((select jsonb_agg(jsonb_build_object('name', x->>'name', 'email', x->>'email', 'phone', x->>'phone', 'plan', x->>'plan', 'last_booking', x->>'last_booking') order by x->>'last_booking' nulls first)
        from (select x from jsonb_array_elements(d) x where (x->>'lapsed')::boolean and x->>'plan_type' is distinct from 'payg' limit 40) q), '[]'::jsonb),
    'ending', coalesce((select jsonb_agg(jsonb_build_object('name', x->>'name', 'email', x->>'email', 'phone', x->>'phone', 'plan', x->>'plan', 'ends', x->>'ends') order by x->>'ends')
        from (select x from jsonb_array_elements(d) x where x->>'status' = 'active' and x->>'plan_type' is distinct from 'payg' and nullif(x->>'ends', '') is not null
              and (x->>'ends')::timestamptz between now() and now() + interval '14 days' limit 40) q), '[]'::jsonb),
    'failed', coalesce((select jsonb_agg(jsonb_build_object('name', x->>'name', 'email', x->>'email', 'phone', x->>'phone', 'plan', x->>'plan', 'amount', x->>'amount'))
        from (select x from jsonb_array_elements(d) x where x->>'status' = 'failed' limit 40) q), '[]'::jsonb));
end $$;
revoke all on function public.admin_at_risk() from public, anon;
grant execute on function public.admin_at_risk() to authenticated;
notify pgrst, 'reload schema';
