-- ============================================================
-- MY GYM London: real class timetable (matches www.mygymlondon.co.uk/our-classes)
-- NOT RUN YET. Run once in: Supabase Dashboard -> SQL Editor.
--
-- What it does:
--   1. Hides ("retires") every existing class row. They are kept, not deleted,
--      so nobody's booking history is lost. This also removes the duplicate
--      placeholder classes that were in the app.
--   2. Adds the 29 real weekly sessions from the website (gym hours are not touched).
--
-- Safe to re-run: if the real timetable is already in place it does nothing.
-- To undo: set active = true on the retired rows and active = false on the new ones.
-- Capacity: 10 people per class, Pilates 15 (as set on the website). Change the numbers below if needed.
-- ============================================================
do $$
begin
  if exists (select 1 from public.classes where kind = 'class' and active and name = 'Cardio n Abs') then
    raise notice 'Real timetable already applied, nothing to do';
    return;
  end if;

  update public.classes set active = false where kind = 'class' and active;

  insert into public.classes (day_name, start_time, name, coach, info, capacity, sort, kind) values
    ('Monday', '07:00', 'Cardio n Abs', '', '30 min', 10, 420, 'class'),
    ('Monday', '07:30', 'HIIT', '', '30 min', 10, 450, 'class'),
    ('Monday', '09:00', 'BoxFit', '', '30 min', 10, 540, 'class'),
    ('Monday', '09:30', 'Strength', '', '30 min', 10, 570, 'class'),
    ('Monday', '10:00', 'Vitality 50+ Circuit', '', '1 hr', 10, 600, 'class'),
    ('Monday', '18:00', 'Cardio n Abs', '', '1 hr', 10, 1080, 'class'),
    ('Monday', '18:30', 'Pilates', '', '1 hr', 15, 1110, 'class'),
    ('Monday', '19:00', 'Strength', '', '1 hr', 10, 1140, 'class'),
    ('Tuesday', '09:00', 'HIIT', '', '30 min', 10, 540, 'class'),
    ('Tuesday', '09:30', 'Cardio n Abs', '', '30 min', 10, 570, 'class'),
    ('Tuesday', '18:00', 'Abs Attack', '', '1 hr', 10, 1080, 'class'),
    ('Wednesday', '07:00', 'HIIT Glow', '', '30 min', 10, 420, 'class'),
    ('Wednesday', '07:30', 'Cardio n Abs', '', '30 min', 10, 450, 'class'),
    ('Wednesday', '09:00', 'BoxFit', '', '30 min', 10, 540, 'class'),
    ('Wednesday', '09:30', 'Strength', '', '30 min', 10, 570, 'class'),
    ('Wednesday', '18:00', 'Strength', '', '1 hr', 10, 1080, 'class'),
    ('Wednesday', '19:00', 'BoxFit', '', '30 min', 10, 1140, 'class'),
    ('Thursday', '09:00', 'HIIT', '', '30 min', 10, 540, 'class'),
    ('Thursday', '09:30', 'Cardio n Abs', '', '30 min', 10, 570, 'class'),
    ('Thursday', '18:00', 'HIIT', '', '1 hr', 10, 1080, 'class'),
    ('Friday', '07:00', 'Strength', '', '30 min', 10, 420, 'class'),
    ('Friday', '07:30', 'Abs Attack', '', '30 min', 10, 450, 'class'),
    ('Friday', '09:00', 'Cardio n Abs', '', '30 min', 10, 540, 'class'),
    ('Friday', '09:30', 'Strength', '', '30 min', 10, 570, 'class'),
    ('Friday', '10:00', 'Vitality 50+ Circuit', '', '1 hr', 10, 600, 'class'),
    ('Friday', '18:30', 'Body Conditioning', '', '1 hr', 10, 1110, 'class'),
    ('Friday', '19:00', 'Body Conditioning', '', '1 hr', 10, 1140, 'class'),
    ('Saturday', '10:00', 'Strength', '', '1 hr', 10, 600, 'class'),
    ('Sunday', '09:00', 'Strength', '', '1 hr', 10, 540, 'class');
end $$;
