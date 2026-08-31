-- Public buckets stay publicly fetchable by known URL. SELECT on storage.objects
-- is what allows listing — restrict that to each user's own prefix.
-- Account delete must also wipe post-media. Recipients may mark inbox as read.

drop policy if exists "avatars_storage_select_public" on storage.objects;
drop policy if exists "avatars_storage_select_own" on storage.objects;

create policy "avatars_storage_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_media_storage_select_public" on storage.objects;
drop policy if exists "post_media_storage_select_own" on storage.objects;

create policy "post_media_storage_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.cleanup_auth_user_storage()
returns trigger
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  delete from storage.objects
  where bucket_id in ('avatars', 'videos', 'post-media')
    and (storage.foldername(name))[1] = old.id::text;

  return old;
end;
$$;

drop policy if exists "inbox_messages_update_own" on public.inbox_messages;
drop policy if exists "inbox_messages_update_own_read" on public.inbox_messages;

create policy "inbox_messages_update_own_read"
  on public.inbox_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create or replace function public.enforce_inbox_message_read_only()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from old.recipient_id then
    raise exception 'Not authorized to update this message';
  end if;

  if new.id is distinct from old.id
    or new.recipient_id is distinct from old.recipient_id
    or new.sender_name is distinct from old.sender_name
    or new.sender_avatar is distinct from old.sender_avatar
    or new.message_type is distinct from old.message_type
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at then
    raise exception 'Inbox messages can only be marked read';
  end if;

  return new;
end;
$$;

drop trigger if exists inbox_messages_enforce_read_only on public.inbox_messages;
create trigger inbox_messages_enforce_read_only
  before update on public.inbox_messages
  for each row
  execute function public.enforce_inbox_message_read_only();
