-- Remote filter catalog: overlay presets live in Supabase so new looks can ship
-- without an app update. Videos keep storing video_filter as a free-form id.

create table if not exists public.video_filters (
  id text primary key,
  label text not null,
  sort_order integer not null default 0,
  overlay jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_filters_id_format check (id ~ '^[a-z][a-z0-9_]*$'),
  constraint video_filters_label_nonempty check (char_length(trim(label)) > 0)
);

create index if not exists video_filters_active_sort_idx
  on public.video_filters (active, sort_order, id);

alter table public.video_filters enable row level security;

drop policy if exists "video_filters_public_read_active" on public.video_filters;
create policy "video_filters_public_read_active"
  on public.video_filters
  for select
  to anon, authenticated
  using (active = true);

-- Allow any non-empty filter id so catalog can grow without migrations.
alter table public.videos
  drop constraint if exists videos_video_filter_check;

alter table public.videos
  add constraint videos_video_filter_check
  check (char_length(trim(video_filter)) > 0);

insert into public.video_filters (id, label, sort_order, overlay, active)
values
  (
    'warm',
    'Warm',
    10,
    '{"backgroundColor":"rgba(251,146,60,0.18)"}'::jsonb,
    true
  ),
  (
    'cool',
    'Cool',
    20,
    '{"backgroundColor":"rgba(96,165,250,0.18)"}'::jsonb,
    true
  ),
  (
    'fade',
    'Fade',
    30,
    '{"backgroundColor":"rgba(255,255,255,0.14)"}'::jsonb,
    true
  ),
  (
    'noir',
    'Noir',
    40,
    '{"backgroundColor":"rgba(0,0,0,0.34)"}'::jsonb,
    true
  ),
  (
    'vivid',
    'Vivid',
    50,
    '{"backgroundColor":"rgba(236,72,153,0.16)"}'::jsonb,
    true
  ),
  (
    'cinema',
    'Cinema',
    60,
    '{"backgroundColor":"rgba(120,53,15,0.22)"}'::jsonb,
    true
  ),
  (
    'mist',
    'Mist',
    70,
    '{"backgroundColor":"rgba(226,232,240,0.16)"}'::jsonb,
    true
  ),
  (
    'golden',
    'Golden',
    80,
    '{"backgroundColor":"rgba(234,179,8,0.18)"}'::jsonb,
    true
  ),
  (
    'arctic',
    'Arctic',
    90,
    '{"backgroundColor":"rgba(125,211,252,0.16)"}'::jsonb,
    true
  ),
  (
    'rose',
    'Rose',
    100,
    '{"backgroundColor":"rgba(251,113,133,0.17)"}'::jsonb,
    true
  ),
  (
    'olive',
    'Olive',
    110,
    '{"backgroundColor":"rgba(132,204,22,0.14)"}'::jsonb,
    true
  ),
  (
    'midnight',
    'Midnight',
    120,
    '{"backgroundColor":"rgba(30,27,75,0.28)"}'::jsonb,
    true
  ),
  (
    'bleach',
    'Bleach',
    130,
    '{"backgroundColor":"rgba(250,250,249,0.2)"}'::jsonb,
    true
  )
on conflict (id) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  overlay = excluded.overlay,
  active = excluded.active,
  updated_at = now();
