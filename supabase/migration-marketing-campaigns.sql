-- MY GYM London: marketing campaigns in the back office (history, audience segments, scheduling). Written 2026-11-12, NOT applied yet.
-- Needs migration-admin-backend.sql (roles, _need, staff_access_log) and migration-forms-and-consent.sql (marketing_consent).
--
-- What this adds (all new objects; nothing existing is changed):
--   table  marketing_campaigns          one row per campaign: wording, who it goes to, status, schedule, counts
--   email_events                        four new empty columns (delivered_at, bounced_at, complained_at, clicked_at) filled by the resend-webhook function
--   func   _campaign_audience(segment)  the confirmed subscribers in a segment (service role only: used by the edge functions)
--   funcs  admin_campaign_list / _save / _unschedule / _delete / _counts   back office (admin only, like the other admin_* functions)
-- Segments: all (every confirmed subscriber) | members (has an app account) | leads (website sign-ups without an app account)
--           | active30 (members who booked a class or gym slot in the last 30 days).
-- Only people with confirmed, not withdrawn consent are ever in any segment. send-email checks consent again at send time.
-- Statuses: draft -> scheduled (has a send time) -> sending -> sent. Unscheduling returns it to draft.
-- Sending is done by the edge functions admin-campaign (send now) and send-scheduled-campaigns (sends scheduled ones; cron every minute).
-- Delivery stats: Resend tells the resend-webhook function when an email was delivered, bounced, marked as spam or clicked.
-- A complaint or a permanent bounce also withdraws that person's marketing consent, so they are never emailed again.
--
-- To undo:  select cron.unschedule('send-scheduled-campaigns');  drop function public.admin_campaign_list(), public.admin_campaign_counts(),
--   public.admin_campaign_unschedule(uuid), public.admin_campaign_delete(uuid), public.admin_campaign_save(uuid,text,text,text,text,text,text,text,timestamptz),
--   public._campaign_audience(text), public._campaign_json(public.marketing_campaigns);  drop table public.marketing_campaigns;

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '',
  preheader text not null default '',
  title text not null default '',
  body text not null default '',
  button text not null default '',
  url text not null default '',
  segment text not null default 'all' check (segment in ('all', 'members', 'leads', 'active30')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent')),
  scheduled_for timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  audience integer,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- delivery feedback from Resend (see the resend-webhook function). email_events.detail already holds Resend's email id for sent mail.
alter table public.email_events add column if not exists delivered_at timestamptz;
alter table public.email_events add column if not exists bounced_at timestamptz;
alter table public.email_events add column if not exists complained_at timestamptz;
alter table public.email_events add column if not exists clicked_at timestamptz;
create index if not exists email_events_detail on public.email_events (detail);
create index if not exists marketing_campaigns_due on public.marketing_campaigns (status, scheduled_for);
alter table public.marketing_campaigns enable row level security;
revoke all on public.marketing_campaigns from anon, authenticated;   -- only the functions below and the edge functions (service role) touch it

-- who is in a segment (confirmed, not withdrawn)
create or replace function public._campaign_audience(p_segment text) returns table (email text, user_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select mc.email, mc.user_id
  from public.marketing_consent mc
  where mc.confirmed_at is not null and mc.withdrawn_at is null
    and case p_segment
      when 'members' then mc.user_id is not null
      when 'leads' then mc.user_id is null
      when 'active30' then mc.user_id is not null and exists (
        select 1 from public.class_bookings b
        where b.user_id = mc.user_id and b.date >= to_char((now() at time zone 'Europe/London')::date - 30, 'YYYY-MM-DD'))
      else true end
  order by mc.email
$$;

create or replace function public._campaign_json(c public.marketing_campaigns) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', c.id, 'subject', c.subject, 'preheader', c.preheader, 'title', c.title, 'body', c.body, 'button', c.button, 'url', c.url,
    'segment', c.segment, 'status', c.status, 'scheduled_for', c.scheduled_for, 'started_at', c.started_at, 'finished_at', c.finished_at,
    'audience', c.audience, 'sent', c.sent, 'failed', c.failed, 'skipped', c.skipped, 'created_at', c.created_at, 'updated_at', c.updated_at)
$$;

-- 1. all campaigns, newest first
create or replace function public.admin_campaign_list() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
begin
  return coalesce((select jsonb_agg(public._campaign_json(c) || jsonb_build_object('stats', (
      select jsonb_build_object(
        'delivered', count(*) filter (where e.delivered_at is not null),
        'bounced', count(*) filter (where e.bounced_at is not null),
        'complained', count(*) filter (where e.complained_at is not null),
        'clicked', count(*) filter (where e.clicked_at is not null),
        'unsubscribed', (select count(*) from public.marketing_consent m where c.started_at is not null and m.withdrawn_at >= c.started_at
                          and m.email in (select e2.recipient from public.email_events e2 where e2.dedupe_key like 'campaign:' || c.id || ':%')))
      from public.email_events e where e.dedupe_key like 'campaign:' || c.id || ':%' and e.status = 'sent')) order by c.created_at desc)
    from (select * from public.marketing_campaigns order by created_at desc limit 100) c), '[]'::jsonb);
end $$;

-- 2. how many confirmed subscribers each segment has right now
create or replace function public.admin_campaign_counts() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
begin
  return jsonb_build_object(
    'all', (select count(*) from public._campaign_audience('all')),
    'members', (select count(*) from public._campaign_audience('members')),
    'leads', (select count(*) from public._campaign_audience('leads')),
    'active30', (select count(*) from public._campaign_audience('active30')));
end $$;

-- 3. create or update a campaign that has not been sent. A send time makes it 'scheduled'; no send time keeps it a draft.
create or replace function public.admin_campaign_save(p_id uuid, p_subject text, p_preheader text, p_title text, p_body text, p_button text, p_url text, p_segment text, p_scheduled_for timestamptz)
returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
  s text := left(trim(coalesce(p_subject, '')), 200); pre text := left(trim(coalesce(p_preheader, '')), 200); t text := left(trim(coalesce(p_title, '')), 200);
  b text := left(trim(coalesce(p_body, '')), 4000); bt text := left(trim(coalesce(p_button, '')), 60); u text := left(trim(coalesce(p_url, '')), 500);
  seg text := coalesce(p_segment, 'all'); cur public.marketing_campaigns%rowtype; out public.marketing_campaigns%rowtype; st text;
begin
  if seg not in ('all', 'members', 'leads', 'active30') then raise exception 'Choose who this goes to.'; end if;
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
    insert into public.marketing_campaigns (subject, preheader, title, body, button, url, segment, status, scheduled_for, created_by)
    values (s, pre, t, b, bt, u, seg, st, p_scheduled_for, auth.uid()) returning * into out;
  else
    update public.marketing_campaigns set subject = s, preheader = pre, title = t, body = b, button = bt, url = u, segment = seg, status = st,
      scheduled_for = p_scheduled_for, updated_at = now() where id = cur.id returning * into out;
  end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'campaign_' || st, out.id::text);
  return public._campaign_json(out);
