-- APPLIED to the live database 2026-11-13 (project ldmksxyilykyfnqnuytv). Safe to re-run.
-- Back office editor for the automatic emails: wording changes and an on/off switch per email, stored in email_overrides (read by send-email v15 at send time).
-- A change only replaces subject, preview line, heading, button text and the paragraphs; everything else stays as built. Removing the change restores the default.
-- The sign-in emails (auth-*), the campaign layout (newsletter) and the service notice (notice) are not editable here.
create or replace function public.admin_email_overrides()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare r text := public._need(array['admin']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('template_id', o.template_id, 'subject', o.subject, 'body', o.body, 'enabled', o.enabled, 'updated_at', o.updated_at) order by o.template_id) from public.email_overrides o), '[]'::jsonb);
end $$;

create or replace function public.admin_email_override_save(p_template text, p_subject text, p_pre text, p_title text, p_cta text, p_paras jsonb)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare r text := public._need(array['admin']);
  tid text := lower(trim(coalesce(p_template, ''))); sj text := left(trim(coalesce(p_subject, '')), 200);
  bd jsonb := '{}'::jsonb; el jsonb;
begin
  if tid !~ '^[a-z0-9-]{2,60}$' or tid in ('newsletter', 'notice') or tid like 'auth-%' then raise exception 'This email cannot be edited here.'; end if;
  if nullif(trim(coalesce(p_pre, '')), '') is not null then bd := bd || jsonb_build_object('pre', left(trim(p_pre), 300)); end if;
  if nullif(trim(coalesce(p_title, '')), '') is not null then bd := bd || jsonb_build_object('title', left(trim(p_title), 200)); end if;
  if nullif(trim(coalesce(p_cta, '')), '') is not null then bd := bd || jsonb_build_object('cta_label', left(trim(p_cta), 80)); end if;
  if p_paras is not null and jsonb_typeof(p_paras) = 'array' and jsonb_array_length(p_paras) > 0 then
    if jsonb_array_length(p_paras) > 12 then raise exception 'Up to 12 paragraphs.'; end if;
    for el in select * from jsonb_array_elements(p_paras) loop
      if jsonb_typeof(el) <> 'string' or length(trim(el #>> '{}')) = 0 then raise exception 'Every paragraph needs some text.'; end if;
      if length(el #>> '{}') > 1500 then raise exception 'A paragraph is too long (up to 1500 characters).'; end if;
    end loop;
    bd := bd || jsonb_build_object('paragraphs', p_paras);
  end if;
  if sj = '' and bd = '{}'::jsonb then
    update public.email_overrides set subject = null, body = null, updated_at = now(), updated_by = auth.uid() where template_id = tid;
    delete from public.email_overrides where template_id = tid and enabled is true and subject is null and body is null;
  else
    insert into public.email_overrides (template_id, subject, body, enabled, updated_at, updated_by)
    values (tid, nullif(sj, ''), nullif(bd, '{}'::jsonb), true, now(), auth.uid())
    on conflict (template_id) do update set subject = nullif(sj, ''), body = nullif(bd, '{}'::jsonb), updated_at = now(), updated_by = auth.uid();
  end if;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'email_wording_saved', tid);
  return jsonb_build_object('saved', true);
end $$;

create or replace function public.admin_email_override_reset(p_template text)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare r text := public._need(array['admin']); tid text := lower(trim(coalesce(p_template, '')));
begin
  update public.email_overrides set subject = null, body = null, updated_at = now(), updated_by = auth.uid() where template_id = tid;
  delete from public.email_overrides where template_id = tid and enabled is true and subject is null and body is null;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'email_wording_reset', tid);
  return jsonb_build_object('reset', true);
end $$;

create or replace function public.admin_email_set_enabled(p_template text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare r text := public._need(array['admin']); tid text := lower(trim(coalesce(p_template, '')));
begin
  if tid !~ '^[a-z0-9-]{2,60}$' or tid in ('newsletter', 'notice') or tid like 'auth-%' then raise exception 'This email cannot be switched here.'; end if;
  insert into public.email_overrides (template_id, enabled, updated_at, updated_by) values (tid, coalesce(p_enabled, true), now(), auth.uid())
  on conflict (template_id) do update set enabled = coalesce(p_enabled, true), updated_at = now(), updated_by = auth.uid();
  delete from public.email_overrides where template_id = tid and enabled is true and subject is null and body is null;
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), case when coalesce(p_enabled, true) then 'email_switched_on' else 'email_switched_off' end, tid);
  return jsonb_build_object('enabled', coalesce(p_enabled, true));
end $$;

revoke all on function public.admin_email_overrides() from public, anon;
revoke all on function public.admin_email_override_save(text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.admin_email_override_reset(text) from public, anon;
revoke all on function public.admin_email_set_enabled(text, boolean) from public, anon;
grant execute on function public.admin_email_overrides() to authenticated;
grant execute on function public.admin_email_override_save(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_email_override_reset(text) to authenticated;
grant execute on function public.admin_email_set_enabled(text, boolean) to authenticated;
notify pgrst, 'reload schema';
