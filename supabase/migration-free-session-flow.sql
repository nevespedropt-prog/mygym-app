-- MY GYM London: free class / free gym session for new accounts, shown on the member's own dashboard (written 2026-11-20).
-- 1. my_free_class_eligible(): a signed-in account that has never had a membership or a paid booking gets 2 free sessions in total (any mix of classes and gym sessions;
--    one session = one credit). It says how many are left and how many requests are waiting.
-- 2. my_free_requests(): the member's own free-session requests and what happened to them (requested, booked, done, closed), for the dashboard.
-- The request itself goes through the existing website form back end (trial-class / trial-gym), so the owner sees it in the back office
-- (Overview > To do and Free trials) exactly like a request made on the website form.
create or replace function public.my_free_class_eligible() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); e text; paid boolean; used int; pend int;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into e from auth.users where id = uid;
  -- anyone who has ever had a membership or a paid or booked class is an existing customer, not a newcomer
  paid := exists (select 1 from public.wix_orders o where lower(o.email) = e)
       or exists (select 1 from public.class_bookings b where b.user_id = uid)
       or exists (select 1 from public.walkin_bookings w where lower(w.email) = e and w.kind is distinct from 'trial');
  -- two free sessions in total: any mix of classes and gym sessions (a declined request does not use one)
  used := greatest(
    (select count(*) from public.form_submissions f where f.form_id in ('trial-class', 'trial-gym') and lower(f.data->>'email') = e and f.status not in ('spam', 'not_now')),
    (select count(*) from public.free_trials t where lower(t.email) = e));
  pend := (select count(*) from public.form_submissions f where f.form_id in ('trial-class', 'trial-gym') and lower(f.data->>'email') = e and f.status in ('new', 'contacted'));
  return jsonb_build_object('eligible', not paid and used < 2, 'remaining', case when paid then 0 else greatest(0, 2 - used) end, 'used', used, 'pending', pend, 'used_before', paid);
end $$;

create or replace function public.my_free_requests() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); e text; today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD');
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into e from auth.users where id = uid;
  return coalesce((select jsonb_agg(x order by x->>'sent' desc) from (
    select jsonb_build_object(
      'kind', case when f.form_id = 'trial-gym' then 'gym' else 'class' end,
      'what', case when f.form_id = 'trial-gym' then 'Free gym session' else coalesce(nullif(f.data->>'class', ''), 'Free class') end,
      'date', coalesce(nullif(f.data->>'date', ''), nullif(f.data->>'preferred_date', '')),
      'when', nullif(f.data->>'preferred_time', ''),
      'sent', f.created_at,
      'state', case
        when exists (select 1 from public.free_trials t where lower(t.email) = e and t.walkin_id is not null and t.date = coalesce(nullif(f.data->>'date', ''), nullif(f.data->>'preferred_date', '')))
          then case when coalesce(nullif(f.data->>'date', ''), nullif(f.data->>'preferred_date', '')) >= today then 'booked' else 'done' end
        when f.status = 'not_now' then 'closed'
        else 'requested' end) x
    from public.form_submissions f
    where f.form_id in ('trial-class', 'trial-gym') and lower(f.data->>'email') = e and f.status <> 'spam'
    order by f.created_at desc limit 5) q), '[]'::jsonb);
end $$;

revoke all on function public.my_free_class_eligible() from public, anon;
revoke all on function public.my_free_requests() from public, anon;
grant execute on function public.my_free_class_eligible() to authenticated;
grant execute on function public.my_free_requests() to authenticated;
notify pgrst, 'reload schema';

-- The plans and prices are public (they are on the Services page), so the website sales page and the app can read the same list without signing in.
create or replace function public.public_plans() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'price', price, 'per', per, 'includes', includes) order by sort), '[]'::jsonb) from public.member_plan_options where active;
$$;
revoke all on function public.public_plans() from public;
grant execute on function public.public_plans() to anon, authenticated;

-- 2026-11-21: the website timetable sends the form the team already approves ("free-class": class_name, class_date, class_time), so the same two functions now read it.
create or replace function public.my_free_class_eligible() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); e text; paid boolean; used int; pend int;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into e from auth.users where id = uid;
  paid := exists (select 1 from public.wix_orders o where lower(o.email) = e)
       or exists (select 1 from public.class_bookings b where b.user_id = uid)
       or exists (select 1 from public.walkin_bookings w where lower(w.email) = e and w.kind is distinct from 'trial');
  used := greatest(
    (select count(*) from public.form_submissions f where f.form_id in ('free-class', 'trial-class', 'trial-gym') and lower(f.data->>'email') = e and f.status not in ('spam', 'not_now')),
    (select count(*) from public.free_trials t where lower(t.email) = e));
  pend := (select count(*) from public.form_submissions f where f.form_id in ('free-class', 'trial-class', 'trial-gym') and lower(f.data->>'email') = e and f.status in ('new', 'contacted'));
  return jsonb_build_object('eligible', not paid and used < 2, 'remaining', case when paid then 0 else greatest(0, 2 - used) end, 'used', used, 'pending', pend, 'used_before', paid);
end $$;

create or replace function public.my_free_requests() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); e text; today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD');
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into e from auth.users where id = uid;
  return coalesce((select jsonb_agg(x order by x->>'sent' desc) from (
    select jsonb_build_object(
      'kind', case when q.form_id = 'trial-gym' then 'gym' else 'class' end,
      'what', case when q.form_id = 'trial-gym' then 'Free gym session' else trim(coalesce(nullif(q.data->>'class_name', ''), nullif(q.data->>'class', ''), 'Free class') || ' ' || coalesce(q.data->>'class_time', '')) end,
      'date', q.rd,
      'when', nullif(q.data->>'preferred_time', ''),
      'sent', q.created_at,
      'state', case
        when exists (select 1 from public.free_trials t where lower(t.email) = e and t.walkin_id is not null and t.date = q.rd)
          then case when q.rd >= today then 'booked' else 'done' end
        when q.status = 'not_now' then 'closed'
        else 'requested' end) x
    from (
      select f.form_id, f.data, f.status, f.created_at,
        case when f.form_id = 'trial-gym' then nullif(f.data->>'preferred_date', '')
             when nullif(f.data->>'date', '') is not null then f.data->>'date'
             else (select (case when y.dd < f.created_at::date then y.dd + interval '1 year' else y.dd end)::date::text
                   from (select to_date(m[1] || ' ' || m[2] || ' ' || extract(year from f.created_at)::int, 'DD Mon YYYY') dd
                         from (select regexp_match(coalesce(f.data->>'class_date', ''), '(\d{1,2})\s+([A-Za-z]{3})') m) z where m is not null) y) end rd
      from public.form_submissions f
      where f.form_id in ('free-class', 'trial-class', 'trial-gym') and lower(f.data->>'email') = e and f.status <> 'spam'
      order by f.created_at desc limit 5) q) r), '[]'::jsonb);
end $$;
revoke all on function public.my_free_class_eligible() from public, anon;
revoke all on function public.my_free_requests() from public, anon;
grant execute on function public.my_free_class_eligible() to authenticated;
grant execute on function public.my_free_requests() to authenticated;
notify pgrst, 'reload schema';
