-- Free trial bookings: a person booked in free by staff. Their details are kept so a second request is spotted and they can be pointed to a membership or pay as you go.
-- Removing the booking (walkin_bookings row) also removes the trial record, so a cancelled trial does not count as used.
alter table public.walkin_bookings drop constraint if exists walkin_bookings_kind_check;
alter table public.walkin_bookings add constraint walkin_bookings_kind_check check (kind in ('payg', 'member', 'trial'));

create table if not exists public.free_trials (
  id uuid primary key default gen_random_uuid(),
  walkin_id uuid unique references public.walkin_bookings(id) on delete cascade,
  name text not null, email text, phone text, phone_key text,
  class_id bigint references public.classes(id) on delete set null,
  class_name text, date text not null,
  created_by uuid, created_at timestamptz not null default now()
);
create index if not exists free_trials_email on public.free_trials (lower(email));
create index if not exists free_trials_phone on public.free_trials (phone_key);
alter table public.free_trials enable row level security;
revoke all on public.free_trials from anon, authenticated;

-- list for the back office (admin, manager, reception)
create or replace function public.admin_free_trials() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'email', t.email, 'phone', t.phone, 'class', t.class_name, 'date', t.date,
    'member', exists (select 1 from public.wix_orders o where t.email is not null and lower(o.email) = lower(t.email) and o.status = 'ACTIVE')) order by t.date desc, t.created_at desc)
    from public.free_trials t), '[]'::jsonb);
end $$;
revoke all on function public.admin_free_trials() from public, anon;
grant execute on function public.admin_free_trials() to authenticated;
notify pgrst, 'reload schema';
