alter table public.videos
  add column if not exists thumbnail_time_ms integer;
