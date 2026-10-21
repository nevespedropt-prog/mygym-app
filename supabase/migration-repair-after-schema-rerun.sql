-- MY GYM London: repair after the old schema.sql was run again by mistake on 2026-10-21. NOT part of normal setup.
-- Running schema.sql re-creates things that later migrations had changed or removed. This script puts them back:
--  1. bookings_select let ANY signed-in member read every booking: dropped again (migration-security-hardening.sql had removed it).
--  2. schema.sql added 19 sample classes (ids 228-246, source manual, active): switched off (the hourly timetable sync would also retire them).
-- NEVER run supabase/schema.sql again on the live project. The saved query named MYGYM LONDON in the SQL editor contains it: delete that saved query.

drop policy if exists bookings_select on public.class_bookings;

update public.classes set active = false where source = 'manual' and id between 228 and 246 and active;
