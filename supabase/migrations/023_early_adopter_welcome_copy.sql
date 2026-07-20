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
    'As promised — you''re one of jam.''s first 1000 members. As a thank you, you have a lifetime pro membership and an exclusive gold verification badge, to show you were here at the start. Just post 3 videos and both will be permanently added to your account. Welcome!' || E'\n' || '- Jam.',
    false
  )
  on conflict (recipient_id, message_type)
  do nothing;
end;
$$;

update public.inbox_messages
set body = regexp_replace(
  body,
  'Welcome to the beginning of something\. — jam\.$',
  E'Welcome!\n- Jam.'
)
where message_type = 'early_adopter_welcome'
  and body ~ 'Welcome to the beginning of something\. — jam\.$';
