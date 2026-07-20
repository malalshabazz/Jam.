create or replace function public.cleanup_auth_user_storage()
returns trigger
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  delete from storage.objects
  where bucket_id in ('avatars', 'videos')
    and (storage.foldername(name))[1] = old.id::text;

  return old;
end;
$$;

revoke all on function public.cleanup_auth_user_storage() from public;

drop trigger if exists auth_users_cleanup_storage on auth.users;

create trigger auth_users_cleanup_storage
  before delete on auth.users
  for each row
  execute function public.cleanup_auth_user_storage();
