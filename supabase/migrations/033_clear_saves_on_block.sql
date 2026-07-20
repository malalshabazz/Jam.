-- Keep Saved clear of blocked creators (both directions).

create or replace function public.cleanup_relationship_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.direct_messages') is not null then
    delete from public.direct_messages
    where (sender_id = new.blocker_id and recipient_id = new.blocked_id)
       or (sender_id = new.blocked_id and recipient_id = new.blocker_id);
  end if;

  if to_regclass('public.jam_requests') is not null then
    delete from public.jam_requests
    where (requester_id = new.blocker_id and recipient_id = new.blocked_id)
       or (requester_id = new.blocked_id and recipient_id = new.blocker_id);
  end if;

  if to_regclass('public.creator_post_alerts') is not null then
    delete from public.creator_post_alerts
    where (user_id = new.blocker_id and creator_id = new.blocked_id)
       or (user_id = new.blocked_id and creator_id = new.blocker_id);
  end if;

  if to_regclass('public.user_hidden_creators') is not null then
    delete from public.user_hidden_creators
    where (user_id = new.blocker_id and hidden_user_id = new.blocked_id)
       or (user_id = new.blocked_id and hidden_user_id = new.blocker_id);
  end if;

  if to_regclass('public.saved_videos') is not null and to_regclass('public.videos') is not null then
    delete from public.saved_videos
    where user_id = new.blocker_id
      and video_id in (select id from public.videos where user_id = new.blocked_id);

    delete from public.saved_videos
    where user_id = new.blocked_id
      and video_id in (select id from public.videos where user_id = new.blocker_id);
  end if;

  return new;
end;
$$;
