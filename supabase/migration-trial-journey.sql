-- MY GYM London: the free trial journey. Written 2026-11-19. PAUSED until the move: the switch app_flags 'trial_emails' is OFF.
-- Booked for a free trial -> confirmation email straight away -> reminder about 2 hours before -> next-day "how was it" email with a way to join (only if they have not joined).
-- Honours the switch: off = nobody, test = only the listed test emails, on = everyone. Each email has a fixed key, so nobody gets the same one twice.
-- The wording of the reminder and follow-up is in this file (they use the generic "notice" email layout).
-- To stop: select cron.unschedule('trial-emails');   and   update public.app_flags set mode = 'off' where key = 'trial_emails';

insert into public.app_flags (key, mode) values ('trial_emails', 'off') on conflict (key) do nothing;
alter table public.free_trials add column if not exists conf_at timestamptz, add column if not exists rem_at timestamptz, add column if not exists fu_at timestamptz;

create or replace function public.queue_trial_email(p_template text, p_to text, p_vars jsonb, p_key text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m text; t text[];
begin
  select mode, test_emails into m, t from public.app_flags where key = 'trial_emails';
  m := coalesce(m, 'off');
  if p_to is null or btrim(p_to) = '' or m = 'off' then return; end if;
  if m = 'test' and not (lower(p_to) = any (select lower(x) from unnest(coalesce(t, '{}'::text[])) x)) then return; end if;
  perform public.queue_email(p_template, null, lower(btrim(p_to)), p_vars, p_key);
exception when others then null;
end $$;
revoke all on function public.queue_trial_email(text, text, jsonb, text) from public, anon, authenticated;

-- has this person already joined? (an active plan that is not pay as you go, from Wix or recorded in person)
create or replace function public._trial_joined(p_email text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_email is not null and (
    exists (select 1 from public.wix_orders o where lower(o.email) = lower(p_email) and o.status = 'ACTIVE' and o.plan_name !~* '(payg|pay as you go)' and coalesce(o.amount, 0) > 0)
    or exists (select 1 from public.manual_members m where lower(m.email) = lower(p_email) and m.plan_id is not null));
$$;
revoke all on function public._trial_joined(text) from public, anon, authenticated;

-- 1. confirmation: the moment a session is booked for the trial (staff add it, or approve a website request)
create or replace function public._free_trial_confirm() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare w record; first text;
begin
  if new.walkin_id is null or new.email is null or btrim(new.email) = '' then return new; end if;
  if tg_op = 'UPDATE' and old.walkin_id is not distinct from new.walkin_id then return new; end if;
  select b.date, c.name, c.start_time, c.kind into w from public.walkin_bookings b join public.classes c on c.id = b.class_id where b.id = new.walkin_id;
  if w.date is null then return new; end if;
  first := coalesce(nullif(split_part(btrim(new.name), ' ', 1), ''), 'there');
  perform public.queue_trial_email('trial-confirmation', new.email, jsonb_build_object('first_name', first,
    'class_name', case when w.kind = 'gym' then 'Free gym session' else w.name end,
    'when', to_char(w.date::date, 'FMDay FMDD FMMonth') || ' at ' || left(w.start_time, 5)), 'trialconf:' || new.walkin_id::text);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists free_trials_confirm on public.free_trials;
create trigger free_trials_confirm after insert or update of walkin_id on public.free_trials for each row execute function public._free_trial_confirm();

-- 2. reminder (about 2 hours before) and 3. next-day follow-up, run every 10 minutes
create or replace function public.trial_emails_run() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD'); yest text := to_char((now() at time zone 'Europe/London') - interval '1 day', 'YYYY-MM-DD');
  nowt time := (now() at time zone 'Europe/London')::time; first text; what text; nrem int := 0; nfu int := 0;
begin
  for r in select t.id, t.email, t.name, b.id wid, c.name cname, c.kind, left(c.start_time, 5) st from public.free_trials t join public.walkin_bookings b on b.id = t.walkin_id join public.classes c on c.id = b.class_id
           where t.rem_at is null and b.date = today and t.email is not null and c.start_time::time between nowt + interval '60 minutes' and nowt + interval '150 minutes' loop
    update public.free_trials set rem_at = now() where id = r.id;
    first := coalesce(nullif(split_part(btrim(r.name), ' ', 1), ''), 'there'); what := case when r.kind = 'gym' then 'free gym session' else 'free ' || r.cname || ' class' end;
    perform public.queue_trial_email('notice', r.email, jsonb_build_object('first_name', first, 'campaign_subject', 'See you today at ' || r.st, 'campaign_preheader', 'Your ' || what || ' starts at ' || r.st || '.', 'campaign_title', 'Your free session is today',
      'campaign_body', 'A quick reminder: your ' || what || ' starts at ' || r.st || ' today at MY GYM London, Main Avenue, Bush Hill Park, Enfield EN1 1DS.' || E'\n\nPlease arrive about 10 minutes early so we can say hello, wear comfortable clothes and trainers, and bring a water bottle.' || E'\n\nCannot make it? Just reply to this email and we will move you to another day. No problem at all.',
      'campaign_button', 'Get directions', 'campaign_url', 'https://maps.app.goo.gl/EhoXHJ5Em9nMYn8U6'), 'trialrem:' || r.wid::text);
    nrem := nrem + 1;
  end loop;
  if nowt >= time '11:00' then
    for r in select t.id, t.email, t.name, b.id wid, c.name cname, c.kind from public.free_trials t join public.walkin_bookings b on b.id = t.walkin_id join public.classes c on c.id = b.class_id
             where t.fu_at is null and b.date = yest and t.email is not null loop
      update public.free_trials set fu_at = now() where id = r.id;
      if public._trial_joined(r.email) then continue; end if;
      first := coalesce(nullif(split_part(btrim(r.name), ' ', 1), ''), 'there');
      perform public.queue_trial_email('notice', r.email, jsonb_build_object('first_name', first, 'campaign_subject', 'How was your free ' || case when r.kind = 'gym' then 'gym session' else 'class' end || ', ' || first || '?', 'campaign_preheader', 'Here is how to keep going, with no contract.',
        'campaign_title', 'Thanks for training with us',
        'campaign_body', 'Thank you for coming to MY GYM London yesterday. We hope you enjoyed it.' || E'\n\nIf you would like to keep going, there is no contract and no joining fee. You can pay as you go, or choose a monthly membership for the gym, for classes, or for both. Not sure which suits you? Our plan finder on the website points you to the cheapest option for how you train.' || E'\n\nQuestions, or want to try a different class first? Just reply to this email and we will help.',
        'campaign_button', 'Find my plan', 'campaign_url', 'https://www.mygymlondon.co.uk/services'), 'trialfu:' || r.wid::text);
      nfu := nfu + 1;
    end loop;
  end if;
  return jsonb_build_object('reminders', nrem, 'followups', nfu);
end $$;
revoke all on function public.trial_emails_run() from public, anon, authenticated;

-- 4. the numbers for the back office dashboard (admin, manager, reception)
create or replace function public.admin_trial_funnel(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']); today text := to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD'); given int; booked int; done int; joined int;
begin
  select count(*), count(*) filter (where walkin_id is not null), count(*) filter (where walkin_id is not null and date < today),
         count(*) filter (where public._trial_joined(email))
    into given, booked, done, joined from public.free_trials where created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  return jsonb_build_object('days', p_days, 'given', given, 'booked', booked, 'done', done, 'joined', joined, 'waiting', given - booked);
end $$;
revoke all on function public.admin_trial_funnel(integer) from public, anon;
grant execute on function public.admin_trial_funnel(integer) to authenticated;

select cron.unschedule('trial-emails') where exists (select 1 from cron.job where jobname = 'trial-emails');
select cron.schedule('trial-emails', '*/10 * * * *', 'select public.trial_emails_run()');
notify pgrst, 'reload schema';
