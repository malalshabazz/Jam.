-- Prove Stream ownership before publish: createVideo may only attach a
-- cloudflare_stream_id the caller claimed at direct-upload / clip time.

create table if not exists public.stream_upload_claims (
  cloudflare_stream_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists stream_upload_claims_user_id_idx
  on public.stream_upload_claims (user_id);

alter table public.stream_upload_claims enable row level security;

drop policy if exists "stream_upload_claims_select_own" on public.stream_upload_claims;
drop policy if exists "stream_upload_claims_insert_own" on public.stream_upload_claims;
drop policy if exists "stream_upload_claims_delete_own" on public.stream_upload_claims;

create policy "stream_upload_claims_select_own"
  on public.stream_upload_claims
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "stream_upload_claims_insert_own"
  on public.stream_upload_claims
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "stream_upload_claims_delete_own"
  on public.stream_upload_claims
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- One published video per Stream asset (blocks re-attaching others' IDs).
create unique index if not exists videos_cloudflare_stream_id_uidx
  on public.videos (cloudflare_stream_id)
  where cloudflare_stream_id is not null;

drop policy if exists "videos_insert_own" on public.videos;

create policy "videos_insert_own"
  on public.videos
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      cloudflare_stream_id is null
      or (
        exists (
          select 1
          from public.stream_upload_claims as claim
          where claim.cloudflare_stream_id = cloudflare_stream_id
            and claim.user_id = auth.uid()
        )
        and not exists (
          select 1
          from public.videos as existing
          where existing.cloudflare_stream_id = cloudflare_stream_id
        )
      )
    )
  );
