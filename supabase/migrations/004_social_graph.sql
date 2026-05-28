create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  hashtags text[] not null default '{}',
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_likes (
  liker_id uuid not null references auth.users(id) on delete cascade,
  liked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  constraint creator_likes_no_self_like check (liker_id <> liked_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint direct_messages_no_self_message check (sender_id <> recipient_id)
);

alter table public.videos enable row level security;
alter table public.creator_likes enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "videos_select_authenticated" on public.videos;
drop policy if exists "videos_insert_own" on public.videos;
drop policy if exists "videos_update_own" on public.videos;
drop policy if exists "videos_delete_own" on public.videos;

create policy "videos_select_authenticated"
  on public.videos
  for select
  to authenticated
  using (true);

create policy "videos_insert_own"
  on public.videos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "videos_update_own"
  on public.videos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "videos_delete_own"
  on public.videos
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "creator_likes_select_participant" on public.creator_likes;
drop policy if exists "creator_likes_insert_own" on public.creator_likes;

create policy "creator_likes_select_participant"
  on public.creator_likes
  for select
  to authenticated
  using (auth.uid() = liker_id or auth.uid() = liked_id);

create policy "creator_likes_insert_own"
  on public.creator_likes
  for insert
  to authenticated
  with check (auth.uid() = liker_id);

drop policy if exists "direct_messages_select_participant" on public.direct_messages;
drop policy if exists "direct_messages_update_recipient_read" on public.direct_messages;

create policy "direct_messages_select_participant"
  on public.direct_messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "direct_messages_update_recipient_read"
  on public.direct_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (
    auth.uid() = recipient_id
    and sender_id = sender_id
    and recipient_id = recipient_id
    and body = body
  );

drop policy if exists "profiles_select_discoverable" on public.profiles;

create policy "profiles_select_discoverable"
  on public.profiles
  for select
  to authenticated
  using (onboarding_complete is true);

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
  mutual_like_exists boolean;
  existing_outgoing_count integer;
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
    from public.creator_likes sent_like
    join public.creator_likes received_like
      on received_like.liker_id = sent_like.liked_id
     and received_like.liked_id = sent_like.liker_id
    where sent_like.liker_id = sender_user_id
      and sent_like.liked_id = recipient_user_id
  )
  into mutual_like_exists;

  if not mutual_like_exists then
    select count(*)
    into existing_outgoing_count
    from public.direct_messages
    where sender_id = sender_user_id
      and recipient_id = recipient_user_id;

    if existing_outgoing_count > 0 then
      raise exception 'Wait for them to like you back';
    end if;
  end if;

  insert into public.direct_messages (sender_id, recipient_id, body)
  values (sender_user_id, recipient_user_id, trim(message_body))
  returning * into inserted_message;

  return inserted_message;
end;
$$;

revoke all on function public.send_direct_message(uuid, text) from public;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
