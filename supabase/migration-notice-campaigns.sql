-- APPLIED to the live database 2026-11-13 (project ldmksxyilykyfnqnuytv). Safe to re-run.
-- One-off service notices: a campaign of kind 'notice' goes to clients (by status), app users or typed addresses, with NO marketing consent needed and no unsubscribe link.
-- Service information only (closure, timetable change, account news); anything promotional stays a marketing campaign.
-- People who marked an email as spam are always left out. Used by the back office Marketing page, admin-campaign and send-scheduled-campaigns.
alter table public.marketing_campaigns add column if not exists kind text not null default 'marketing';
alter table public.marketing_campaigns add column if not exists extra_emails text not null default '';
alter table public.marketing_campaigns drop constraint if exists marketing_campaigns_kind_check;
alter table public.marketing_campaigns add constraint marketing_campaigns_kind_check check (kind in ('marketing', 'notice'));
alter table public.marketing_campaigns drop constraint if exists marketing_campaigns_segment_check;
alter table public.marketing_campaigns add constraint marketing_campaigns_segment_check check (segment in ('all', 'members', 'leads', 'active30', 'lapsed', 'gym_classes', 'classes_only', 'active_clients', 'paused_clients', 'former_clients', 'inactive_clients', 'app_users', 'custom'));

-- Wix order status DRAFT = an unfinished sign-up, so it is not a client and is never in these groups.
create or replace function public._notice_audience(p_segment text, p_extra text)
returns table(email text, user_id uuid)
language sql stable security definer set search_path to 'public', 'auth', 'pg_temp' as $$
  with seg as (
    select lower(o.email) as email from public.wix_orders o where p_segment = 'active_clients' and o.status = 'ACTIVE'
    union
    select lower(o.email) from public.wix_orders o where p_segment = 'paused_clients' and o.status = 'PAUSED'
      and not exists (select 1 from public.wix_orders a where lower(a.email) = lower(o.email) and a.status = 'ACTIVE')
    union
    select lower(o.email) from public.wix_orders o where p_segment = 'former_clients' and o.status in ('CANCELED', 'ENDED')
      and not exists (select 1 from public.wix_orders a where lower(a.email) = lower(o.email) and a.status in ('ACTIVE', 'PAUSED'))
    union
    select lower(o.email) from public.wix_orders o where p_segment = 'inactive_clients' and o.status in ('PAUSED', 'CANCELED', 'ENDED')
      and not exists (select 1 from public.wix_orders a where lower(a.email) = lower(o.email) and a.status = 'ACTIVE')
    union
    select lower(u.email) from auth.users u where p_segment = 'app_users' and u.email is not null
    union
    select lower(x) from regexp_split_to_table(coalesce(p_extra, ''), '[\s,;]+') x where x ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
  )
  select s.email, (select u.id from auth.users u where lower(u.email) = s.email limit 1) as user_id
  from seg s
  where s.email is not null and s.email <> ''
    and not exists (select 1 from public.email_events e where e.recipient = s.email and e.complained_at is not null)
  order by s.email
$$;

create or replace function public._campaign_audience_for(p_id uuid)
returns table(email text, user_id uuid)
language plpgsql stable security definer set search_path to 'public', 'auth', 'pg_temp' as $$
declare c public.marketing_campaigns%rowtype;
begin
  select * into c from public.marketing_campaigns where id = p_id;
  if not found then return; end if;
  if c.kind = 'notice' then return query select a.email, a.user_id from public._notice_audience(c.segment, c.extra_emails) a;
  else return query select a.email, a.user_id from public._campaign_audience(c.segment) a; end if;
end $$;

revoke all on function public._notice_audience(text, text) from public, anon, authenticated;
revoke all on function public._campaign_audience_for(uuid) from public, anon, authenticated;
grant execute on function public._notice_audience(text, text) to service_role;
grant execute on function public._campaign_audience_for(uuid) to service_role;

create or replace function public.admin_notice_counts()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth', 'pg_temp' as $$
declare r text := public._need(array['admin']);
begin
  return jsonb_build_object(
    'active_clients', (select count(*) from public._notice_audience('active_clients', '')),
    'paused_clients', (select count(*) from public._notice_audience('paused_clients', '')),
    'former_clients', (select count(*) from public._notice_audience('former_clients', '')),
    'inactive_clients', (select count(*) from public._notice_audience('inactive_clients', '')),
    'app_users', (select count(*) from public._notice_audience('app_users', '')),
    'custom', 0);
end $$;
revoke all on function public.admin_notice_counts() from public, anon;
grant execute on function public.admin_notice_counts() to authenticated;

-- exact number of people a notice reaches (groups and typed addresses overlap), for the send button
create or replace function public.admin_notice_count(p_segment text, p_extra text)
returns integer language plpgsql stable security definer set search_path to 'public', 'auth', 'pg_temp' as $$
declare r text := public._need(array['admin']);
begin
  if p_segment not in ('active_clients', 'paused_clients', 'former_clients', 'inactive_clients', 'app_users', 'custom') then return 0; end if;
  return (select count(*)::int from public._notice_audience(p_segment, left(coalesce(p_extra, ''), 20000)));
