-- MY GYM London — migration: multi-exercise workout sessions
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe, idempotent)
alter table public.workout_logs add column if not exists exercises jsonb;
alter table public.workout_logs alter column exercise drop not null;
