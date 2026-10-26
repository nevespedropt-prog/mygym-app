-- MY GYM London: connects app events to the email sender (written 2026-10-26). NOT APPLIED YET.
-- Run ONLY AFTER: migration-forms-and-consent.sql is applied, the send-email function is deployed (Verify JWT OFF), and the secrets
-- RESEND_API_KEY, EMAIL_TOKEN_SECRET and CRON_SECRET exist. Open a NEW query in the SQL editor, paste, check the tab text, then Run. Safe to run more than once.
-- Nothing here emails anyone by itself until a hook below fires. Hook 1 (welcome) fires when a new member account is created.
create extension if not exists pg_net;

-- 1. Record of every email attempt. Also stops the same email going out twice (dedupe_key).
create table if not exists public.email_events (
  dedupe_key text primary key,
  template   text not null,
  recipient  text not null,
  status     text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  detail     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_events_created_idx on public.email_events (created_at desc);
alter table public.email_events enable row level security;
drop policy if exists email_events_admin_read on public.email_events;
create policy email_events_admin_read on public.email_events for select using (public.is_admin());
revoke all on public.email_events from anon, authenticated;
grant select on public.email_events to authenticated;

-- 2. Helper every hook uses: asks the send-email function to send one email. It copies the secret header from the existing sync-timetable schedule
--    (so the secret is never typed or shown) and never raises an error: a problem here must never break a booking or a sign-up.
create or replace function public.queue_email(p_template text, p_user_id uuid, p_to text, p_vars jsonb, p_key text)
returns void language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare secret text;
begin
  select (regexp_match(command, 'x-cron-secret"?\s*[:=]>?\s*"?''?([A-Za-z0-9_\-]{16,})'))[1] into secret from cron.job where jobname = 'sync-timetable';
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://ldmksxyilykyfnqnuytv.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := jsonb_build_object('template', p_template, 'user_id', p_user_id, 'to', p_to, 'vars', coalesce(p_vars, '{}'::jsonb), 'dedupe_key', p_key)
  );
exception when others then
  null;
end $$;
revoke all on function public.queue_email(text, uuid, text, jsonb, text) from public, anon, authenticated;

-- 3. Hook 1: welcome email when a new member account is created (the profile row is created with the account).
create or replace function public.email_hook_welcome() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform public.queue_email('welcome', new.id, null,
    jsonb_build_object('first_name', coalesce(nullif(split_part(trim(coalesce(new.full_name, '')), ' ', 1), ''), 'there')),
    'welcome:' || new.id::text);
  return new;
exception when others then
  return new;
end $$;
revoke all on function public.email_hook_welcome() from public, anon, authenticated;
drop trigger if exists email_hook_welcome on public.profiles;
create trigger email_hook_welcome after insert on public.profiles for each row execute function public.email_hook_welcome();

-- To switch the welcome email off:  drop trigger if exists email_hook_welcome on public.profiles;
-- To undo everything (only if no email has been recorded you want to keep):
--   drop trigger if exists email_hook_welcome on public.profiles; drop function if exists public.email_hook_welcome();
--   drop function if exists public.queue_email(text, uuid, text, jsonb, text); drop table if exists public.email_events;
