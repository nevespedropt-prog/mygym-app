-- 2026-11-14. Pressing Mark done or Decline on a membership request now emails the member (a service email through the existing notice template: no marketing consent needed, no unsubscribe link). APPLIED.
-- The email template adds the greeting itself, so the body starts with the message. Replaces admin_membership_request_resolve from migration-membership-requests.sql.
create or replace function public.admin_membership_request_resolve(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); q public.membership_requests; fn text; act text; body text; subj text; ttl text; note text;
begin
  if p_status not in ('done', 'declined') then raise exception 'Choose done or declined.'; end if;
  update public.membership_requests set status = p_status, resolved_at = now(), resolved_by = auth.uid(), staff_note = left(nullif(trim(coalesce(p_note, '')), ''), 300)
   where membership_requests.id = p_id and status = 'received' returning * into q;
  if not found then raise exception 'That request is no longer waiting.'; end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'membership_request_' || p_status, p_id::text);
  select split_part(trim(coalesce(nullif(p.full_name, ''), '')), ' ', 1) into fn from public.profiles p where p.id = q.user_id;
  fn := coalesce(nullif(fn, ''), 'there');
  act := case q.request_type when 'pause' then 'pause your membership' when 'cancel' then 'cancel your membership' else 'change your plan' end;
  note := coalesce(nullif(trim(q.staff_note), ''), '');
  if p_status = 'done' then
    subj := case q.request_type when 'pause' then 'Your membership is paused' when 'cancel' then 'Your membership is cancelled' else 'Your plan is changed' end;
    ttl := 'Your request is done';
    body := 'We have done what you asked: we have ' || case q.request_type when 'pause' then 'paused your membership' when 'cancel' then 'cancelled your membership' else 'changed your plan' end || ', from ' || to_char(q.from_date, 'FMDD FMMonth YYYY') || '.'
      || case when note <> '' then E'\n\n' || note else '' end || E'\n\nYou can see it any time in the app under Me > My membership, or on your account on our website.\n\nAny questions, just reply to this email.';
  else
    subj := 'About your membership request';
    ttl := 'We could not do your request';
    body := 'We were not able to ' || act || ' as you asked.' || case when note <> '' then E'\n\n' || note else E'\n\nWe will be in touch shortly to sort it out.' end || E'\n\nReply to this email and we will help.';
  end if;
  perform public.queue_email('notice', q.user_id, q.email,
    jsonb_build_object('first_name', fn, 'campaign_subject', subj, 'campaign_preheader', subj, 'campaign_title', ttl, 'campaign_body', body, 'campaign_button', 'Open the app', 'campaign_url', 'https://app.mygymlondon.co.uk/'),
    'mreq-res:' || q.id::text);
  return jsonb_build_object('ok', true);
end $$;
