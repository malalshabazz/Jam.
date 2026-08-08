-- Nearby profile IDs for inbox near-me filtering (coords never leave the server).

create or replace function public.fetch_nearby_user_ids(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_miles double precision default 25
)
returns table (
  user_id uuid
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  viewer_id uuid := auth.uid();
  clamped_radius double precision;
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

  -- Same bounds as discover near-me (min 5 mi, max 50 mi).
  clamped_radius := least(greatest(coalesce(radius_miles, 25), 5), 50);

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
  )
  select c.profile_id as user_id
  from creator_points as c
  where c.lat is not null
    and c.lng is not null
    and c.lat between (viewer_lat - lat_delta) and (viewer_lat + lat_delta)
    and c.lng between (viewer_lng - lng_delta) and (viewer_lng + lng_delta)
    and (
      3958.7613 * 2 * asin(
        sqrt(
          power(sin(radians(c.lat - viewer_lat) / 2), 2)
          + cos(radians(viewer_lat))
            * cos(radians(c.lat))
            * power(sin(radians(c.lng - viewer_lng) / 2), 2)
        )
      )
    ) <= clamped_radius
    and not exists (
      select 1
      from public.user_blocks as b
      where (b.blocker_id = viewer_id and b.blocked_id = c.profile_id)
         or (b.blocker_id = c.profile_id and b.blocked_id = viewer_id)
    )
    and not exists (
      select 1
      from public.user_hidden_creators as h
      where h.user_id = viewer_id
        and h.hidden_user_id = c.profile_id
    );
end;
$$;

revoke all on function public.fetch_nearby_user_ids(
  double precision,
  double precision,
  double precision
) from public;

grant execute on function public.fetch_nearby_user_ids(
  double precision,
  double precision,
  double precision
) to authenticated;
