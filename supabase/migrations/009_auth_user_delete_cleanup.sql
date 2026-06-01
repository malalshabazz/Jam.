create or replace function public.cleanup_auth_user_dependencies()
returns trigger
language plpgsql
security definer
set search_path = public, storage, auth
as $$
begin
  if to_regclass('public.saved_videos') is not null then
    if to_regclass('public.videos') is not null then
      delete from public.saved_videos
      where user_id = old.id
         or video_id in (
           select id
           from public.videos
           where user_id = old.id
         );
    else
      delete from public.saved_videos
      where user_id = old.id;
    end if;
  end if;

  if to_regclass('public.jam_requests') is not null then
    delete from public.jam_requests
    where requester_id = old.id
       or recipient_id = old.id;
  end if;

  if to_regclass('public.daily_jam_usage') is not null then
    delete from public.daily_jam_usage
    where user_id = old.id;
  end if;

  if to_regclass('public.creator_likes') is not null then
    delete from public.creator_likes
    where liker_id = old.id
       or liked_id = old.id;
  end if;

  if to_regclass('public.direct_messages') is not null then
    delete from public.direct_messages
    where sender_id = old.id
       or recipient_id = old.id;
  end if;

  if to_regclass('public.inbox_messages') is not null then
    delete from public.inbox_messages
    where recipient_id = old.id;
  end if;

  if to_regclass('public.videos') is not null then
    delete from public.videos
    where user_id = old.id;
  end if;

  if to_regclass('public.profiles') is not null then
    delete from public.profiles
    where id = old.id;
  end if;

  return old;
end;
$$;

drop trigger if exists auth_users_cleanup_dependencies on auth.users;

create trigger auth_users_cleanup_dependencies
  before delete on auth.users
  for each row
  execute function public.cleanup_auth_user_dependencies();
