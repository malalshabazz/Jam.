-- Persist "notify me when this creator posts" preferences.
-- Push delivery can be layered on later; this table is the source of truth.

create table if not exists public.creator_post_alerts (
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id),
  constraint creator_post_alerts_no_self check (user_id <> creator_id)
);

create index if not exists creator_post_alerts_creator_id_idx
  on public.creator_post_alerts (creator_id);

alter table public.creator_post_alerts enable row level security;

drop policy if exists "creator_post_alerts_select_own" on public.creator_post_alerts;
drop policy if exists "creator_post_alerts_insert_own" on public.creator_post_alerts;
drop policy if exists "creator_post_alerts_delete_own" on public.creator_post_alerts;

create policy "creator_post_alerts_select_own"
  on public.creator_post_alerts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "creator_post_alerts_insert_own"
  on public.creator_post_alerts
  for insert
  to authenticated
  with check (auth.uid() = user_id and auth.uid() <> creator_id);

create policy "creator_post_alerts_delete_own"
  on public.creator_post_alerts
  for delete
  to authenticated
  using (auth.uid() = user_id);
