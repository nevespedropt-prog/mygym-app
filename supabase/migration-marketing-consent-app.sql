-- MY GYM London: lets a signed-in member switch "news and offers by email" on or off (written and applied 2026-10-26, after a rolled-back dry run).
-- The app calls these two functions: at sign-up (an optional, un-ticked box) and in Profile. The member can only change their OWN consent (auth.uid()).
-- Ticking the box is recorded as confirmed consent, with the exact wording they saw, the date and the source ('app-signup' or 'app-profile').
-- Switching off keeps a record that they withdrew, so nothing is ever sent. Needs migration-forms-and-consent.sql first.
create or replace function public.my_marketing_consent() returns boolean
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (select 1 from public.marketing_consent mc join auth.users u on lower(u.email) = mc.email
                 where u.id = auth.uid() and mc.confirmed_at is not null and mc.withdrawn_at is null)
$$;

create or replace function public.set_my_marketing_consent(p_on boolean, p_source text default 'app-profile') returns boolean
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_email text; v_src text := case when p_source in ('app-signup', 'app-profile') then p_source else 'app-profile' end;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'no email'; end if;
  if p_on then
    insert into public.marketing_consent (email, user_id, source, wording, requested_at, confirmed_at, withdrawn_at)
    values (v_email, auth.uid(), v_src, 'Send me news and offers from MY GYM London by email. I can unsubscribe at any time.', now(), now(), null)
    on conflict (email) do update set user_id = auth.uid(), source = v_src, wording = excluded.wording, requested_at = now(), confirmed_at = now(), withdrawn_at = null;
  else
    insert into public.marketing_consent (email, user_id, source, wording, withdrawn_at)
    values (v_email, auth.uid(), v_src, 'Switched off in the app', now())
    on conflict (email) do update set withdrawn_at = now();
  end if;
  return public.my_marketing_consent();
end $$;

revoke all on function public.my_marketing_consent() from public, anon;
revoke all on function public.set_my_marketing_consent(boolean, text) from public, anon;
grant execute on function public.my_marketing_consent() to authenticated;
grant execute on function public.set_my_marketing_consent(boolean, text) to authenticated;
