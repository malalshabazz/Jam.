create table if not exists public.saved_videos (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.jam_requests (
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  connected_at timestamptz,
  primary key (requester_id, recipient_id),
  constraint jam_requests_no_self check (requester_id <> recipient_id)
);

create table if not exists public.daily_jam_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  jam_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date),
  constraint daily_jam_usage_non_negative check (jam_count >= 0)
);

alter table public.saved_videos enable row level security;
alter table public.jam_requests enable row level security;
alter table public.daily_jam_usage enable row level security;

drop policy if exists "saved_videos_select_own" on public.saved_videos;
drop policy if exists "saved_videos_insert_own" on public.saved_videos;
drop policy if exists "saved_videos_delete_own" on public.saved_videos;

create policy "saved_videos_select_own"
  on public.saved_videos
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_videos_insert_own"
  on public.saved_videos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_videos_delete_own"
  on public.saved_videos
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jam_requests_select_participant" on public.jam_requests;

create policy "jam_requests_select_participant"
  on public.jam_requests
  for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "daily_jam_usage_select_own" on public.daily_jam_usage;

create policy "daily_jam_usage_select_own"
  on public.daily_jam_usage
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.get_daily_jam_limit(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(early_adopter, false) then 15
    else 5
  end
  from public.profiles
  where id = target_user_id
$$;

create or replace function public.send_jam_request(
  recipient_user_id uuid,
  message_body text default ''
)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sender_user_id uuid := auth.uid();
  normalized_body text := coalesce(nullif(trim(message_body), ''), 'Hey, let''s jam.');
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

  if length(normalized_body) > 200 then
    raise exception 'Message must be 200 characters or less';
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
    insert into public.direct_messages (sender_id, recipient_id, body)
    values (sender_user_id, recipient_user_id, normalized_body)
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

    insert into public.direct_messages (sender_id, recipient_id, body)
    values (sender_user_id, recipient_user_id, normalized_body)
    returning * into inserted_message;

    return inserted_message;
  end if;

  select *
  into existing_request
  from public.jam_requests
  where requester_id = sender_user_id
    and recipient_id = recipient_user_id;

  if found and existing_request.connected_at is null then
    raise exception 'You already sent them a jam';
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

  insert into public.direct_messages (sender_id, recipient_id, body)
  values (sender_user_id, recipient_user_id, normalized_body)
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

revoke all on function public.get_daily_jam_limit(uuid) from public;
revoke all on function public.send_jam_request(uuid, text) from public;
revoke all on function public.send_direct_message(uuid, text) from public;

grant execute on function public.get_daily_jam_limit(uuid) to authenticated;
grant execute on function public.send_jam_request(uuid, text) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
