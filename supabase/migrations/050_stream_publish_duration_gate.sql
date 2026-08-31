-- H5: longer source uploads may exceed free/pro caps for trim, but publish
-- requires a claim marked publishable (duration within entitlement).

alter table public.stream_upload_claims
  add column if not exists allowed_publish_seconds integer not null default 45;

alter table public.stream_upload_claims
  add column if not exists status text not null default 'uploaded';

alter table public.stream_upload_claims
  drop constraint if exists stream_upload_claims_status_check;

alter table public.stream_upload_claims
  add constraint stream_upload_claims_status_check
  check (status in ('uploaded', 'publishable'));

alter table public.stream_upload_claims
  drop constraint if exists stream_upload_claims_allowed_publish_seconds_check;

alter table public.stream_upload_claims
  add constraint stream_upload_claims_allowed_publish_seconds_check
  check (allowed_publish_seconds > 0 and allowed_publish_seconds <= 600);

-- Existing rows: treat as publishable so already-claimed in-flight uploads can finish.
update public.stream_upload_claims
set status = 'publishable'
where status = 'uploaded';

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
            and claim.status = 'publishable'
        )
        and not exists (
          select 1
          from public.videos as existing
          where existing.cloudflare_stream_id = cloudflare_stream_id
        )
      )
    )
  );

drop policy if exists "stream_upload_claims_update_own" on public.stream_upload_claims;

create policy "stream_upload_claims_update_own"
  on public.stream_upload_claims
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
