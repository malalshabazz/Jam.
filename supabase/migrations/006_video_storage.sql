insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

drop policy if exists "videos_storage_select_authenticated" on storage.objects;
drop policy if exists "videos_storage_insert_own" on storage.objects;
drop policy if exists "videos_storage_update_own" on storage.objects;
drop policy if exists "videos_storage_delete_own" on storage.objects;

create policy "videos_storage_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'videos');

create policy "videos_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "videos_storage_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "videos_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
