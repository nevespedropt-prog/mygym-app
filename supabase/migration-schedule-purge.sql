-- MY GYM London: delete website form submissions once they pass their retention date (applied 2026-10-26).
-- Each submission has delete_after (2 years; Kids Gym 1 year). Runs every Sunday 03:30 UTC. Stop it:  select cron.unschedule('purge-old-form-submissions');
select cron.schedule('purge-old-form-submissions', '30 3 * * 0', 'select public.purge_old_form_submissions()');
