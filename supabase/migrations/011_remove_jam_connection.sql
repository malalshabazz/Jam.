create or replace function public.remove_jam_connection(other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_message_count integer := 0;
  deleted_jam_count integer := 0;
  deleted_legacy_like_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if other_user_id = current_user_id then
    raise exception 'Cannot unjam yourself';
  end if;

  if to_regclass('public.direct_messages') is not null then
    execute
      'delete from public.direct_messages
       where (sender_id = $1 and recipient_id = $2)
          or (sender_id = $2 and recipient_id = $1)'
    using current_user_id, other_user_id;

    get diagnostics deleted_message_count = row_count;
  end if;

  if to_regclass('public.jam_requests') is not null then
    execute
      'delete from public.jam_requests
       where (requester_id = $1 and recipient_id = $2)
          or (requester_id = $2 and recipient_id = $1)'
    using current_user_id, other_user_id;

    get diagnostics deleted_jam_count = row_count;
  end if;

  if to_regclass('public.creator_likes') is not null then
    execute
      'delete from public.creator_likes
       where (liker_id = $1 and liked_id = $2)
          or (liker_id = $2 and liked_id = $1)'
    using current_user_id, other_user_id;

    get diagnostics deleted_legacy_like_count = row_count;
  end if;

  if deleted_message_count = 0 and deleted_jam_count = 0 and deleted_legacy_like_count = 0 then
    raise exception 'Jam not found';
  end if;
end;
$$;

revoke all on function public.remove_jam_connection(uuid) from public;
grant execute on function public.remove_jam_connection(uuid) to authenticated;
