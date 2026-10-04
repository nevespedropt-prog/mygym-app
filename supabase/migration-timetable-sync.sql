-- ============================================================
-- MY GYM London: automatic timetable sync (step 1 of 2: database)
-- NOT RUN YET. Run once in: Supabase Dashboard -> SQL Editor.
-- Safe to re-run.
--
-- It adds a "source" marker so the sync only ever touches classes it created
-- (source = 'wix'), a duplicate guard, and a tiny log table for the sync function.
-- Gym hour slots and any class added by hand are never touched.
-- Step 2 (the hourly schedule) is in schedule-timetable-sync.sql: run it AFTER the
-- function is deployed and a dry run looks right.
-- ============================================================
begin;

alter table public.classes add column if not exists source text not null default 'manual';

-- the real timetable loaded from the website on 2026-10-04 belongs to the sync from now on
update public.classes set source = 'wix' where kind = 'class' and active and source = 'manual';

-- the same class can't be active twice at the same day and time
create unique index if not exists classes_wix_unique
  on public.classes (day_name, start_time, name)
  where kind = 'class' and source = 'wix' and active;

create table if not exists public.sync_log (
  id text primary key,
  last_call timestamptz not null default now(),
  last_run timestamptz,
  last_result jsonb
);
alter table public.sync_log enable row level security;   -- no policies: only the server can use it

commit;
