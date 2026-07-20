drop policy if exists "direct_messages_update_recipient_read" on public.direct_messages;
drop policy if exists "direct_messages_update_sender" on public.direct_messages;
drop policy if exists "direct_messages_delete_sender" on public.direct_messages;

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
      or new.created_at is distinct from old.created_at then
      raise exception 'Message sender can only edit message body';
    end if;

    return new;
  end if;

  if current_user_id = old.recipient_id then
    if new.id is distinct from old.id
      or new.sender_id is distinct from old.sender_id
      or new.recipient_id is distinct from old.recipient_id
      or new.body is distinct from old.body
      or new.created_at is distinct from old.created_at then
      raise exception 'Message recipient can only update read status';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update this message';
end;
$$;

drop trigger if exists direct_messages_enforce_update_permissions on public.direct_messages;

create trigger direct_messages_enforce_update_permissions
  before update on public.direct_messages
  for each row
  execute function public.enforce_direct_message_update_permissions();

create policy "direct_messages_update_sender"
  on public.direct_messages
  for update
  to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

create policy "direct_messages_update_recipient_read"
  on public.direct_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "direct_messages_delete_sender"
  on public.direct_messages
  for delete
  to authenticated
  using (auth.uid() = sender_id);
