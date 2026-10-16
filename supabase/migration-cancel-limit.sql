-- Cancel limit: a member can cancel a booking up to 10 minutes before the session starts.
-- Class times are London time (same rule as the push reminders). Same rule is set in Wix (Default booking policy).
-- APPLIED 2026-10-16 in the Supabase SQL editor (Success. No rows returned).
-- Only deletes made by the signed-in member are limited. Server, staff and account-deletion cascades are not.

create or replace function public.enforce_cancel_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  st timestamptz;
begin
  if auth.uid() is null or old.user_id is distinct from auth.uid() then
    return old;
  end if;
  select ((old.date::text || ' ' || c.start_time)::timestamp at time zone 'Europe/London')
    into st from public.classes c where c.id = old.class_id;
  if st is not null and now() > st - interval '10 minutes' then
    raise exception 'Too late to cancel: you can cancel up to 10 minutes before the session starts.';
  end if;
  return old;
end $$;

drop trigger if exists cancel_limit on public.class_bookings;
create trigger cancel_limit before delete on public.class_bookings
  for each row execute function public.enforce_cancel_limit();

-- To undo: drop trigger if exists cancel_limit on public.class_bookings;
