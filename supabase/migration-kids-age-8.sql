-- Kids Gym is for children aged 8 and over (owner decision 2026-10-27). Applied to the live database on 2026-10-27.
-- Only text changes: old inactive "Kids Class" rows and the two kids workout templates said ages 6-11.
update public.classes set info = replace(info, 'ages 6-11', 'ages 8+') where info like '%ages 6-11%';
update public.workout_templates set name = replace(name, '(ages 6-11)', '(ages 8+)') where name like '%(ages 6-11)%';
