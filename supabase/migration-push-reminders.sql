-- MY GYM London - migration: push reminders one hour before a booking (step 1 of 2: tables)
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to re-run).
-- Step 2 is schedule-class-reminders.sql, after the send-class-reminders function is deployed.

begin;

-- one row per phone/browser that switched reminders on (a member can have several)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- which bookings already got their reminder (server only; nobody else can read or write it)
create table if not exists public.booking_reminders (
  booking_id uuid primary key references public.class_bookings(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.booking_reminders enable row level security;

drop policy if exists push_own_select on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists push_own_insert on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions, public.booking_reminders from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Bookings that start 55 to 65 minutes from now (UK time), made more than an hour ahead, with no
-- reminder sent yet, for members who have at least one phone switched on. Called by the function only.
create or replace function public.due_class_reminders()
returns table (booking_id uuid, user_id uuid, kind text, class_name text, start_hhmm text,
               endpoint text, p256dh text, auth text)
language sql security definer set search_path = public stable as $$
  select b.id, b.user_id, c.kind, c.name, c.start_time, s.endpoint, s.p256dh, s.auth
  from public.class_bookings b
  join public.classes c on c.id = b.class_id
  join public.push_subscriptions s on s.user_id = b.user_id
  where not exists (select 1 from public.booking_reminders r where r.booking_id = b.id)
    and ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London')
        between now() + interval '55 minutes' and now() + interval '65 minutes'
    and b.created_at < ((b.date || ' ' || c.start_time)::timestamp at time zone 'Europe/London') - interval '60 minutes';
$$;
revoke all on function public.due_class_reminders() from public, anon, authenticated;
grant execute on function public.due_class_reminders() to service_role;

grant select, insert on public.booking_reminders to service_role;
grant select, delete on public.push_subscriptions to service_role;

commit;
