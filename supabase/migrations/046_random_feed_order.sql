-- Randomize discover / nearby feed order within each phase (unseen vs replay).
-- Uses a client feed_seed + md5(id || seed) so older and newer videos are equal
-- weight, while keyset pagination stays stable for load-more within a session.

drop function if exists public.fetch_filtered_feed_videos(
  text[],
  text[],
  jsonb,
  integer,
  timestamptz,
  uuid,
  text,
  boolean
);

create or replace function public.fetch_filtered_feed_videos(
  filter_roles text[] default null,
  filter_genres text[] default null,
  filter_locations jsonb default null,
  page_limit integer default 12,
  cursor_sort_key text default null,
  cursor_id uuid default null,
  feed_phase text default 'unseen',
  looking_for_only boolean default false,
  feed_seed text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  sort_key text
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
  phase text := lower(trim(coalesce(feed_phase, 'unseen')));
  seed text := coalesce(nullif(trim(feed_seed), ''), viewer_id::text);
begin
  if viewer_id is null then
    raise exception 'Not authenticated';
  end if;

  if phase not in ('unseen', 'replay') then
    raise exception 'invalid feed_phase';
  end if;

  clamped_limit := least(greatest(coalesce(page_limit, 12), 1), 40);

  return query
  with filtered as (
    select
      v.id,
      v.created_at,
      md5(v.id::text || ':' || seed) as sort_key
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
      and (
        not coalesce(looking_for_only, false)
        or v.looking_for = true
      )
      and (
        case
          when phase = 'unseen' then not public.video_is_recently_seen(viewer_id, v.id, 30)
          else public.video_is_recently_seen(viewer_id, v.id, 30)
        end
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
  )
  select
    f.id,
    f.created_at,
    f.sort_key
  from filtered as f
  where (
    cursor_sort_key is null
    or f.sort_key > cursor_sort_key
    or (f.sort_key = cursor_sort_key and cursor_id is not null and f.id > cursor_id)
  )
  order by f.sort_key asc, f.id asc
  limit clamped_limit;
end;
$$;

revoke all on function public.fetch_filtered_feed_videos(
  text[],
  text[],
  jsonb,
  integer,
  text,
  uuid,
  text,
  boolean,
  text
) from public;

grant execute on function public.fetch_filtered_feed_videos(
  text[],
  text[],
  jsonb,
  integer,
  text,
  uuid,
  text,
  boolean,
  text
) to authenticated;

drop function if exists public.fetch_nearby_feed_videos(
  double precision,
  double precision,
  double precision,
  integer,
  timestamptz,
  uuid,
  text[],
  text[],
  text,
  boolean
);

create or replace function public.fetch_nearby_feed_videos(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_miles double precision default 25,
  page_limit integer default 12,
  cursor_sort_key text default null,
  cursor_id uuid default null,
  filter_roles text[] default null,
  filter_genres text[] default null,
  feed_phase text default 'unseen',
  looking_for_only boolean default false,
  feed_seed text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  sort_key text
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
  phase text := lower(trim(coalesce(feed_phase, 'unseen')));
  seed text := coalesce(nullif(trim(feed_seed), ''), viewer_id::text);
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

  if phase not in ('unseen', 'replay') then
    raise exception 'invalid feed_phase';
  end if;

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
  ),
  filtered as (
    select
      v.id,
      v.created_at,
      md5(v.id::text || ':' || seed) as sort_key
    from public.videos as v
    inner join nearby_creators as n
      on n.profile_id = v.user_id
    where n.distance_miles <= clamped_radius
      and public.text_array_overlaps_ci(
        public.video_role_tags(v.roles, v.categories),
        roles_filter
      )
      and public.text_array_overlaps_ci(
        public.video_genre_tags(v.genres, v.categories),
        genres_filter
      )
      and (
        not coalesce(looking_for_only, false)
        or v.looking_for = true
      )
      and (
        case
          when phase = 'unseen' then not public.video_is_recently_seen(viewer_id, v.id, 30)
          else public.video_is_recently_seen(viewer_id, v.id, 30)
        end
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
  )
  select
    f.id,
    f.created_at,
    f.sort_key
  from filtered as f
  where (
    cursor_sort_key is null
    or f.sort_key > cursor_sort_key
    or (f.sort_key = cursor_sort_key and cursor_id is not null and f.id > cursor_id)
  )
  order by f.sort_key asc, f.id asc
  limit clamped_limit;
end;
$$;

revoke all on function public.fetch_nearby_feed_videos(
  double precision,
  double precision,
  double precision,
  integer,
  text,
  uuid,
  text[],
  text[],
  text,
  boolean,
  text
) from public;

grant execute on function public.fetch_nearby_feed_videos(
  double precision,
  double precision,
  double precision,
  integer,
  text,
  uuid,
  text[],
  text[],
  text,
  boolean,
  text
) to authenticated;
