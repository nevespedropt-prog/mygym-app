-- MY GYM London: a photo of every member, so the team can recognise them at the gym (written 2026-11-21).
-- The picture lives in a PRIVATE storage bucket, one file per member: member-photos/<member id>/photo.jpg (the app and website shrink it to about 600 pixels first).
-- A member can add, replace and remove only their own photo. Any signed-in staff member can look at photos (to recognise people at the door).
-- profiles.photo_at says whether a member has one, so the back office can show who still needs to add theirs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "member photos: own insert" on storage.objects;
drop policy if exists "member photos: own update" on storage.objects;
drop policy if exists "member photos: own delete" on storage.objects;
drop policy if exists "member photos: own read" on storage.objects;
drop policy if exists "member photos: staff read" on storage.objects;
create policy "member photos: own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member photos: own update" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member photos: own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member photos: own read" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member photos: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and exists (select 1 from public.staff s where s.user_id = auth.uid()));

alter table public.profiles add column if not exists photo_at timestamptz;

-- the member tells us their photo is saved (or removed); we check the file really is there
create or replace function public.my_photo_saved(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public, auth, storage, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in.'; end if;
  if p_on then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'member-photos' and o.name = uid::text || '/photo.jpg') then raise exception 'We could not find your photo. Please try again.'; end if;
    update public.profiles set photo_at = now() where id = uid;
  else
    update public.profiles set photo_at = null where id = uid;
  end if;
  return jsonb_build_object('ok', true, 'has_photo', p_on);
end $$;

-- back office: who has a photo (member ids), and how many app members with a live plan still have none
create or replace function public.admin_photos() returns jsonb
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare r text := public._need(array['admin', 'manager', 'reception', 'coach']);
begin
  return jsonb_build_object(
    'with', coalesce((select jsonb_agg(id) from public.profiles where photo_at is not null), '[]'::jsonb),
    'missing_members', (select count(distinct u.id) from public.wix_orders o join auth.users u on lower(u.email) = lower(o.email) join public.profiles p on p.id = u.id
                        where o.status = 'ACTIVE' and p.photo_at is null and not exists (select 1 from public.staff s where s.user_id = u.id)));
end $$;

revoke all on function public.my_photo_saved(boolean) from public, anon;
revoke all on function public.admin_photos() from public, anon;
grant execute on function public.my_photo_saved(boolean) to authenticated;
grant execute on function public.admin_photos() to authenticated;
notify pgrst, 'reload schema';
