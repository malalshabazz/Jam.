create or replace function public.set_early_adopter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count integer;
begin
  if new.onboarding_complete is true and (
    tg_op = 'INSERT' or coalesce(old.onboarding_complete, false) is false
  ) then
    select count(*)
    into completed_count
    from public.profiles
    where onboarding_complete is true
      and id <> new.id;

    new.early_adopter = completed_count < 1000;
  elsif tg_op = 'UPDATE' then
    new.early_adopter = old.early_adopter;
  end if;

  return new;
end;
$$;

create or replace function public.create_early_adopter_welcome()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_user_id uuid := auth.uid();
  is_early_adopter boolean;
begin
  if recipient_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select early_adopter
  into is_early_adopter
  from public.profiles
  where id = recipient_user_id;

  if is_early_adopter is not true then
    return;
  end if;

  insert into public.inbox_messages (
    recipient_id,
    sender_name,
    sender_avatar,
    message_type,
    body,
    read
  )
  values (
    recipient_user_id,
    'jam.',
    'jam.',
    'early_adopter_welcome',
    'As promised — you''re one of jam.''s first 1000 members. As a thank you, you have a lifetime pro membership and an exclusive gold verification badge, to show you were here at the start. Just post 3 videos and both will be permanently added to your account. Welcome to the beginning of something. — jam.',
    false
  )
  on conflict (recipient_id, message_type)
  do nothing;
end;
$$;

revoke all on function public.create_early_adopter_welcome() from public;
grant execute on function public.create_early_adopter_welcome() to authenticated;

drop policy if exists "inbox_messages_insert_own" on public.inbox_messages;
drop policy if exists "inbox_messages_update_own" on public.inbox_messages;
