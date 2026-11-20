-- MY GYM London: Account page extras (written 2026-11-19, applied 2026-11-20 after owner approval; tested first inside a rolled-back transaction).
-- 1. my_streak(): weeks in a row with at least one session (a class booked and passed, or a workout logged), for the Home strip.
-- 2. my_data_export(): everything the member gave us, as one file, so they can take it with them (UK GDPR access and portability).
-- 3. delete_my_account(): "Delete my account and data". Refuses while there is a live membership, upcoming booking or staff login,
--    so billing and bookings are never left behind. Payment and accounting records stay (tax law), and a withdrawn marketing record
--    stays so nothing is ever sent again. Everything else is deleted.

create or replace function public.my_streak() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); acts date[]; wks date[]; cw date := date_trunc('week', current_date)::date; st date; n int := 0; best int := 0; run int := 0; prev date; w date; lw jsonb := '[]'::jsonb; i int;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  acts := array(select distinct d from (
    select date::date d from public.class_bookings where user_id = uid and date ~ '^\d{4}-\d{2}-\d{2}$' and date::date <= current_date
    union select date::date from public.workout_logs where user_id = uid and date ~ '^\d{4}-\d{2}-\d{2}$' and date::date <= current_date) x);
  wks := array(select distinct date_trunc('week', d)::date from unnest(acts) d order by 1);
  st := case when cw = any(wks) then cw else cw - 7 end;
  while (st - 7 * n) = any(wks) loop n := n + 1; end loop;
  foreach w in array wks loop
    if prev is not null and w = prev + 7 then run := run + 1; else run := 1; end if;
    if run > best then best := run; end if; prev := w;
  end loop;
  for i in reverse 7..0 loop lw := lw || to_jsonb((cw - 7 * i) = any(wks)); end loop;
  return jsonb_build_object('streak', n, 'best', greatest(best, n), 'this_week', cw = any(wks), 'weeks', lw, 'total', coalesce(cardinality(acts), 0),
    'month', (select count(*) from unnest(acts) d where d >= date_trunc('month', current_date)::date));
end $$;

create or replace function public.my_data_export() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); e text;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into e from auth.users where id = uid;
  return jsonb_build_object(
    'exported_at', now(), 'email', e,
    'profile', (select to_jsonb(p) - 'is_admin' from public.profiles p where p.id = uid),
    'health_and_safety_form', (select to_jsonb(h) from public.member_health h where h.user_id = uid),
    'class_bookings', coalesce((select jsonb_agg(to_jsonb(b) - 'user_id' order by b.date) from public.class_bookings b where b.user_id = uid), '[]'::jsonb),
    'workouts', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.date) from public.workout_logs w where w.user_id = uid), '[]'::jsonb),
    'weight_and_body_fat', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.date) from public.weight_logs w where w.user_id = uid), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at) from public.consent_log c where c.user_id = uid), '[]'::jsonb),
    'news_and_offers', (select jsonb_build_object('source', m.source, 'wording', m.wording, 'agreed_at', m.confirmed_at, 'withdrawn_at', m.withdrawn_at) from public.marketing_consent m where m.email = e),
    'membership_requests', coalesce((select jsonb_agg(jsonb_build_object('type', r.request_type, 'from', r.from_date, 'plan', r.plan_name, 'status', r.status, 'sent', r.created_at) order by r.created_at) from public.membership_requests r where r.email = e), '[]'::jsonb),
    'class_credits', coalesce((select jsonb_agg(jsonb_build_object('credits', c.credits, 'reason', c.reason, 'status', c.status, 'expires', c.expires_at) order by c.created_at) from public.class_credits c where c.email = e), '[]'::jsonb),
    'membership', (select jsonb_build_object('plan', o.plan_name, 'status', lower(o.status), 'amount', o.amount, 'started', o.cycle_started) from public.wix_orders o where lower(o.email) = e order by (o.status = 'ACTIVE') desc, o.cycle_started desc nulls last limit 1));
end $$;

create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare uid uuid := auth.uid(); e text;
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  select lower(email) into e from auth.users where id = uid;
  if e is null then raise exception 'Please sign in.'; end if;
  if exists (select 1 from public.staff s where s.user_id = uid) then raise exception 'This is a staff login. Please ask the owner to remove it.'; end if;
  if exists (select 1 from public.wix_orders o where lower(o.email) = e and o.status in ('ACTIVE', 'PAUSED')) then
    raise exception 'You still have a membership. Please cancel it first (Account, Membership, Cancel). You can delete your account once it has ended.';
  end if;
  if exists (select 1 from public.class_bookings b where b.user_id = uid and b.date ~ '^\d{4}-\d{2}-\d{2}$' and b.date::date >= current_date) then
    raise exception 'You have upcoming bookings. Please cancel them first, then delete your account.';
  end if;
  -- people-keyed records that are not removed automatically with the login
  delete from public.membership_requests where email = e;
  delete from public.member_notes where email = e;
  delete from public.free_trials where lower(email) = e;
  delete from public.waitlist where lower(email) = e;
  delete from public.manual_members where lower(email) = e;
  delete from public.hidden_members where lower(email) = e;
  update public.class_credits set user_id = null where user_id = uid;
  -- keep only the proof that they switched marketing off, so nothing is ever sent again
  insert into public.marketing_consent (email, user_id, source, wording, withdrawn_at) values (e, null, 'app-profile', 'Account deleted', now())
    on conflict (email) do update set withdrawn_at = coalesce(public.marketing_consent.withdrawn_at, now()), user_id = null;
  -- the login: profile, bookings, workouts, weights, health form, consents, reminders and waiting-list places go with it
  delete from auth.users where id = uid;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.my_streak() from public, anon;
revoke all on function public.my_data_export() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.my_streak() to authenticated;
grant execute on function public.my_data_export() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- news and offers: the wording recorded at sign-up now points to Account > Privacy and data (where the switch is)
create or replace function public.set_my_marketing_consent(p_on boolean, p_source text default 'app-profile') returns boolean
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_email text; v_src text := case when p_source in ('app-signup', 'app-profile') then p_source else 'app-profile' end;
  v_words text := case when p_source = 'app-signup' then 'Keep me posted with news and offers from MY GYM London by email. I can switch this off any time in Account > Privacy and data.' else 'News and offers from MY GYM London' end;
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
notify pgrst, 'reload schema';
