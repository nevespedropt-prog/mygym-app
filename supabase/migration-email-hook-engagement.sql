-- MY GYM London: daily "keep members engaged" emails: milestone (10th, 50th, 100th class), review-request (5th class) and we-miss-you (30 days without a visit).
-- Decided 2026-10-26: ONLY members who confirmed they want news and offers (public.marketing_consent, confirmed and not withdrawn) are ever emailed;
-- these three emails are marketing, so send-email would refuse the others anyway. Each email is sent once per event (dedupe keys below).
-- "A class" = a past booking of a class (not a gym slot). A gym slot counts as a visit for we-miss-you. Bookings are treated as attended (a cancelled booking is deleted).
-- Looks back 3 days so a missed daily run is caught up. Runs daily at 09:30 UTC. Needs migration-email-hooks.sql (queue_email, email_events).
-- Stop it:  select cron.unschedule('engagement-emails');   Switch one email off for good: back end email list (email_overrides) or edit the function.
create or replace function public.send_engagement_emails(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r record; n integer := 0; today date := (p_now at time zone 'Europe/London')::date;
begin
  -- milestones and the 5th-class review request: the N-th past class landed in the last 3 days
  for r in
    with past as (
      select b.user_id, b.date::date as d, row_number() over (partition by b.user_id order by b.date, c.start_time, b.created_at) as rn
      from public.class_bookings b join public.classes c on c.id = b.class_id
      where c.kind = 'class' and b.date::date < today
    )
    select p.user_id, p.rn, p.d, u.email, coalesce(nullif(split_part(trim(coalesce(pr.full_name, '')), ' ', 1), ''), 'there') as first_name
    from past p
    join auth.users u on u.id = p.user_id
    left join public.profiles pr on pr.id = p.user_id
    join public.marketing_consent mc on mc.email = lower(u.email) and mc.confirmed_at is not null and mc.withdrawn_at is null
    where p.rn in (5, 10, 50, 100) and p.d >= today - 3
  loop
    if r.rn = 5 then
      if not exists (select 1 from public.email_events where dedupe_key = 'review:' || r.user_id::text) then
        perform public.queue_email('review-request', r.user_id, null, jsonb_build_object('first_name', r.first_name), 'review:' || r.user_id::text); n := n + 1;
      end if;
    else
      if not exists (select 1 from public.email_events where dedupe_key = 'milestone:' || r.user_id::text || ':' || r.rn) then
        perform public.queue_email('milestone', r.user_id, null, jsonb_build_object('first_name', r.first_name, 'count', r.rn::text), 'milestone:' || r.user_id::text || ':' || r.rn); n := n + 1;
      end if;
    end if;
  end loop;

  -- we miss you: last visit (any booking) was 30 to 33 days ago and nothing is booked ahead. One email per lapse (the key holds the last visit date).
  for r in
    select b.user_id, max(b.date::date) as last_d, u.email, coalesce(nullif(split_part(trim(coalesce(pr.full_name, '')), ' ', 1), ''), 'there') as first_name
    from public.class_bookings b
    join auth.users u on u.id = b.user_id
    left join public.profiles pr on pr.id = b.user_id
    join public.marketing_consent mc on mc.email = lower(u.email) and mc.confirmed_at is not null and mc.withdrawn_at is null
    group by b.user_id, u.email, pr.full_name
    having max(b.date::date) between today - 33 and today - 30
  loop
    if not exists (select 1 from public.email_events where dedupe_key = 'missyou:' || r.user_id::text || ':' || r.last_d::text) then
      perform public.queue_email('we-miss-you', r.user_id, null, jsonb_build_object('first_name', r.first_name), 'missyou:' || r.user_id::text || ':' || r.last_d::text); n := n + 1;
    end if;
  end loop;
  return n;
exception when others then
  return n;
end $$;
revoke all on function public.send_engagement_emails(timestamptz) from public, anon, authenticated;

select cron.schedule('engagement-emails', '30 9 * * *', 'select public.send_engagement_emails()');
