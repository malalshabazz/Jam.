-- Slideshow image/audio URLs must be this user's public post-media objects.
-- Existing rows are left as-is; validation runs on insert and when those
-- columns change so pin/caption edits on older posts still work.

create or replace function public.owned_post_media_url(url text, owner_id uuid)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  trimmed text;
begin
  if url is null or owner_id is null then
    return false;
  end if;

  trimmed := trim(url);
  if trimmed = '' or trimmed ~ '[[:space:]\\]' or trimmed ~ '\.\.' then
    return false;
  end if;

  -- https only, no userinfo, supabase host, public post-media under this user.
  if trimmed !~* ('^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.supabase\.(co|in)/storage/v1/(object|render/image)/public/post-media/'
    || owner_id::text
    || '/') then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.enforce_video_media_urls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.image_urls is not distinct from old.image_urls
    and new.audio_url is not distinct from old.audio_url
    and new.media_url is not distinct from old.media_url
    and new.media_type is not distinct from old.media_type then
    return new;
  end if;

  if new.media_type = 'slideshow' then
    if new.image_urls is null
      or cardinality(new.image_urls) < 1
      or cardinality(new.image_urls) > 10 then
      raise exception 'Slideshow must have 1–10 photos';
    end if;

    if exists (
      select 1
      from unnest(new.image_urls) as image_url
      where not public.owned_post_media_url(image_url, new.user_id)
    ) then
      raise exception 'Slideshow photos must be your own uploads';
    end if;

    if new.audio_url is not null
      and not public.owned_post_media_url(new.audio_url, new.user_id) then
      raise exception 'Slideshow audio must be your own upload';
    end if;

    if new.media_url is not null
      and not public.owned_post_media_url(new.media_url, new.user_id) then
      raise exception 'Slideshow media must be your own upload';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists videos_enforce_media_urls on public.videos;
create trigger videos_enforce_media_urls
  before insert or update
  on public.videos
  for each row
  execute function public.enforce_video_media_urls();
