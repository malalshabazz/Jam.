-- Allow sharing your own video in a DM to someone you already jam with.
-- Text is optional when a video is attached.

create or replace function public.send_direct_message(
  recipient_user_id uuid,
  message_body text,
  source_video_id uuid default null
)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sender_user_id uuid := auth.uid();
  normalized_body text := trim(coalesce(message_body, ''));
  connection_exists boolean;
  incoming_pending_jam boolean;
  inserted_message public.direct_messages;
begin
  if sender_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if recipient_user_id = sender_user_id then
    raise exception 'Cannot message yourself';
  end if;

  if public.users_are_blocked(sender_user_id, recipient_user_id) then
    raise exception 'Cannot message this user';
  end if;

  if length(normalized_body) = 0 and source_video_id is null then
    raise exception 'Message cannot be empty';
  end if;

  if length(normalized_body) > 200 then
    raise exception 'Message must be 200 characters or less';
  end if;

  if source_video_id is not null and not exists (
    select 1
    from public.videos
    where id = source_video_id
      and user_id = sender_user_id
  ) then
    raise exception 'Video not found';
  end if;

  select exists (
    select 1
    from public.jam_requests
    where connected_at is not null
      and (
        (requester_id = sender_user_id and recipient_id = recipient_user_id)
        or (requester_id = recipient_user_id and recipient_id = sender_user_id)
      )
  )
  into connection_exists;

  select exists (
    select 1
    from public.jam_requests
    where requester_id = recipient_user_id
      and recipient_id = sender_user_id
      and connected_at is null
  )
  into incoming_pending_jam;

  if not connection_exists and not incoming_pending_jam then
    raise exception 'Send a jam first';
  end if;

  if incoming_pending_jam then
    update public.jam_requests
    set connected_at = now()
    where requester_id = recipient_user_id
      and recipient_id = sender_user_id
      and connected_at is null;
  end if;

  insert into public.direct_messages (sender_id, recipient_id, body, video_id)
  values (sender_user_id, recipient_user_id, normalized_body, source_video_id)
  returning * into inserted_message;

  return inserted_message;
end;
$$;

revoke all on function public.send_direct_message(uuid, text) from public;
revoke all on function public.send_direct_message(uuid, text, uuid) from public;

grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.send_direct_message(uuid, text, uuid) to authenticated;
