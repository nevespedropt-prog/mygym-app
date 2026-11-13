-- 2026-11-13. Hide / show members on the back office list. (Permanent delete is done by the admin-edit-member function, which also records the email here so a failed Wix clean-up can never bring the person back.)
-- Hiding changes nothing in Wix or the app. It only removes the person from the Members list and from the possible-duplicates finder.
-- To undo: show the people again from Members > Hidden, then drop the table and the three functions; re-run migration-members-crm.sql and migration-possible-duplicates.sql to restore the originals.
create table if not exists public.hidden_members (
  email text primary key, name text, hidden_at timestamptz not null default now(), hidden_by uuid, reason text not null default 'hidden'
);
alter table public.hidden_members enable row level security;
revoke all on public.hidden_members from anon, authenticated;

-- the directory and the duplicates finder skip hidden people (patched in place, safe to re-run)
do $do$
declare d text; nl text := chr(10);
begin
  d := pg_get_functiondef('public._member_directory_core(integer)'::regprocedure);
  if position('hidden_members' in d) = 0 then
    if position('    limit greatest(1, least(coalesce(p_limit, 2000), 5000))' in d) = 0 then raise exception 'directory core text not found'; end if;
    d := replace(d, '    limit greatest(1, least(coalesce(p_limit, 2000), 5000))', '    where k.e not in (select h.email from public.hidden_members h)' || nl || '    limit greatest(1, least(coalesce(p_limit, 2000), 5000))');
    execute d;
  end if;
  d := pg_get_functiondef('public.admin_member_directory(integer)'::regprocedure);
  if position('hidden_members' in d) = 0 then
    if position($a$from public.manual_members m where coalesce(m.email, '') = ''$a$ in d) = 0 then raise exception 'directory wrapper text not found'; end if;
    d := replace(d, $a$from public.manual_members m where coalesce(m.email, '') = ''$a$, $b$from public.manual_members m where coalesce(m.email, '') = '' and 'manual:' || m.id not in (select h.email from public.hidden_members h)$b$);
    execute d;
  end if;
  d := pg_get_functiondef('public.admin_possible_duplicates()'::regprocedure);
  if position('hidden_members' in d) = 0 then
    if position($a$from public.wix_contacts w where w.email is not null and w.email <> ''$a$ in d) = 0 then raise exception 'duplicates text not found'; end if;
    d := replace(d, $a$from public.wix_contacts w where w.email is not null and w.email <> ''$a$, $b$from public.wix_contacts w where w.email is not null and w.email <> '' and lower(w.email) not in (select h.email from public.hidden_members h)$b$);
    execute d;
  end if;
end $do$;

create or replace function public.admin_member_hide(p_email text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); e text := lower(trim(coalesce(p_email, ''))); n text;
begin
  if e = '' or (position('@' in e) = 0 and e !~ '^manual:[0-9a-f-]{36}$') then raise exception 'That person has no email address, so they cannot be hidden here.'; end if;
  if position('@' in e) > 0 and (exists (select 1 from auth.users u join public.staff s on s.user_id = u.id where lower(u.email) = e)
     or exists (select 1 from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = e and p.is_admin)) then raise exception 'That person is on your team. Remove them from Team first.'; end if;
  select coalesce(nullif(trim(full_name), ''), '') into n from public.wix_contacts where lower(email) = e limit 1;
  if n is null and e like 'manual:%' then select full_name into n from public.manual_members where id::text = substr(e, 8); end if;
  insert into public.hidden_members (email, name, hidden_by, reason) values (e, n, auth.uid(), 'hidden') on conflict (email) do update set hidden_at = now(), hidden_by = auth.uid(), reason = 'hidden';
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'member_hidden', left(e, 200));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.admin_member_unhide(p_email text) returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']); e text := lower(trim(coalesce(p_email, '')));
begin
  delete from public.hidden_members where email = e and reason = 'hidden';
  insert into public.staff_access_log (user_id, action, target) values (auth.uid(), 'member_unhidden', left(e, 200));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.admin_hidden_members() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('email', h.email, 'name', h.name, 'at', h.hidden_at) order by h.hidden_at desc) from public.hidden_members h where h.reason = 'hidden'), '[]'::jsonb);
end $$;
do $$ declare f text; begin
  foreach f in array array['admin_member_hide(text)', 'admin_member_unhide(text)', 'admin_hidden_members()'] loop
    execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
notify pgrst, 'reload schema';
