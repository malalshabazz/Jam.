-- Nearby feed: distance-filtered video ids (live-first with 72h TTL, else profile geocode).

create index if not exists profiles_live_coords_idx
  on public.profiles (live_latitude, live_longitude)
  where live_latitude is not null and live_longitude is not null;

create index if not exists profiles_profile_coords_idx
  on public.profiles (latitude, longitude)
  where latitude is not null and longitude is not null;

create or replace function public.fetch_nearby_feed_videos(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_miles double precision default 25,
  page_limit integer default 12,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  distance_miles double precision
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

  clamped_radius := least(greatest(coalesce(radius_miles, 25), 1), 50);
  clamped_limit := least(greatest(coalesce(page_limit, 12), 1), 40);

  cos_lat := greatest(abs(cos(radians(viewer_lat))), 0.01);
  lat_delta := clamped_radius / 69.0;
  lng_delta := clamped_radius / (69.0 * cos_lat);

  return query
  with creator_points as (
    select
      p.id as profile_id,
      case
        when p.live_latitude is not null
         and p.live_longitude is not null
         and p.live_location_updated_at is not null
         and p.live_location_updated_at >= (now() - interval '72 hours')
        then p.live_latitude
        else p.latitude
      end as lat,
      case
        when p.live_latitude is not null
         and p.live_longitude is not null
         and p.live_location_updated_at is not null
         and p.live_location_updated_at >= (now() - interval '72 hours')
        then p.live_longitude
        else p.longitude
      end as lng
    from public.profiles as p
    where p.id is distinct from viewer_id
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
    v.created_at,
    n.distance_miles
  from public.videos as v
  inner join nearby_creators as n
    on n.profile_id = v.user_id
  where n.distance_miles <= clamped_radius
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
  uuid
) from public;

grant execute on function public.fetch_nearby_feed_videos(
  double precision,
  double precision,
  double precision,
  integer,
  timestamptz,
  uuid
) to authenticated;
