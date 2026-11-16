-- Marketing: delete any campaign (except one that is sending right now) and correct the wording of a sent one.
-- Deleting a sent campaign removes the record only. Emails already sent stay sent.
create or replace function public.admin_campaign_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']);
begin
  delete from public.marketing_campaigns where id = p_id and status in ('draft', 'scheduled', 'sent');
  if not found then raise exception 'A campaign that is sending right now cannot be deleted. Wait until it has finished.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'campaign_deleted', p_id::text);
  return jsonb_build_object('deleted', true);
end $$;

-- Change the wording kept on record for a sent campaign (does not email anyone)
create or replace function public.admin_campaign_edit_sent(p_id uuid, p_subject text, p_preheader text, p_title text, p_body text, p_button text, p_url text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin']); out public.marketing_campaigns%rowtype;
begin
  update public.marketing_campaigns set subject = left(trim(coalesce(p_subject, '')), 200), preheader = left(trim(coalesce(p_preheader, '')), 200), title = left(trim(coalesce(p_title, '')), 200),
    body = left(trim(coalesce(p_body, '')), 4000), button = left(trim(coalesce(p_button, '')), 60), url = left(trim(coalesce(p_url, '')), 500), updated_at = now()
  where id = p_id and status = 'sent' returning * into out;
  if not found then raise exception 'Only a sent campaign can be changed this way.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'campaign_record_edited', p_id::text);
  return public._campaign_json(out);
end $$;
revoke all on function public.admin_campaign_edit_sent(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_campaign_edit_sent(uuid, text, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
