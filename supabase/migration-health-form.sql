-- MY GYM London - migration: health and allergy form with explicit consent (UK GDPR special category data)
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run).
--
-- It also records the member's separate, optional consent to keep weight and body fat measurements. Without that
-- consent the app switches tracking off and deletes any measurements the member had already saved.
--
-- What it stores: the member's tick-box health answers, allergies and any notes, plus proof of consent
-- (what they agreed to, which wording version, when). Each member can see, change or delete only their own.
-- Withdrawing consent in the app deletes the answers. A small log of consent events (no health details) is kept.
-- Retention: answers are deleted automatically when the member has not signed in for 12 months (monthly job
-- below), and immediately if their account is deleted.

begin;

create table if not exists public.member_health (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  no_allergies boolean not null default false,
  allergies text not null default '' check (char_length(allergies) <= 500),
  other_details text not null default '' check (char_length(other_details) <= 1000),
  consent_health boolean not null check (consent_health),       -- explicit consent to keep the health answers
  consent_truthful boolean not null check (consent_truthful),   -- answers are true; will say if they change
  consent_measurements boolean not null default false,          -- optional: keep weight and body fat measurements
  measurements_consented_at timestamptz,
  consent_version text not null check (char_length(consent_version) <= 40),
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 2000)
);

create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('given', 'updated', 'withdrawn', 'measurements_on', 'measurements_off')),
  version text not null check (char_length(version) <= 40),
  created_at timestamptz not null default now()
);

-- (re-run safety) columns added after the first version of this script
alter table public.member_health add column if not exists consent_measurements boolean not null default false;
alter table public.member_health add column if not exists measurements_consented_at timestamptz;

alter table public.member_health enable row level security;
alter table public.consent_log enable row level security;

drop policy if exists health_own_select on public.member_health;
create policy health_own_select on public.member_health for select to authenticated using (user_id = auth.uid());
drop policy if exists health_own_insert on public.member_health;
create policy health_own_insert on public.member_health for insert to authenticated with check (user_id = auth.uid());
drop policy if exists health_own_update on public.member_health;
create policy health_own_update on public.member_health for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists health_own_delete on public.member_health;
create policy health_own_delete on public.member_health for delete to authenticated using (user_id = auth.uid());
-- gym staff marked is_admin can read members' forms (nobody is admin yet; the owner can also use the dashboard table viewer)
drop policy if exists health_admin_read on public.member_health;
create policy health_admin_read on public.member_health for select to authenticated using (public.is_admin());

drop policy if exists consent_own_select on public.consent_log;
create policy consent_own_select on public.consent_log for select to authenticated using (user_id = auth.uid());
drop policy if exists consent_own_insert on public.consent_log;
create policy consent_own_insert on public.consent_log for insert to authenticated with check (user_id = auth.uid());
drop policy if exists consent_admin_read on public.consent_log;
create policy consent_admin_read on public.consent_log for select to authenticated using (public.is_admin());

revoke all on public.member_health, public.consent_log from anon, authenticated;
grant select, insert, update, delete on public.member_health to authenticated;
grant select, insert on public.consent_log to authenticated;

-- automatic clean-up: health answers of members who have not signed in for 12 months
create or replace function public.purge_inactive_health()
returns int language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  delete from public.member_health h
  using auth.users u
  where u.id = h.user_id
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_inactive_health() from public, anon, authenticated;

commit;

create extension if not exists pg_cron;
select cron.schedule('purge-inactive-health', '30 3 1 * *', $cron$ select public.purge_inactive_health(); $cron$);
