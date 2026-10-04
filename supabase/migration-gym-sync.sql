-- ============================================================
-- MY GYM London: let the timetable sync manage the gym hours too
-- NOT RUN YET. Run once in: Supabase Dashboard -> SQL Editor, BEFORE updating the sync-timetable function.
-- Safe to re-run.
--
-- The 133 gym hour rows were created by hand (source = 'manual'). This marks them as managed by the
-- sync (source = 'wix') so it updates them instead of creating copies, and adds a duplicate guard.
-- ============================================================
begin;

update public.classes set source = 'wix' where kind = 'gym' and active and source = 'manual';

create unique index if not exists classes_gym_wix_unique
  on public.classes (day_name, start_time)
  where kind = 'gym' and source = 'wix' and active;

commit;
