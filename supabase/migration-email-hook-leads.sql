-- MY GYM London: lead follow-up emails (2 and 7 days after a website enquiry) and the refer-a-friend prompt (3 to 5 days after a member joins). Written 2026-10-26.
-- Marketing emails: ONLY people with confirmed marketing consent are emailed (send-email checks it again). Each email is sent once (dedupe keys lead1:/lead2:<submission>, referprompt:<user>).
-- A lead stops getting follow-ups when the enquiry is marked joined / not now / spam in the back end, or when an app account with that email exists.
-- Looks back two days so a missed daily run is caught up. Runs daily at 10:00 UTC. Needs migration-email-hooks.sql and migration-forms-and-consent.sql.
-- Stop it:  select cron.unschedule('lead-and-referral-emails');
create or replace function public.send_lead_and_referral_emails(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in
    select s.id, lower(s.data->>'email') as email,
           coalesce(nullif(split_part(trim(coalesce(s.data->>'full_name', s.data->>'parent_name', '')), ' ', 1), ''), 'there') as first_name,
           case when s.created_at <= p_now - interval '7 days' and s.created_at > p_now - interval '9 days' then 2
                when s.created_at <= p_now - interval '2 days' and s.created_at > p_now - interval '4 days' then 1 end as step
    from public.form_submissions s
    join public.marketing_consent mc on mc.email = lower(s.data->>'email') and mc.confirmed_at is not null and mc.withdrawn_at is null
    where s.form_id in ('contact', 'pt-enquiry', 'trial-class', 'landing-offer', 'corporate-enquiry')
      and s.status in ('new', 'contacted', 'trial')
      and not exists (select 1 from auth.users u where lower(u.email) = lower(s.data->>'email'))
  loop
    continue when r.step is null;
    if not exists (select 1 from public.email_events where dedupe_key = 'lead' || r.step || ':' || r.id::text) then
      perform public.queue_email('lead-followup-' || r.step, null, r.email, jsonb_build_object('first_name', r.first_name), 'lead' || r.step || ':' || r.id::text); n := n + 1;
    end if;
  end loop;

  for r in
    select u.id, coalesce(nullif(split_part(trim(coalesce(pr.full_name, '')), ' ', 1), ''), 'there') as first_name
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    join public.marketing_consent mc on mc.email = lower(u.email) and mc.confirmed_at is not null and mc.withdrawn_at is null
    where u.created_at <= p_now - interval '3 days' and u.created_at > p_now - interval '5 days'
  loop
    if not exists (select 1 from public.email_events where dedupe_key = 'referprompt:' || r.id::text) then
      perform public.queue_email('refer-a-friend-prompt', r.id, null, jsonb_build_object('first_name', r.first_name, 'reward', 'a free week'), 'referprompt:' || r.id::text); n := n + 1;
    end if;
  end loop;
  return n;
exception when others then
  return n;
end $$;
revoke all on function public.send_lead_and_referral_emails(timestamptz) from public, anon, authenticated;

select cron.schedule('lead-and-referral-emails', '0 10 * * *', 'select public.send_lead_and_referral_emails()');
