create table if not exists public.user_hidden_creators (
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, hidden_user_id),
  constraint user_hidden_creators_no_self check (user_id <> hidden_user_id)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint content_reports_reason_check check (
    reason in ('inappropriate_content', 'spam', 'harassment', 'other')
  ),
  constraint content_reports_no_self check (reporter_id <> reported_user_id)
);

alter table public.user_hidden_creators enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

drop policy if exists "user_hidden_creators_select_own" on public.user_hidden_creators;
drop policy if exists "user_hidden_creators_insert_own" on public.user_hidden_creators;
drop policy if exists "user_hidden_creators_delete_own" on public.user_hidden_creators;

create policy "user_hidden_creators_select_own"
  on public.user_hidden_creators
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_hidden_creators_insert_own"
  on public.user_hidden_creators
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_hidden_creators_delete_own"
  on public.user_hidden_creators
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_blocks_select_participant" on public.user_blocks;
drop policy if exists "user_blocks_insert_own" on public.user_blocks;
drop policy if exists "user_blocks_delete_own" on public.user_blocks;

create policy "user_blocks_select_participant"
  on public.user_blocks
  for select
  to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy "user_blocks_insert_own"
  on public.user_blocks
  for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy "user_blocks_delete_own"
  on public.user_blocks
  for delete
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "content_reports_select_own" on public.content_reports;
drop policy if exists "content_reports_insert_own" on public.content_reports;

create policy "content_reports_select_own"
  on public.content_reports
  for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "content_reports_insert_own"
  on public.content_reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);
