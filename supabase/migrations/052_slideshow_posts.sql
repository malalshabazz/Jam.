-- Slideshow posts: image carousel + attached audio (no Cloudflare Stream).

alter table public.videos
  add column if not exists media_type text not null default 'video';

alter table public.videos
  drop constraint if exists videos_media_type_check;

alter table public.videos
  add constraint videos_media_type_check
  check (media_type in ('video', 'slideshow'));

alter table public.videos
  add column if not exists image_urls text[] not null default '{}';

alter table public.videos
  add column if not exists audio_url text;

alter table public.videos
  add column if not exists audio_duration_ms integer;

comment on column public.videos.media_type is 'video = Cloudflare Stream clip; slideshow = image_urls + audio_url';
comment on column public.videos.image_urls is 'Public URLs for slideshow slides (1–10)';
comment on column public.videos.audio_url is 'Public URL for slideshow audio (mp3 or extracted from video)';
comment on column public.videos.audio_duration_ms is 'Slideshow audio length in milliseconds';

-- Storage for slideshow images and audio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post_media_storage_select_public" on storage.objects;
drop policy if exists "post_media_storage_insert_own" on storage.objects;
drop policy if exists "post_media_storage_update_own" on storage.objects;
drop policy if exists "post_media_storage_delete_own" on storage.objects;

create policy "post_media_storage_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'post-media');

create policy "post_media_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_media_storage_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_media_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
