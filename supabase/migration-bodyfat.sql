-- MY GYM London — migration: body fat tracking
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe, idempotent)
alter table public.weight_logs add column if not exists body_fat_pct numeric;
alter table public.weight_logs alter column kg drop not null;