end $$;
revoke all on function public.admin_notice_count(text, text) from public, anon;
grant execute on function public.admin_notice_count(text, text) to authenticated;

create or replace function public._campaign_json(c public.marketing_campaigns)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', c.id, 'subject', c.subject, 'preheader', c.preheader, 'title', c.title, 'body', c.body, 'button', c.button, 'url', c.url,
    'segment', c.segment, 'status', c.status, 'scheduled_for', c.scheduled_for, 'started_at', c.started_at, 'finished_at', c.finished_at,
    'audience', c.audience, 'sent', c.sent, 'failed', c.failed, 'skipped', c.skipped, 'created_at', c.created_at, 'updated_at', c.updated_at,
    'kind', c.kind, 'extra_emails', c.extra_emails)
$$;

drop function if exists public.admin_campaign_save(uuid, text, text, text, text, text, text, text, timestamp with time zone);
create or replace function public.admin_campaign_save(p_id uuid, p_subject text, p_preheader text, p_title text, p_body text, p_button text, p_url text, p_segment text, p_scheduled_for timestamp with time zone, p_kind text default 'marketing', p_extra text default '')
returns jsonb language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $$
declare r text := public._need(array['admin']);
  s text := left(trim(coalesce(p_subject, '')), 200); pre text := left(trim(coalesce(p_preheader, '')), 200); t text := left(trim(coalesce(p_title, '')), 200);
  b text := left(trim(coalesce(p_body, '')), 4000); bt text := left(trim(coalesce(p_button, '')), 60); u text := left(trim(coalesce(p_url, '')), 500);
  seg text := coalesce(p_segment, 'all'); k text := case when p_kind = 'notice' then 'notice' else 'marketing' end;
  cur public.marketing_campaigns%rowtype; out public.marketing_campaigns%rowtype; st text;
  toks text[]; bad text; ex text := '';
begin
  if k = 'marketing' then
    if seg not in ('all', 'members', 'leads', 'active30', 'lapsed', 'gym_classes', 'classes_only', 'active_clients', 'paused_clients', 'former_clients') then raise exception 'Choose who this goes to.'; end if;
  else
    if seg not in ('active_clients', 'paused_clients', 'former_clients', 'inactive_clients', 'app_users', 'custom') then raise exception 'Choose who this notice goes to.'; end if;
    select coalesce(array_agg(distinct x), '{}') into toks from regexp_split_to_table(lower(trim(coalesce(p_extra, ''))), '[\s,;]+') x where x <> '';
    if cardinality(toks) > 300 then raise exception 'Up to 300 extra email addresses at a time.'; end if;
    select string_agg(x, ', ') into bad from unnest(toks) x where x !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$';
    if bad is not null then raise exception 'These do not look like email addresses: %', left(bad, 200); end if;
    ex := array_to_string(toks, ', ');
    if seg = 'custom' and ex = '' and p_scheduled_for is not null then raise exception 'Add at least one email address.'; end if;
  end if;
  if p_id is not null then
    select * into cur from public.marketing_campaigns where id = p_id for update;
    if found and cur.status not in ('draft', 'scheduled') then raise exception 'This campaign has already been sent or is sending.'; end if;
  end if;
  if p_scheduled_for is not null then
    if s = '' or length(s) > 78 then raise exception 'To schedule, the subject needs 1 to 78 characters.'; end if;
    if length(t) < 2 or length(t) > 60 then raise exception 'To schedule, the heading needs 2 to 60 characters.'; end if;
    if length(b) < 10 then raise exception 'To schedule, write the message.'; end if;
    if bt = '' then raise exception 'To schedule, add the button text.'; end if;
    if u !~ '^https://[^[:space:]]+$' then raise exception 'The button link must start with https://'; end if;
    if (s || pre || t || b || bt) ~ '\[[^\]]{2,}\]' then raise exception 'There is still [placeholder] text to fill in.'; end if;
    if p_scheduled_for < now() + interval '2 minutes' then raise exception 'Pick a send time at least 2 minutes from now.'; end if;
    if p_scheduled_for > now() + interval '90 days' then raise exception 'Pick a send time within the next 90 days.'; end if;
  end if;
  st := case when p_scheduled_for is null then 'draft' else 'scheduled' end;
  if cur.id is null then
    insert into public.marketing_campaigns (subject, preheader, title, body, button, url, segment, status, scheduled_for, created_by, kind, extra_emails)
    values (s, pre, t, b, bt, u, seg, st, p_scheduled_for, auth.uid(), k, ex) returning * into out;
  else
    update public.marketing_campaigns set subject = s, preheader = pre, title = t, body = b, button = bt, url = u, segment = seg, status = st,
      scheduled_for = p_scheduled_for, kind = k, extra_emails = ex, updated_at = now() where id = cur.id returning * into out;
  end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'campaign_' || st, out.id::text);
  return public._campaign_json(out);
end $$;
revoke all on function public.admin_campaign_save(uuid, text, text, text, text, text, text, text, timestamp with time zone, text, text) from public, anon;
grant execute on function public.admin_campaign_save(uuid, text, text, text, text, text, text, text, timestamp with time zone, text, text) to authenticated;
notify pgrst, 'reload schema';
