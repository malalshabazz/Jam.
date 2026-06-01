-- One-off cleanup for the fake users inserted by supabase/seed.sql.
-- Run this in Supabase SQL Editor when you want to remove the seeded users.

do $$
declare
  seed_user_ids uuid[] := array[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid,
    '44444444-4444-4444-8444-444444444444'::uuid,
    '55555555-5555-4555-8555-555555555555'::uuid,
    '66666666-6666-4666-8666-666666666666'::uuid,
    '77777777-7777-4777-8777-777777777777'::uuid,
    '88888888-8888-4888-8888-888888888888'::uuid,
    '99999999-9999-4999-8999-999999999999'::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
  ];
begin
  if to_regclass('public.saved_videos') is not null then
    delete from public.saved_videos
    where user_id = any(seed_user_ids)
       or video_id in (
         select id
         from public.videos
         where user_id = any(seed_user_ids)
       );
  end if;

  if to_regclass('public.jam_requests') is not null then
    delete from public.jam_requests
    where requester_id = any(seed_user_ids)
       or recipient_id = any(seed_user_ids);
  end if;

  if to_regclass('public.daily_jam_usage') is not null then
    delete from public.daily_jam_usage
    where user_id = any(seed_user_ids);
  end if;

  if to_regclass('public.creator_likes') is not null then
    delete from public.creator_likes
    where liker_id = any(seed_user_ids)
       or liked_id = any(seed_user_ids);
  end if;

  if to_regclass('public.direct_messages') is not null then
    delete from public.direct_messages
    where sender_id = any(seed_user_ids)
       or recipient_id = any(seed_user_ids);
  end if;

  if to_regclass('public.inbox_messages') is not null then
    delete from public.inbox_messages
    where recipient_id = any(seed_user_ids);
  end if;

  if to_regclass('public.videos') is not null then
    delete from public.videos
    where user_id = any(seed_user_ids);
  end if;

  if to_regclass('public.profiles') is not null then
    delete from public.profiles
    where id = any(seed_user_ids);
  end if;

  if to_regclass('auth.identities') is not null then
    delete from auth.identities
    where user_id = any(seed_user_ids);
  end if;

  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions
    where user_id = any(seed_user_ids);
  end if;

  if to_regclass('auth.mfa_factors') is not null then
    delete from auth.mfa_factors
    where user_id = any(seed_user_ids);
  end if;

  delete from auth.users
  where id = any(seed_user_ids);
end $$;
