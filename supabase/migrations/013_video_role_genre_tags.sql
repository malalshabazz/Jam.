alter table public.videos
  add column if not exists roles text[] not null default '{}',
  add column if not exists genres text[] not null default '{}';

update public.videos
set roles = categories
where roles = '{}'
  and categories is not null
  and categories <> '{}';
