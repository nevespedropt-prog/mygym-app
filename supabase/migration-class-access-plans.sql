-- MY GYM London - migration: list of Wix plans that include CLASS booking
-- Run once in: Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- This only RECORDS which Wix plans include classes, next to public.gym_access_plans (which lists the plans that include gym slots).
-- The app does not read this table yet: class booking in the live app is still not checked against a plan (owner decision 2026-10-09).
-- When the owner wants class booking limited to these plans, the check-gym-access function and the booking rule can use it.
-- Only the server can read or change it (row security on, no policies, no member access).

create table if not exists public.class_access_plans (
  plan_id text primary key,            -- Wix Pricing Plans plan id
  name text not null
);
alter table public.class_access_plans enable row level security;
revoke all on public.class_access_plans from anon, authenticated;

insert into public.class_access_plans (plan_id, name) values
  ('d65b7cac-3ed7-4115-9832-a464a9481885', 'Exercise Class Only Membership (2026)'),
  ('ff194708-9b38-4a59-a222-e34652da3d18', 'Exercise Class Only Membership (Black Friday)'),
  ('99052078-676a-4d0b-b733-98cf1af6594e', 'Exercise Classes (Annual Saving 13)'),
  ('fc8df227-f234-4b82-a6c2-2e674a369305', 'Gym & Exercise Class Membership (2026)'),
  ('8f33a3ff-f531-4a05-b007-d5a98143003f', 'Gym & Exercise Class Membership (Annual)'),
  ('e38b0fa1-6129-47ca-9503-64e4901b4e3b', 'Gym & Exercise Class Membership (Black Friday)'),
  ('3dd9db99-dc61-4635-923d-906383ab28e6', 'BHP Staff Exercise Class Membership'),
  ('d16285d3-c426-4920-887e-344d4e04ec5f', 'BHP Staff Gym Membership'),
  ('f2914d1f-0d3f-4e24-8039-79e49f03631f', 'BHP Staff Gym Membership (Annual)')
on conflict (plan_id) do nothing;

-- Still to add when they are created in Wix: Gym, Classes & 2 Personal Training Membership (classes and gym slots),
-- and Gym Membership (gym slots only, add to public.gym_access_plans).
