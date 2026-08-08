-- Server-side role / genre / location filtering for discover feed pages.
-- Global filtered pages use fetch_filtered_feed_videos.
-- Near-me pages reuse fetch_nearby_feed_videos with optional role/genre filters.

-- Ensure tag columns exist (idempotent if 012/013 already applied).
alter table public.videos
  add column if not exists categories text[] not null default '{}',
  add column if not exists roles text[] not null default '{}',
  add column if not exists genres text[] not null default '{}';

create index if not exists videos_roles_gin_idx on public.videos using gin (roles);
create index if not exists videos_genres_gin_idx on public.videos using gin (genres);
create index if not exists videos_categories_gin_idx on public.videos using gin (categories);

-- Case-insensitive array overlap (any match counts).
create or replace function public.text_array_overlaps_ci(left_arr text[], right_arr text[])
returns boolean
language sql
immutable
parallel safe
as $$
  select
    coalesce(cardinality(right_arr), 0) = 0
    or (
      (
        select coalesce(array_agg(lower(trim(val))), '{}'::text[])
        from unnest(coalesce(left_arr, '{}'::text[])) as val
        where nullif(trim(val), '') is not null
      )
      &&
      (
        select coalesce(array_agg(lower(trim(val))), '{}'::text[])
        from unnest(coalesce(right_arr, '{}'::text[])) as val
        where nullif(trim(val), '') is not null
      )
    );
$$;

revoke all on function public.text_array_overlaps_ci(text[], text[]) from public;
grant execute on function public.text_array_overlaps_ci(text[], text[]) to authenticated;

create or replace function public.video_role_tags(
  video_roles text[],
  video_categories text[]
)
returns text[]
language sql
immutable
parallel safe
as $$
  -- Video tags only — never fall back to profile creator_types.
  select case
    when coalesce(cardinality(video_roles), 0) > 0 then video_roles
    when coalesce(cardinality(video_categories), 0) > 0 then video_categories
    else '{}'::text[]
  end;
$$;

revoke all on function public.video_role_tags(text[], text[]) from public;
grant execute on function public.video_role_tags(text[], text[]) to authenticated;

create or replace function public.video_genre_tags(
  video_genres text[],
  video_categories text[]
)
returns text[]
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(cardinality(video_genres), 0) > 0 then video_genres
    when coalesce(cardinality(video_categories), 0) > 0 then video_categories
    else '{}'::text[]
  end;
$$;

revoke all on function public.video_genre_tags(text[], text[]) from public;
grant execute on function public.video_genre_tags(text[], text[]) to authenticated;

-- filter_locations jsonb: [{ "country": "United States", "cities": ["New York"], "country_aliases": ["usa"] }]
create or replace function public.profile_matches_location_filters(
  profile_country text,
  profile_city text,
  profile_location text,
  filter_locations jsonb
)
returns boolean
language plpgsql
immutable
parallel safe
as $$
declare
  sel jsonb;
  city_count integer;
  country_name text;
  city_name text;
  alias_name text;
  haystack text;
begin
  if filter_locations is null or jsonb_typeof(filter_locations) <> 'array' or jsonb_array_length(filter_locations) = 0 then
    return true;
  end if;

  haystack := lower(trim(coalesce(profile_location, '')));

  for sel in select value from jsonb_array_elements(filter_locations)
  loop
    country_name := lower(trim(coalesce(sel->>'country', '')));
    if country_name = '' then
      continue;
    end if;

    city_count := coalesce(jsonb_array_length(sel->'cities'), 0);

    if city_count = 0 then
      if lower(trim(coalesce(profile_country, ''))) = country_name then
        return true;
      end if;

      if haystack ~ ('(^|[^a-z0-9])' || country_name || '([^a-z0-9]|$)') then
        return true;
      end if;

      for alias_name in
        select lower(trim(value))
        from jsonb_array_elements_text(coalesce(sel->'country_aliases', '[]'::jsonb)) as value
      loop
        if alias_name = '' then
          continue;
        end if;
        if lower(trim(coalesce(profile_country, ''))) = alias_name then
          return true;
        end if;
        if haystack ~ ('(^|[^a-z0-9])' || alias_name || '([^a-z0-9]|$)') then
          return true;
        end if;
      end loop;
    else
      for city_name in
        select lower(trim(value))
        from jsonb_array_elements_text(sel->'cities') as value
      loop
        if city_name = '' then
          continue;
        end if;
        if lower(trim(coalesce(profile_city, ''))) = city_name then
          return true;
        end if;
        if haystack ~ ('(^|[^a-z0-9])' || city_name || '([^a-z0-9]|$)') then
          return true;
        end if;
      end loop;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.profile_matches_location_filters(text, text, text, jsonb) from public;
grant execute on function public.profile_matches_location_filters(text, text, text, jsonb) to authenticated;

