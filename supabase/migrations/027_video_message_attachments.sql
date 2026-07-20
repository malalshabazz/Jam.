-- Let jam messages reference the video they were sent from.

alter table public.direct_messages
  add column if not exists video_id uuid references public.videos(id) on delete set null;

create index if not exists direct_messages_video_id_idx
  on public.direct_messages(video_id)
  where video_id is not null;

drop function if exists public.send_jam_request(uuid, text);

create function public.send_jam_request(
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

revoke all on function public.send_jam_request(uuid, text, uuid) from public;
grant execute on function public.send_jam_request(uuid, text, uuid) to authenticated;

-- Keep video attachments immutable after send (body edits / read receipts only).
create or replace function public.enforce_direct_message_update_permissions()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if current_user_id = old.sender_id then
    if new.id is distinct from old.id
      or new.sender_id is distinct from old.sender_id
      or new.recipient_id is distinct from old.recipient_id
      or new.read_at is distinct from old.read_at
      or new.created_at is distinct from old.created_at
      or new.video_id is distinct from old.video_id then
      raise exception 'Message sender can only edit message body';
    end if;

    return new;
  end if;

  if current_user_id = old.recipient_id then
    if new.id is distinct from old.id
      or new.sender_id is distinct from old.sender_id
      or new.recipient_id is distinct from old.recipient_id
      or new.body is distinct from old.body
      or new.created_at is distinct from old.created_at
      or new.video_id is distinct from old.video_id then
      raise exception 'Message recipient can only update read status';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update this message';
end;
$$;
