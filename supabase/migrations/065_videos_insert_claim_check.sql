-- videos_insert_own EXISTS on stream_upload_claims is subject to that table's RLS.
-- After 054, authenticated cannot write claims; nested SELECT can still miss a
-- publishable row the Next clip/upload APIs just wrote. Check claims as definer.

create or replace function public.stream_claim_is_publishable(p_stream_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stream_upload_claims as claim
    where claim.cloudflare_stream_id = p_stream_id
      and claim.user_id = auth.uid()
      and claim.status = 'publishable'
  );
$$;

revoke all on function public.stream_claim_is_publishable(text) from public;
revoke all on function public.stream_claim_is_publishable(text) from anon;
grant execute on function public.stream_claim_is_publishable(text) to authenticated;

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
        and public.stream_claim_is_publishable(cloudflare_stream_id)
        and not exists (
          select 1
          from public.videos as existing
          where existing.cloudflare_stream_id = cloudflare_stream_id
        )
      )
    )
  );
