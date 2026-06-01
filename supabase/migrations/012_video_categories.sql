alter table public.videos
  add column if not exists categories text[] not null default '{}';

update public.videos
set categories = hashtags
where categories = '{}'
  and hashtags is not null
  and hashtags <> '{}';
