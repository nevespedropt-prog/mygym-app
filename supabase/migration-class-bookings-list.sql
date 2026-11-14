-- Timetable drawer: who is booked on one date of a class (applied live 2026-11-14)
create or replace function public.admin_class_bookings(p_class_id bigint, p_date text)
returns jsonb language plpgsql stable security definer set search_path to 'public','auth','pg_temp' as $f$
declare r text := public._need(array['admin','manager','reception','coach']);
begin
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Bad date'; end if;
  return jsonb_build_object(
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', coalesce(nullif(trim(pr.full_name), ''), u.email, 'Member'), 'email', u.email, 'source', coalesce(b.source, 'app')) order by b.created_at)
      from public.class_bookings b left join public.profiles pr on pr.id = b.user_id left join auth.users u on u.id = b.user_id where b.class_id = p_class_id and b.date = p_date), '[]'::jsonb),
    'walkins', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'kind', k.kind, 'amount', k.amount, 'paid', k.paid_at_gym, 'phone', k.phone) order by k.created_at)
      from public.walkin_bookings k where k.class_id = p_class_id and k.date = p_date), '[]'::jsonb),
    'other_wix', (select count(*) from public.wix_other_bookings w where w.class_id = p_class_id and w.date = p_date and w.wix_booking_id not in (select wix_booking_id from public.walkin_bookings where wix_booking_id is not null)));
end $f$;
revoke all on function public.admin_class_bookings(bigint, text) from public, anon;
grant execute on function public.admin_class_bookings(bigint, text) to authenticated;
notify pgrst, 'reload schema';
