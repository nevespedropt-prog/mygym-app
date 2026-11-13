-- 2026-11-13. Full-body editing of the automatic emails: the owner can rewrite every block (paragraphs, small headings, highlighted boxes, bullet lists,
-- details tables, small print) and add, remove or reorder them. Stored in email_overrides.body -> 'blocks' and read by send-email v16, which checks every block again
-- (a block with a wrong shape or an unknown {{placeholder}} makes the whole change ignored, so an edit can never break an email).
-- The older admin_email_override_save (subject, preview, heading, button, paragraphs) stays as it is. Removing the change restores the default.
create or replace function public.admin_email_override_save_blocks(p_template text, p_subject text, p_pre text, p_title text, p_cta text, p_blocks jsonb)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare r text := public._need(array['admin']);
  tid text := lower(trim(coalesce(p_template, ''))); sj text := left(trim(coalesce(p_subject, '')), 200);
  bd jsonb := '{}'::jsonb; el jsonb; k text; n int := 0; rw jsonb;
begin
  if tid !~ '^[a-z0-9-]{2,60}$' or tid in ('newsletter', 'notice') or tid like 'auth-%' then raise exception 'This email cannot be edited here.'; end if;
  if nullif(trim(coalesce(p_pre, '')), '') is not null then bd := bd || jsonb_build_object('pre', left(trim(p_pre), 300)); end if;
  if nullif(trim(coalesce(p_title, '')), '') is not null then bd := bd || jsonb_build_object('title', left(trim(p_title), 200)); end if;
  if nullif(trim(coalesce(p_cta, '')), '') is not null then bd := bd || jsonb_build_object('cta_label', left(trim(p_cta), 80)); end if;
  if p_blocks is not null and jsonb_typeof(p_blocks) = 'array' and jsonb_array_length(p_blocks) > 0 then
    if jsonb_array_length(p_blocks) > 40 then raise exception 'Up to 40 blocks.'; end if;
    for el in select * from jsonb_array_elements(p_blocks) loop
      n := n + 1;
      if jsonb_typeof(el) <> 'object' then raise exception 'Block % is not valid.', n; end if;
      if (select count(*) from jsonb_object_keys(el) x where x in ('p', 'h', 'note', 'muted', 'list', 'kv')) <> 1 then raise exception 'Block % must be exactly one kind.', n; end if;
      if exists (select 1 from jsonb_object_keys(el) x where x not in ('p', 'h', 'note', 'muted', 'list', 'kv', 'if')) then raise exception 'Block % has an unknown part.', n; end if;
      if el ? 'if' and (jsonb_typeof(el -> 'if') <> 'string' or (el ->> 'if') !~ '^[a-z0-9_]{1,60}$') then raise exception 'Block % has a bad condition.', n; end if;
      k := (select x from jsonb_object_keys(el) x where x in ('p', 'h', 'note', 'muted', 'list', 'kv') limit 1);
      if k in ('p', 'h', 'note', 'muted') then
        if jsonb_typeof(el -> k) <> 'string' or length(trim(el ->> k)) = 0 then raise exception 'Block % needs some text.', n; end if;
        if length(el ->> k) > 1500 then raise exception 'Block % is too long (up to 1500 characters).', n; end if;
      elsif k = 'list' then
        if jsonb_typeof(el -> k) <> 'array' or jsonb_array_length(el -> k) = 0 or jsonb_array_length(el -> k) > 12 then raise exception 'Block % needs 1 to 12 bullet points.', n; end if;
        for rw in select * from jsonb_array_elements(el -> k) loop
          if jsonb_typeof(rw) <> 'string' or length(trim(rw #>> '{}')) = 0 or length(rw #>> '{}') > 600 then raise exception 'Every bullet point in block % needs some text (up to 600 characters).', n; end if;
        end loop;
      else
        if jsonb_typeof(el -> k) <> 'array' or jsonb_array_length(el -> k) = 0 or jsonb_array_length(el -> k) > 14 then raise exception 'Block % needs 1 to 14 table rows.', n; end if;
        for rw in select * from jsonb_array_elements(el -> k) loop
          if jsonb_typeof(rw) <> 'array' or jsonb_array_length(rw) not between 2 and 3 or jsonb_typeof(rw -> 0) <> 'string' or jsonb_typeof(rw -> 1) <> 'string'
             or length(trim(rw ->> 0)) = 0 or length(trim(rw ->> 1)) = 0 or length(rw ->> 0) > 120 or length(rw ->> 1) > 400 then raise exception 'Every table row in block % needs a label and a value.', n; end if;
          if jsonb_array_length(rw) = 3 and (jsonb_typeof(rw -> 2) <> 'string' or (rw ->> 2) !~ '^[a-z0-9_]{1,60}$') then raise exception 'A table row in block % has a bad condition.', n; end if;
        end loop;
      end if;
    end loop;
    bd := bd || jsonb_build_object('blocks', p_blocks);
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
revoke all on function public.admin_email_override_save_blocks(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.admin_email_override_save_blocks(text, text, text, text, text, jsonb) to authenticated;
notify pgrst, 'reload schema';
