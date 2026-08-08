-- Keep exact coordinates private. Other users only learn "inside my radius"
-- via fetch_nearby_feed_videos (min 5 mi) — never lat/lng or distance.

create table if not exists public.profile_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  live_latitude double precision,
  live_longitude double precision,
  live_location_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists profile_locations_live_coords_idx
  on public.profile_locations (live_latitude, live_longitude)
  where live_latitude is not null and live_longitude is not null;

create index if not exists profile_locations_profile_coords_idx
  on public.profile_locations (latitude, longitude)
  where latitude is not null and longitude is not null;

alter table public.profile_locations enable row level security;

drop policy if exists "profile_locations_select_own" on public.profile_locations;
drop policy if exists "profile_locations_insert_own" on public.profile_locations;
drop policy if exists "profile_locations_update_own" on public.profile_locations;
drop policy if exists "profile_locations_delete_own" on public.profile_locations;

create policy "profile_locations_select_own"
  on public.profile_locations
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profile_locations_insert_own"
  on public.profile_locations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "profile_locations_update_own"
  on public.profile_locations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profile_locations_delete_own"
  on public.profile_locations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Move any existing public coords into the private table.
insert into public.profile_locations (
  user_id,
  latitude,
  longitude,
  live_latitude,
  live_longitude,
  live_location_updated_at
)
select
  p.id,
  p.latitude,
  p.longitude,
  p.live_latitude,
  p.live_longitude,
  p.live_location_updated_at
from public.profiles as p
where p.latitude is not null
   or p.longitude is not null
   or p.live_latitude is not null
   or p.live_longitude is not null
   or p.live_location_updated_at is not null
on conflict (user_id) do update
set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  live_latitude = excluded.live_latitude,
  live_longitude = excluded.live_longitude,
  live_location_updated_at = excluded.live_location_updated_at,
  updated_at = now();

drop index if exists profiles_live_coords_idx;
drop index if exists profiles_profile_coords_idx;

alter table public.profiles
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists live_latitude,
  drop column if exists live_longitude,
  drop column if exists live_location_updated_at;

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
