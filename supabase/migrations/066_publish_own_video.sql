-- Client INSERT into videos keeps failing 42501 after Stream clip:
-- the clipped uid is what we publish, but the claim may still sit on the
-- pre-clip source (status uploaded when allowLongerSource), and 065's SQL
-- helper can see a null auth.uid() under SECURITY DEFINER.
-- Publish through a definer RPC that transfers the claim, then inserts.

create or replace function public.request_user_id()
returns uuid
language sql
stable
set search_path = public, auth
as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  );
$$;

create or replace function public.stream_claim_is_publishable(p_stream_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  uid uuid := public.request_user_id();
begin
  if uid is null or p_stream_id is null or length(trim(p_stream_id)) = 0 then
    return false;
  end if;
  return exists (
    select 1
    from public.stream_upload_claims as claim
    where claim.cloudflare_stream_id = trim(p_stream_id)
      and claim.user_id = uid
      and claim.status = 'publishable'
  );
end;
$$;

create or replace function public.publish_own_video(
  p_caption text default '',
  p_roles text[] default '{}',
  p_genres text[] default '{}',
  p_categories text[] default '{}',
  p_hashtags text[] default '{}',
  p_media_url text default null,
  p_cloudflare_stream_id text default null,
  p_source_stream_id text default null,
  p_thumbnail_time_ms integer default null,
  p_video_filter text default 'none',
  p_text_overlays jsonb default '[]',
  p_looking_for boolean default false,
  p_looking_for_roles text[] default '{}',
  p_looking_for_genres text[] default '{}',
  p_media_type text default 'video',
  p_image_urls text[] default '{}',
  p_audio_url text default null,
  p_audio_duration_ms integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := public.request_user_id();
  stream_id text := nullif(trim(coalesce(p_cloudflare_stream_id, '')), '');
  source_id text := nullif(trim(coalesce(p_source_stream_id, '')), '');
  media_kind text := coalesce(nullif(trim(p_media_type), ''), 'video');
  allowed_seconds integer := 45;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('row_security', 'off', true);

  if media_kind = 'video' then
    if stream_id is null then
      raise exception 'Missing stream id';
    end if;

    select c.allowed_publish_seconds
      into allowed_seconds
    from public.stream_upload_claims as c
    where c.user_id = uid
      and c.cloudflare_stream_id in (stream_id, coalesce(source_id, stream_id))
    order by case when c.cloudflare_stream_id = stream_id then 0 else 1 end
    limit 1;

    if allowed_seconds is null then
      select c.allowed_publish_seconds
        into allowed_seconds
      from public.stream_upload_claims as c
      where c.user_id = uid
        and c.created_at > now() - interval '6 hours'
      order by c.created_at desc
      limit 1;
    end if;

    if allowed_seconds is null then
      allowed_seconds := 45;
    end if;

    if not exists (
      select 1
      from public.stream_upload_claims as c
      where c.user_id = uid
        and (
          c.cloudflare_stream_id = stream_id
          or (source_id is not null and c.cloudflare_stream_id = source_id)
          or c.created_at > now() - interval '6 hours'
        )
    ) then
      raise exception 'No upload claim for this video';
    end if;

    insert into public.stream_upload_claims (
      cloudflare_stream_id,
      user_id,
      allowed_publish_seconds,
      status
    )
    values (stream_id, uid, allowed_seconds, 'publishable')
    on conflict (cloudflare_stream_id) do update
      set
        status = 'publishable',
        allowed_publish_seconds = excluded.allowed_publish_seconds
      where public.stream_upload_claims.user_id = uid;

    if not exists (
      select 1
      from public.stream_upload_claims as c
      where c.cloudflare_stream_id = stream_id
        and c.user_id = uid
        and c.status = 'publishable'
    ) then
      raise exception 'Upload already claimed';
    end if;
  elsif media_kind = 'slideshow' then
    if stream_id is not null then
      raise exception 'Slideshow cannot have a stream id';
    end if;
  else
    raise exception 'Invalid media type';
  end if;

  insert into public.videos (
    user_id,
    caption,
    roles,
    genres,
    categories,
    hashtags,
    media_url,
    cloudflare_stream_id,
    thumbnail_time_ms,
    video_filter,
    text_overlays,
    looking_for,
    looking_for_roles,
    looking_for_genres,
    media_type,
    image_urls,
    audio_url,
    audio_duration_ms
  )
  values (
    uid,
    coalesce(p_caption, ''),
    coalesce(p_roles, '{}'),
    coalesce(p_genres, '{}'),
    coalesce(p_categories, '{}'),
    coalesce(p_hashtags, '{}'),
    p_media_url,
    stream_id,
    p_thumbnail_time_ms,
    coalesce(p_video_filter, 'none'),
    coalesce(p_text_overlays, '[]'::jsonb),
    coalesce(p_looking_for, false),
    coalesce(p_looking_for_roles, '{}'),
    coalesce(p_looking_for_genres, '{}'),
    media_kind,
    coalesce(p_image_urls, '{}'),
    p_audio_url,
    p_audio_duration_ms
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.request_user_id() from public, anon;
grant execute on function public.request_user_id() to authenticated;

revoke all on function public.stream_claim_is_publishable(text) from public, anon;
grant execute on function public.stream_claim_is_publishable(text) to authenticated;

revoke all on function public.publish_own_video from public, anon;
grant execute on function public.publish_own_video to authenticated;
