-- MY GYM London: storage for website/app forms, marketing consent and editable email wording (written 2026-10-25). NOT APPLIED YET.
-- Run in the Supabase SQL editor (open a NEW query, paste the statements only, check the tab text, then Run). Safe to run more than once.
-- Design: people and the website never touch these tables directly. A server function (submit-form, to be built) writes them with the
-- server key after checking the form. Only signed-in ADMINS can read or update them in the back end. Nothing is readable by visitors or members.

-- 1. Every form submission (contact, PT, trial, offers, kids, member requests, feedback, referrals, newsletter).
create table if not exists public.form_submissions (
  id           uuid primary key default gen_random_uuid(),
  form_id      text not null check (form_id ~ '^[a-z0-9-]{2,40}$'),
  data         jsonb not null,                                   -- what the person typed
  consent      jsonb not null default '{}'::jsonb,               -- which tick boxes they ticked
  source_url   text,
  utm          jsonb not null default '{}'::jsonb,               -- where they came from (utm_source, medium, campaign)
  ip_hash      text,                                             -- one-way hash, only for spam limits
  user_id      uuid references auth.users(id) on delete set null,
  status       text not null default 'new' check (status in ('new', 'contacted', 'trial', 'joined', 'not_now', 'spam')),
  note         text,
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),
  delete_after date not null default (current_date + 730)        -- set per form from forms.mjs (kids: 365)
);
create index if not exists form_submissions_status_idx on public.form_submissions (status, created_at desc);
create index if not exists form_submissions_form_idx   on public.form_submissions (form_id, created_at desc);
create index if not exists form_submissions_delete_idx on public.form_submissions (delete_after);

-- 2. Who agreed to marketing emails, with the exact wording they saw and the date (UK GDPR / PECR proof).
create table if not exists public.marketing_consent (
  email        text primary key check (email = lower(email)),
  user_id      uuid references auth.users(id) on delete set null,
  source       text not null,
  wording      text not null,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,                                      -- set when they click the confirm link (double opt-in)
  withdrawn_at timestamptz,                                      -- set when they unsubscribe
  token_hash   text                                              -- hash of the confirm/unsubscribe token, never the token
);

-- 3. Wording edits made in the back end (the files in supabase/email-templates are the defaults).
create table if not exists public.email_overrides (
  template_id text primary key check (template_id ~ '^[a-z0-9-]{2,60}$'),
  subject     text,
  body        jsonb,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- 4. Row security: admins only. (The server key bypasses row security, so the server function can write.)
alter table public.form_submissions enable row level security;
alter table public.marketing_consent enable row level security;
alter table public.email_overrides   enable row level security;

drop policy if exists form_submissions_admin_read   on public.form_submissions;
drop policy if exists form_submissions_admin_update on public.form_submissions;
create policy form_submissions_admin_read   on public.form_submissions for select using (public.is_admin());
create policy form_submissions_admin_update on public.form_submissions for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists marketing_consent_admin_read on public.marketing_consent;
create policy marketing_consent_admin_read on public.marketing_consent for select using (public.is_admin());

drop policy if exists email_overrides_admin_all on public.email_overrides;
create policy email_overrides_admin_all on public.email_overrides for all using (public.is_admin()) with check (public.is_admin());

-- 5. Permissions: closed by default; give signed-in users only what the admin policies above then filter.
revoke all on public.form_submissions, public.marketing_consent, public.email_overrides from anon, authenticated;
grant select on public.form_submissions to authenticated;
grant update (status, note, handled_at) on public.form_submissions to authenticated;
grant select on public.marketing_consent to authenticated;
grant select, insert, update on public.email_overrides to authenticated;

-- 6. Housekeeping: delete submissions past their retention date. Only the server may run it. Schedule it weekly later, once the owner confirms the retention periods.
create or replace function public.purge_old_form_submissions() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  delete from public.form_submissions where delete_after < current_date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_old_form_submissions() from public, anon, authenticated;
grant execute on function public.purge_old_form_submissions() to service_role;

-- To undo (only if nothing has been stored yet):
--   drop function if exists public.purge_old_form_submissions();
--   drop table if exists public.email_overrides, public.marketing_consent, public.form_submissions;