create or replace function public.fetch_filtered_feed_videos(
  filter_roles text[] default null,
  filter_genres text[] default null,
  filter_locations jsonb default null,
  page_limit integer default 12,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  viewer_id uuid := auth.uid();
  clamped_limit integer;
  roles_filter text[] := coalesce(filter_roles, '{}'::text[]);
  genres_filter text[] := coalesce(filter_genres, '{}'::text[]);
begin
  if viewer_id is null then
    raise exception 'Not authenticated';
  end if;

  clamped_limit := least(greatest(coalesce(page_limit, 12), 1), 40);

  return query
  select
    v.id,
    v.created_at
  from public.videos as v
  inner join public.profiles as p
    on p.id = v.user_id
  where v.user_id is distinct from viewer_id
    and public.text_array_overlaps_ci(
      public.video_role_tags(v.roles, v.categories),
      roles_filter
    )
    and public.text_array_overlaps_ci(
      public.video_genre_tags(v.genres, v.categories),
      genres_filter
    )
    and public.profile_matches_location_filters(
      p.country,
      p.city,
      p.location,
      filter_locations
    )
    and not exists (
      select 1
      from public.user_blocks as b
      where (b.blocker_id = viewer_id and b.blocked_id = v.user_id)
         or (b.blocker_id = v.user_id and b.blocked_id = viewer_id)
    )
    and not exists (
      select 1
      from public.user_hidden_creators as h
      where h.user_id = viewer_id
        and h.hidden_user_id = v.user_id
    )
    and (
      cursor_created_at is null
      or v.created_at < cursor_created_at
      or (v.created_at = cursor_created_at and cursor_id is not null and v.id < cursor_id)
    )
  order by v.created_at desc, v.id desc
  limit clamped_limit;
end;
$$;

revoke all on function public.fetch_filtered_feed_videos(
  text[],
  text[],
  jsonb,
  integer,
  timestamptz,
  uuid
) from public;

grant execute on function public.fetch_filtered_feed_videos(
  text[],
  text[],
  jsonb,
  integer,
  timestamptz,
  uuid
) to authenticated;

drop function if exists public.fetch_nearby_feed_videos(
  double precision,
  double precision,
  double precision,
  integer,
  timestamptz,
  uuid
);

create or replace function public.fetch_nearby_feed_videos(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_miles double precision default 25,
  page_limit integer default 12,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null,
  filter_roles text[] default null,
  filter_genres text[] default null
)
returns table (
  id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  viewer_id uuid := auth.uid();
  clamped_radius double precision;
  clamped_limit integer;
  lat_delta double precision;
  lng_delta double precision;
  cos_lat double precision;
  roles_filter text[] := coalesce(filter_roles, '{}'::text[]);
  genres_filter text[] := coalesce(filter_genres, '{}'::text[]);
begin
  if viewer_id is null then
    raise exception 'Not authenticated';
  end if;

  if viewer_lat is null or viewer_lng is null then
    raise exception 'viewer location required';
  end if;

  if viewer_lat < -90 or viewer_lat > 90 or viewer_lng < -180 or viewer_lng > 180 then
    raise exception 'invalid viewer location';
  end if;

  -- Minimum discoverable radius is 5 miles (no tighter pinpointing via the API).
  clamped_radius := least(greatest(coalesce(radius_miles, 25), 5), 50);
  clamped_limit := least(greatest(coalesce(page_limit, 12), 1), 40);

  cos_lat := greatest(abs(cos(radians(viewer_lat))), 0.01);
  lat_delta := clamped_radius / 69.0;
  lng_delta := clamped_radius / (69.0 * cos_lat);

  return query
  with creator_points as (
    select
      loc.user_id as profile_id,
      case
        when loc.live_latitude is not null
         and loc.live_longitude is not null
         and loc.live_location_updated_at is not null
         and loc.live_location_updated_at >= (now() - interval '72 hours')
        then loc.live_latitude
        else loc.latitude
      end as lat,
      case
        when loc.live_latitude is not null
         and loc.live_longitude is not null
         and loc.live_location_updated_at is not null
         and loc.live_location_updated_at >= (now() - interval '72 hours')
        then loc.live_longitude
        else loc.longitude
      end as lng
    from public.profile_locations as loc
    where loc.user_id is distinct from viewer_id
  ),
  nearby_creators as (
    select
      c.profile_id,
      (
        3958.7613 * 2 * asin(
          sqrt(
            power(sin(radians(c.lat - viewer_lat) / 2), 2)
            + cos(radians(viewer_lat))
              * cos(radians(c.lat))
              * power(sin(radians(c.lng - viewer_lng) / 2), 2)
          )
        )
      ) as distance_miles
    from creator_points as c
    where c.lat is not null
      and c.lng is not null
      and c.lat between (viewer_lat - lat_delta) and (viewer_lat + lat_delta)
      and c.lng between (viewer_lng - lng_delta) and (viewer_lng + lng_delta)
  )
  select
    v.id,
    v.created_at
  from public.videos as v
  inner join nearby_creators as n
    on n.profile_id = v.user_id
  inner join public.profiles as p
    on p.id = v.user_id
  where n.distance_miles <= clamped_radius
    and public.text_array_overlaps_ci(
      public.video_role_tags(v.roles, v.categories),
      roles_filter
    )
    and public.text_array_overlaps_ci(
      public.video_genre_tags(v.genres, v.categories),
      genres_filter
    )
    and not exists (
      select 1
      from public.user_blocks as b
      where (b.blocker_id = viewer_id and b.blocked_id = v.user_id)
         or (b.blocker_id = v.user_id and b.blocked_id = viewer_id)
    )
    and not exists (
      select 1
      from public.user_hidden_creators as h
      where h.user_id = viewer_id
        and h.hidden_user_id = v.user_id
    )
    and (
      cursor_created_at is null
      or v.created_at < cursor_created_at
      or (v.created_at = cursor_created_at and cursor_id is not null and v.id < cursor_id)
    )
  order by v.created_at desc, v.id desc
  limit clamped_limit;
end;
$$;

revoke all on function public.fetch_nearby_feed_videos(
  double precision,
  double precision,
  double precision,
  integer,
  timestamptz,
  uuid,
  text[],
  text[]
) from public;

grant execute on function public.fetch_nearby_feed_videos(
  double precision,
  double precision,
  double precision,
  integer,
  timestamptz,
  uuid,
  text[],
  text[]
) to authenticated;
