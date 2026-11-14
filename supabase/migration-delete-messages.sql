-- 2026-11-14. Back office Messages: delete one or many messages for good (owner and manager). APPLIED.
create or replace function public.admin_enquiry_delete(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); n integer;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Nothing to delete.'; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'Delete up to 500 messages at a time.'; end if;
  delete from public.form_submissions where id = any(p_ids);
  get diagnostics n = row_count;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'messages_deleted', n || ' message(s)');
  return jsonb_build_object('deleted', n);
end $$;
revoke all on function public.admin_enquiry_delete(uuid[]) from public, anon;
grant execute on function public.admin_enquiry_delete(uuid[]) to authenticated;
notify pgrst, 'reload schema';
