-- Clients must not mark Stream claims publishable or attach a Stream id after insert.
-- Claim writes go through the Next upload/clip/publish-check APIs (service_role).
-- Video posts: stream id is immutable; only slideshows may insert without one.

drop policy if exists "stream_upload_claims_insert_own" on public.stream_upload_claims;
drop policy if exists "stream_upload_claims_update_own" on public.stream_upload_claims;
drop policy if exists "stream_upload_claims_delete_own" on public.stream_upload_claims;

revoke insert, update, delete on public.stream_upload_claims from public;
revoke insert, update, delete on public.stream_upload_claims from anon;
revoke insert, update, delete on public.stream_upload_claims from authenticated;

create or replace function public.protect_video_stream_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.cloudflare_stream_id := old.cloudflare_stream_id;
  new.media_type := old.media_type;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists videos_protect_stream_identity on public.videos;
create trigger videos_protect_stream_identity
  before update
  on public.videos
  for each row
  execute function public.protect_video_stream_identity();

drop policy if exists "videos_insert_own" on public.videos;

create policy "videos_insert_own"
  on public.videos
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      (
        media_type = 'slideshow'
        and cloudflare_stream_id is null
      )
      or (
        media_type = 'video'
        and cloudflare_stream_id is not null
        and exists (
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
