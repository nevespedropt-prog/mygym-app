-- MY GYM London - migration: members suggest exercises that are not in the library
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run)
-- A suggestion is saved here, separate from the library. Once a week it is checked (see supabase/WEEKLY-EXERCISE-REVIEW.md)
-- and, if it is a real exercise, added to public.exercises. The member who suggested it can use it straight away.
create table if not exists public.exercise_suggestions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  muscle_group text not null check (char_length(muscle_group) between 2 and 20),
  status text not null default 'pending' check (status in ('pending', 'added', 'rejected')),
  final_name text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists exercise_suggestions_user_name_idx on public.exercise_suggestions (user_id, lower(name));
create index if not exists exercise_suggestions_status_idx on public.exercise_suggestions (status, created_at);

alter table public.exercise_suggestions enable row level security;
drop policy if exists sugg_insert on public.exercise_suggestions;
create policy sugg_insert on public.exercise_suggestions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and final_name is null and reviewed_at is null);
drop policy if exists sugg_read on public.exercise_suggestions;
create policy sugg_read on public.exercise_suggestions for select to authenticated using (user_id = auth.uid());

revoke all on public.exercise_suggestions from anon, authenticated;
grant select, insert on public.exercise_suggestions to authenticated;

-- at most 10 suggestions per member per day (stops one account filling the list)
create or replace function public.limit_exercise_suggestions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.exercise_suggestions where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many new exercises today. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.limit_exercise_suggestions() from public, anon, authenticated;
drop trigger if exists exercise_suggestions_limit on public.exercise_suggestions;
create trigger exercise_suggestions_limit before insert on public.exercise_suggestions
  for each row execute function public.limit_exercise_suggestions();
