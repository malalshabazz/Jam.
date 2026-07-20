-- Enforce blocks both ways for jams/DMs, and clean up relationships on block.

create or replace function public.users_are_blocked(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(user_a, user_b) is not null
    and user_a is distinct from user_b
    and exists (
      select 1
      from public.user_blocks
      where (blocker_id = user_a and blocked_id = user_b)
         or (blocker_id = user_b and blocked_id = user_a)
    );
$$;

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

  return new;
end;
$$;

drop trigger if exists user_blocks_cleanup_relationship on public.user_blocks;
create trigger user_blocks_cleanup_relationship
  after insert
  on public.user_blocks
  for each row
  execute function public.cleanup_relationship_on_block();

create or replace function public.send_jam_request(
  recipient_user_id uuid,
  message_body text default '',
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
  jam_limit integer;
  used_count integer;
  existing_request public.jam_requests;
  connection_exists boolean;
  incoming_pending_jam boolean;
  inserted_message public.direct_messages;
begin
  if sender_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if recipient_user_id = sender_user_id then
    raise exception 'Cannot jam yourself';
  end if;

  if public.users_are_blocked(sender_user_id, recipient_user_id) then
    raise exception 'Cannot jam this user';
  end if;

  if length(normalized_body) = 0 then
    raise exception 'Message required';
  end if;

  if length(normalized_body) > 200 then
    raise exception 'Message must be 200 characters or less';
  end if;

  if source_video_id is not null and not exists (
    select 1
    from public.videos
    where id = source_video_id
      and user_id = recipient_user_id
  ) then
    raise exception 'Video not found for this creator';
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

  if connection_exists then
    insert into public.direct_messages (sender_id, recipient_id, body, video_id)
    values (sender_user_id, recipient_user_id, normalized_body, source_video_id)
    returning * into inserted_message;

    return inserted_message;
  end if;

  select exists (
    select 1
    from public.jam_requests
    where requester_id = recipient_user_id
      and recipient_id = sender_user_id
      and connected_at is null
  )
  into incoming_pending_jam;

  if incoming_pending_jam then
    update public.jam_requests
    set connected_at = now()
    where requester_id = recipient_user_id
      and recipient_id = sender_user_id
      and connected_at is null;

    insert into public.direct_messages (sender_id, recipient_id, body, video_id)
    values (sender_user_id, recipient_user_id, normalized_body, source_video_id)
    returning * into inserted_message;

    return inserted_message;
  end if;

  select *
  into existing_request
  from public.jam_requests
  where requester_id = sender_user_id
    and recipient_id = recipient_user_id;

  if found and existing_request.connected_at is null then
    select *
    into inserted_message
    from public.direct_messages
    where sender_id = sender_user_id
      and recipient_id = recipient_user_id
    order by created_at desc
    limit 1;

    if found then
      return inserted_message;
    end if;

    insert into public.direct_messages (sender_id, recipient_id, body, video_id)
    values (sender_user_id, recipient_user_id, normalized_body, source_video_id)
    returning * into inserted_message;

    return inserted_message;
  end if;

  jam_limit := coalesce(public.get_daily_jam_limit(sender_user_id), 5);

  insert into public.daily_jam_usage (user_id, usage_date, jam_count, updated_at)
  values (sender_user_id, current_date, 0, now())
  on conflict (user_id, usage_date) do update
  set updated_at = now()
  returning jam_count into used_count;

  if used_count >= jam_limit then
    raise exception 'Daily jam limit reached';
  end if;

  insert into public.jam_requests (requester_id, recipient_id)
  values (sender_user_id, recipient_user_id)
  on conflict (requester_id, recipient_id) do nothing;

  update public.daily_jam_usage
  set jam_count = jam_count + 1,
      updated_at = now()
  where user_id = sender_user_id
    and usage_date = current_date;

  insert into public.direct_messages (sender_id, recipient_id, body, video_id)
  values (sender_user_id, recipient_user_id, normalized_body, source_video_id)
  returning * into inserted_message;

  return inserted_message;
end;
$$;

create or replace function public.send_direct_message(
  recipient_user_id uuid,
  message_body text
)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sender_user_id uuid := auth.uid();
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

  if length(trim(message_body)) = 0 then
    raise exception 'Message cannot be empty';
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

  insert into public.direct_messages (sender_id, recipient_id, body)
  values (sender_user_id, recipient_user_id, trim(message_body))
  returning * into inserted_message;

  return inserted_message;
end;
$$;

revoke all on function public.users_are_blocked(uuid, uuid) from public;
revoke all on function public.send_jam_request(uuid, text, uuid) from public;
revoke all on function public.send_direct_message(uuid, text) from public;

grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;
grant execute on function public.send_jam_request(uuid, text, uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
