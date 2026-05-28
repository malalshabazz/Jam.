alter table public.videos
  add column if not exists cloudflare_stream_id text;
