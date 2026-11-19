-- MY GYM London: membership hub data for the app (written and applied 2026-11-19 after owner approval, tested first inside a rolled-back transaction).
-- Adds member_since and usage (visits this month, last 30 days, last visit, next booking) to my_membership(). Read only.
-- Also lets the app record the news-and-offers wording shown at sign-up (soft opt-in: ticked by default, switch off any time).
create or replace function public.my_membership() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare e text; o record; q public.membership_requests; nxt date; nb record;
begin
  select lower(email) into e from auth.users where id = auth.uid();
  if e is null then raise exception 'Please sign in.'; end if;
  select * into o from public.wix_orders w where lower(w.email) = e and w.status in ('ACTIVE', 'PAUSED')
    order by (w.status = 'ACTIVE') desc, w.cycle_started desc nulls last limit 1;
  if found and o.cycle_unit in ('MONTH', 'WEEK', 'YEAR') and o.cycle_started is not null and o.status = 'ACTIVE' then
    nxt := (o.cycle_started::date + (case o.cycle_unit when 'MONTH' then interval '1 month' when 'WEEK' then interval '1 week' else interval '1 year' end))::date;
    while nxt <= current_date loop nxt := (nxt + (case o.cycle_unit when 'MONTH' then interval '1 month' when 'WEEK' then interval '1 week' else interval '1 year' end))::date; end loop;
    if o.end_date is not null and nxt > o.end_date::date then nxt := null; end if;
  end if;
  select * into q from public.membership_requests where email = e order by created_at desc limit 1;
  select cb.date, c.name, c.start_time into nb from public.class_bookings cb join public.classes c on c.id = cb.class_id
    where cb.user_id = auth.uid() and cb.date::date >= current_date order by cb.date::date, c.start_time limit 1;
  return jsonb_build_object(
    'plan', case when o.order_id is null then null else jsonb_build_object('order_id', o.order_id, 'name', o.plan_name, 'status', lower(o.status), 'amount', o.amount, 'unit', o.cycle_unit, 'started', o.cycle_started,
       'ends', o.end_date, 'cancelling', o.auto_renew_canceled, 'next_payment', nxt, 'payment_failed', (o.last_payment_status = 'FAILED' or o.failed_since is not null), 'type', public._plan_type(o.plan_name)) end,
    'member_since', case when o.order_id is null then null else coalesce(o.member_since, o.cycle_started) end,
    'usage', jsonb_build_object(
      'month', (select count(*) from public.class_bookings where user_id = auth.uid() and date::date >= date_trunc('month', current_date)::date and date::date <= current_date),
      'd30', (select count(*) from public.class_bookings where user_id = auth.uid() and date::date > current_date - 30 and date::date <= current_date),
      'last_visit', (select max(date::date) from public.class_bookings where user_id = auth.uid() and date::date <= current_date),
      'next', case when nb.date is null then null else jsonb_build_object('date', nb.date, 'name', nb.name, 'time', nb.start_time) end),
    'credits', coalesce((select sum(credits) from public.class_credits where email = e and status = 'available' and (expires_at is null or expires_at >= now())), 0),
    'request', case when q.id is null then null else public._mreq_json(q) end);
end $$;


create or replace function public.set_my_marketing_consent(p_on boolean, p_source text default 'app-profile') returns boolean
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_email text; v_src text := case when p_source in ('app-signup', 'app-profile') then p_source else 'app-profile' end;
  v_words text := case when p_source = 'app-signup' then 'Keep me posted with news and offers from MY GYM London by email. I can switch this off any time in Account > Settings.' else 'News and offers from MY GYM London' end;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'no email'; end if;
  if p_on then
    insert into public.marketing_consent (email, user_id, source, wording, requested_at, confirmed_at, withdrawn_at)
    values (v_email, auth.uid(), v_src, v_words, now(), now(), null)
    on conflict (email) do update set user_id = auth.uid(), source = v_src, wording = excluded.wording, requested_at = now(), confirmed_at = now(), withdrawn_at = null;
  else
    insert into public.marketing_consent (email, user_id, source, wording, withdrawn_at)
    values (v_email, auth.uid(), v_src, 'Switched off in the app', now())
    on conflict (email) do update set withdrawn_at = now();
  end if;
  return public.my_marketing_consent();
end $$;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;
notify pgrst, 'reload schema';
