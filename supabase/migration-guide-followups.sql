-- MY GYM London: follow-up emails for the free guide (3 and 7 days after someone asked for it). Written 2026-10-31. NOT RUN YET.
-- Run in the Supabase SQL editor AFTER migration-email-hooks.sql, migration-forms-and-consent.sql and migration-email-hook-leads.sql, and AFTER the new send-email function (with guide-tips-warmup and guide-tips-meals) is deployed.
-- Marketing emails: ONLY people with confirmed marketing consent are emailed (send-email checks it again).
-- Each person gets each email once, even if they ask for the guide twice (dedupe key is the email address: guide1:<email>, guide2:<email>).
-- A person stops getting follow-ups when an app account with that email exists, or the enquiry is marked joined / not now / spam in the back end.
-- Looks back two days so a missed daily run is caught up. Runs daily at 10:15 UTC (the lead emails run at 10:00).
-- Stop it:  select cron.unschedule('guide-followup-emails');
create or replace function public.send_guide_followup_emails(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in
    select s.id, lower(s.data->>'email') as email,
           coalesce(nullif(split_part(trim(coalesce(s.data->>'full_name', '')), ' ', 1), ''), 'there') as first_name,
           case when s.created_at <= p_now - interval '7 days' and s.created_at > p_now - interval '9 days' then 2
                when s.created_at <= p_now - interval '3 days' and s.created_at > p_now - interval '5 days' then 1 end as step
    from public.form_submissions s
    join public.marketing_consent mc on mc.email = lower(s.data->>'email') and mc.confirmed_at is not null and mc.withdrawn_at is null
    where s.form_id = 'guide-signup'
      and s.status in ('new', 'contacted', 'trial')
      and not exists (select 1 from auth.users u where lower(u.email) = lower(s.data->>'email'))
  loop
    continue when r.step is null;
    if not exists (select 1 from public.email_events where dedupe_key = 'guide' || r.step || ':' || r.email) then
      perform public.queue_email(case r.step when 1 then 'guide-tips-warmup' else 'guide-tips-meals' end, null, r.email, jsonb_build_object('first_name', r.first_name), 'guide' || r.step || ':' || r.email);
      n := n + 1;
    end if;
  end loop;
  return n;
exception when others then
  return n;
end $$;
revoke all on function public.send_guide_followup_emails(timestamptz) from public, anon, authenticated;

select cron.schedule('guide-followup-emails', '15 10 * * *', 'select public.send_guide_followup_emails()');
