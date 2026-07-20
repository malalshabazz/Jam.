-- Persist create-edit presentation data that cannot be baked into Stream in Expo Go.
-- Trim is applied by Cloudflare Clip (new stream UID); filter/text ship as playback overlays.

alter table public.videos
  add column if not exists video_filter text not null default 'none';

alter table public.videos
  add column if not exists text_overlays jsonb not null default '[]'::jsonb;

alter table public.videos
  drop constraint if exists videos_video_filter_check;

alter table public.videos
  add constraint videos_video_filter_check
  check (video_filter in ('none', 'warm', 'cool', 'fade', 'noir', 'vivid'));
