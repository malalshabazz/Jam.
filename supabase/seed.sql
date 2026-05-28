-- Local/dev seed data for Jam.
-- Password for every seeded account: password123

delete from public.direct_messages
where sender_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
)
or recipient_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

delete from public.creator_likes
where liker_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
)
or liked_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

delete from auth.identities
where user_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

delete from auth.users
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aria.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '10 days', '{"provider":"email","providers":["email"]}', '{"name":"Aria Stone"}', now() - interval '10 days', now() - interval '10 days'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'malik.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '9 days', '{"provider":"email","providers":["email"]}', '{"name":"Malik Rhodes"}', now() - interval '9 days', now() - interval '9 days'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '8 days', '{"provider":"email","providers":["email"]}', '{"name":"Maya Cole"}', now() - interval '8 days', now() - interval '8 days'),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'theo.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '7 days', '{"provider":"email","providers":["email"]}', '{"name":"Theo Park"}', now() - interval '7 days', now() - interval '7 days'),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nia.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '6 days', '{"provider":"email","providers":["email"]}', '{"name":"Nia Patel"}', now() - interval '6 days', now() - interval '6 days'),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kofi.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '5 days', '{"provider":"email","providers":["email"]}', '{"name":"Kofi Mensah"}', now() - interval '5 days', now() - interval '5 days'),
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lena.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '4 days', '{"provider":"email","providers":["email"]}', '{"name":"Lena Ortiz"}', now() - interval '4 days', now() - interval '4 days'),
  ('88888888-8888-4888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '3 days', '{"provider":"email","providers":["email"]}', '{"name":"Samir Khan"}', now() - interval '3 days', now() - interval '3 days'),
  ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zara.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '2 days', '{"provider":"email","providers":["email"]}', '{"name":"Zara Moon"}', now() - interval '2 days', now() - interval '2 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jules.seed@jam.test', crypt('password123', gen_salt('bf')), now() - interval '1 day', '{"provider":"email","providers":["email"]}', '{"name":"Jules Carter"}', now() - interval '1 day', now() - interval '1 day')
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  ('10111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '{"sub":"11111111-1111-4111-8111-111111111111","email":"aria.seed@jam.test"}', 'email', now() - interval '10 days', now() - interval '10 days', now() - interval '10 days'),
  ('20222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', '{"sub":"22222222-2222-4222-8222-222222222222","email":"malik.seed@jam.test"}', 'email', now() - interval '9 days', now() - interval '9 days', now() - interval '9 days'),
  ('30333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', '{"sub":"33333333-3333-4333-8333-333333333333","email":"maya.seed@jam.test"}', 'email', now() - interval '8 days', now() - interval '8 days', now() - interval '8 days'),
  ('40444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', '{"sub":"44444444-4444-4444-8444-444444444444","email":"theo.seed@jam.test"}', 'email', now() - interval '7 days', now() - interval '7 days', now() - interval '7 days'),
  ('50555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555', '{"sub":"55555555-5555-4555-8555-555555555555","email":"nia.seed@jam.test"}', 'email', now() - interval '6 days', now() - interval '6 days', now() - interval '6 days'),
  ('60666666-6666-4666-8666-666666666666', '66666666-6666-4666-8666-666666666666', '66666666-6666-4666-8666-666666666666', '{"sub":"66666666-6666-4666-8666-666666666666","email":"kofi.seed@jam.test"}', 'email', now() - interval '5 days', now() - interval '5 days', now() - interval '5 days'),
  ('70777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777777', '{"sub":"77777777-7777-4777-8777-777777777777","email":"lena.seed@jam.test"}', 'email', now() - interval '4 days', now() - interval '4 days', now() - interval '4 days'),
  ('80888888-8888-4888-8888-888888888888', '88888888-8888-4888-8888-888888888888', '88888888-8888-4888-8888-888888888888', '{"sub":"88888888-8888-4888-8888-888888888888","email":"sam.seed@jam.test"}', 'email', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
  ('90999999-9999-4999-8999-999999999999', '99999999-9999-4999-8999-999999999999', '99999999-9999-4999-8999-999999999999', '{"sub":"99999999-9999-4999-8999-999999999999","email":"zara.seed@jam.test"}', 'email', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'),
  ('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"jules.seed@jam.test"}', 'email', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day')
on conflict (provider, provider_id) do nothing;

insert into public.profiles (
  id,
  display_name,
  first_name,
  last_name,
  bio,
  creator_types,
  location,
  avatar_url,
  onboarding_complete,
  welcome_seen
)
values
  ('11111111-1111-4111-8111-111111111111', 'Aria Stone', 'Aria', 'Stone', 'Vocalist writing textured hooks for electronic and soul-leaning producers.', array['vocalist', 'songwriter'], 'London, UK', null, true, true),
  ('22222222-2222-4222-8222-222222222222', 'Malik Rhodes', 'Malik', 'Rhodes', 'Producer building warm club edits, dusty keys, and late-night grooves.', array['producer', 'music producer'], 'Lagos, Nigeria', null, true, true),
  ('33333333-3333-4333-8333-333333333333', 'Maya Cole', 'Maya', 'Cole', 'Painter exploring motion, texture, and visual loops for live music sets.', array['painter', 'visual artist'], 'Paris, France', null, true, true),
  ('44444444-4444-4444-8444-444444444444', 'Theo Park', 'Theo', 'Park', 'Beatmaker focused on swing, sample chops, and intimate drum pockets.', array['beatmaker', 'producer'], 'Berlin, Germany', null, true, true),
  ('55555555-5555-4555-8555-555555555555', 'Nia Patel', 'Nia', 'Patel', 'Filmmaker creating moody short-form visuals for artists and dancers.', array['filmmaker', 'director'], 'Toronto, Canada', null, true, true),
  ('66666666-6666-4666-8666-666666666666', 'Kofi Mensah', 'Kofi', 'Mensah', 'Rapper with melodic verses and sharp one-take freestyle ideas.', array['rapper', 'songwriter'], 'Accra, Ghana', null, true, true),
  ('77777777-7777-4777-8777-777777777777', 'Lena Ortiz', 'Lena', 'Ortiz', 'Dancer translating basslines into choreography and movement studies.', array['dancer', 'choreographer'], 'Mexico City, Mexico', null, true, true),
  ('88888888-8888-4888-8888-888888888888', 'Samir Khan', 'Samir', 'Khan', 'Guitarist layering clean riffs, ambient swells, and indie-pop sketches.', array['guitarist', 'songwriter'], 'Mumbai, India', null, true, true),
  ('99999999-9999-4999-8999-999999999999', 'Zara Moon', 'Zara', 'Moon', 'Photographer shooting intimate portraits and experimental cover art.', array['photographer', 'designer'], 'New York, USA', null, true, true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Jules Carter', 'Jules', 'Carter', 'Animator making surreal loops and character-driven music visuals.', array['animator', 'graphic designer'], 'Amsterdam, Netherlands', null, true, true)
on conflict (id) do update
set
  display_name = excluded.display_name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  bio = excluded.bio,
  creator_types = excluded.creator_types,
  location = excluded.location,
  avatar_url = excluded.avatar_url,
  onboarding_complete = excluded.onboarding_complete,
  welcome_seen = excluded.welcome_seen;

insert into public.videos (id, user_id, caption, hashtags, media_url, created_at)
values
  ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'testing a breathy hook over broken drums - looking for a producer to finish it', array['vocals','electronic','hook'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '4 days'),
  ('10000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'stacking harmonies for a late night chorus idea', array['harmony','soul','wip'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '3 days'),
  ('20000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'rough bounce with warm chords and space for a topline', array['producer','house','collab'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '5 days'),
  ('30000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'painting process loop for a live set backdrop', array['painting','visuals','texture'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'drum pocket from a dusty sample flip', array['beats','samples','drums'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '6 days'),
  ('50000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'moody shot list for an artist visualizer', array['film','visualizer','cinematic'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '7 days'),
  ('60000000-0000-4000-8000-000000000001', '66666666-6666-4666-8666-666666666666', 'one-take verse over a sparse piano loop', array['rap','verse','piano'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '1 day'),
  ('70000000-0000-4000-8000-000000000001', '77777777-7777-4777-8777-777777777777', 'movement study for a bass-heavy chorus', array['dance','movement','choreo'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '12 hours'),
  ('80000000-0000-4000-8000-000000000001', '88888888-8888-4888-8888-888888888888', 'clean guitar motif that needs a vocalist', array['guitar','indie','riff'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '18 hours'),
  ('90000000-0000-4000-8000-000000000001', '99999999-9999-4999-8999-999999999999', 'cover art lighting test with chrome fabric', array['photo','coverart','lighting'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '30 hours'),
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'looping character animation for a dreamy bridge section', array['animation','visuals','loop'], 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', now() - interval '8 hours')
on conflict (id) do update
set
  caption = excluded.caption,
  hashtags = excluded.hashtags,
  media_url = excluded.media_url,
  created_at = excluded.created_at;

insert into public.creator_likes (liker_id, liked_id, created_at)
values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', now() - interval '3 days'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', now() - interval '2 days 20 hours'),
  ('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', now() - interval '2 days'),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', now() - interval '1 day 22 hours'),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', now() - interval '1 day 12 hours'),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', now() - interval '9 hours'),
  ('11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', now() - interval '7 hours'),
  ('77777777-7777-4777-8777-777777777777', '22222222-2222-4222-8222-222222222222', now() - interval '6 hours'),
  ('22222222-2222-4222-8222-222222222222', '77777777-7777-4777-8777-777777777777', now() - interval '5 hours'),
  ('99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now() - interval '4 hours'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '99999999-9999-4999-8999-999999999999', now() - interval '3 hours'),
  ('88888888-8888-4888-8888-888888888888', '33333333-3333-4333-8333-333333333333', now() - interval '2 hours')
on conflict (liker_id, liked_id) do nothing;

insert into public.direct_messages (id, sender_id, recipient_id, body, read_at, created_at)
values
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Your chord bounce is exactly the kind of thing I want to write over.', now() - interval '2 days 18 hours', now() - interval '2 days 19 hours'),
  ('d0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Send me a voice memo and I will build around it tonight.', null, now() - interval '2 days 17 hours'),
  ('d0000000-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Your vocal texture would sound wild on my sample flip.', now() - interval '1 day 18 hours', now() - interval '1 day 19 hours'),
  ('d0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'Let me try a hook this weekend.', null, now() - interval '1 day 17 hours'),
  ('d0000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', '77777777-7777-4777-8777-777777777777', 'Your movement study gave me an idea for a bassline drop.', null, now() - interval '4 hours'),
  ('d0000000-0000-4000-8000-000000000006', '99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Would love to combine your animation with a photo texture pack.', now() - interval '2 hours', now() - interval '2 hours 30 minutes')
on conflict (id) do update
set
  body = excluded.body,
  read_at = excluded.read_at,
  created_at = excluded.created_at;
