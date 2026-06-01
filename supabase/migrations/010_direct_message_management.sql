create or replace function public.edit_direct_message(
  message_id uuid,
  message_body text
)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sender_user_id uuid := auth.uid();
  updated_message public.direct_messages;
begin
  if sender_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(message_body)) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  update public.direct_messages
  set body = trim(message_body)
  where id = message_id
    and sender_id = sender_user_id
  returning * into updated_message;

  if updated_message.id is null then
    raise exception 'Message not found';
  end if;

  return updated_message;
end;
$$;

create or replace function public.delete_direct_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sender_user_id uuid := auth.uid();
  deleted_count integer;
begin
  if sender_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.direct_messages
  where id = message_id
    and sender_id = sender_user_id;

  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'Message not found';
  end if;
end;
$$;

revoke all on function public.edit_direct_message(uuid, text) from public;
revoke all on function public.delete_direct_message(uuid) from public;

grant execute on function public.edit_direct_message(uuid, text) to authenticated;
grant execute on function public.delete_direct_message(uuid) to authenticated;