end $$;

-- 4. take a scheduled campaign back to a draft
create or replace function public.admin_campaign_unschedule(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']); out public.marketing_campaigns%rowtype;
begin
  update public.marketing_campaigns set status = 'draft', scheduled_for = null, updated_at = now() where id = p_id and status = 'scheduled' returning * into out;
  if not found then raise exception 'That campaign is not scheduled.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'campaign_unscheduled', p_id::text);
  return public._campaign_json(out);
end $$;

-- 5. delete a campaign that was never sent
create or replace function public.admin_campaign_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
begin
  delete from public.marketing_campaigns where id = p_id and status in ('draft', 'scheduled');
  if not found then raise exception 'Only a campaign that was not sent can be deleted.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'campaign_deleted', p_id::text);
  return jsonb_build_object('deleted', true);
end $$;

-- who may call what: the admin functions are for signed-in people (they check the role themselves); the audience helper is for the edge functions only
do $$ declare f text; begin
  foreach f in array array['admin_campaign_list()', 'admin_campaign_counts()', 'admin_campaign_save(uuid,text,text,text,text,text,text,text,timestamptz)',
    'admin_campaign_unschedule(uuid)', 'admin_campaign_delete(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke all on function public._campaign_audience(text) from public, anon, authenticated;
  revoke all on function public._campaign_json(public.marketing_campaigns) from public, anon, authenticated;
  grant execute on function public._campaign_audience(text) to service_role;
end $$;
