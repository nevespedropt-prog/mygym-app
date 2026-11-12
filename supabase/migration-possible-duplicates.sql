-- APPLIED to the live database 2026-11-13. Safe to re-run.
-- Read-only finder for people who may be in the client list twice (same phone number, or same full name under different emails). Merging is done in Wix.
create or replace function public.admin_possible_duplicates()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare r text := public._need(array['admin', 'manager']);
begin
  return coalesce((
    with c as (
      select lower(w.email) as email,
             coalesce(nullif(trim(w.full_name), ''), trim(coalesce(w.first_name, '') || ' ' || coalesce(w.last_name, ''))) as name, w.phone,
             nullif(right(regexp_replace(coalesce(w.phone, ''), '\D', '', 'g'), 10), '') as ph,
             lower(regexp_replace(coalesce(nullif(trim(w.full_name), ''), trim(coalesce(w.first_name, '') || ' ' || coalesce(w.last_name, ''))), '\s+', ' ', 'g')) as nm,
             (select public._order_status(o.status, o.last_payment_status, o.failed_since) from public.wix_orders o
                where lower(o.email) = lower(w.email) and o.status is distinct from 'DRAFT' order by (o.status = 'ACTIVE') desc, o.cycle_started desc nulls last limit 1) as st
      from public.wix_contacts w where w.email is not null and w.email <> ''
    ), g as (
      select 'phone'::text as kind, ph as k, jsonb_agg(jsonb_build_object('name', name, 'email', email, 'phone', phone, 'status', st) order by email) as people, count(distinct email) as n
        from c where length(coalesce(ph, '')) = 10 group by ph having count(distinct email) > 1
      union all
      select 'name', nm, jsonb_agg(jsonb_build_object('name', name, 'email', email, 'phone', phone, 'status', st) order by email), count(distinct email)
        from c where nm ~ '^\S+ \S+' and length(nm) >= 5 group by nm having count(distinct email) > 1
    )
    select jsonb_agg(jsonb_build_object('kind', kind, 'key', k, 'people', people) order by n desc, kind, k) from (select * from g order by n desc, kind, k limit 150) t
  ), '[]'::jsonb);
end $$;
revoke all on function public.admin_possible_duplicates() from public, anon;
grant execute on function public.admin_possible_duplicates() to authenticated;
notify pgrst, 'reload schema';
