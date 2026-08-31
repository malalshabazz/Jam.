-- Structured profile location: region / ISO country / granularity.
-- Filter matching is one-directional (specific → broad only).
-- Near-me RPCs are intentionally unchanged.

alter table public.profiles
  add column if not exists region text,
  add column if not exists country_code text,
  add column if not exists location_granularity text;

alter table public.profiles
  drop constraint if exists profiles_location_granularity_check;

alter table public.profiles
  add constraint profiles_location_granularity_check
  check (
    location_granularity is null
    or location_granularity in ('city', 'region', 'country')
  );

create index if not exists profiles_country_code_idx
  on public.profiles (country_code);

create index if not exists profiles_location_granularity_idx
  on public.profiles (location_granularity);

create or replace function public.iso_country_code(country_name text)
returns text
language sql
immutable
parallel safe
as $$
  select case lower(trim(coalesce(country_name, '')))
    when 'united states' then 'US'
    when 'usa' then 'US'
    when 'us' then 'US'
    when 'america' then 'US'
    when 'china' then 'CN'
    when 'india' then 'IN'
    when 'indonesia' then 'ID'
    when 'pakistan' then 'PK'
    when 'brazil' then 'BR'
    when 'nigeria' then 'NG'
    when 'bangladesh' then 'BD'
    when 'russia' then 'RU'
    when 'mexico' then 'MX'
    when 'japan' then 'JP'
    when 'philippines' then 'PH'
    when 'ethiopia' then 'ET'
    when 'egypt' then 'EG'
    when 'vietnam' then 'VN'
    when 'democratic republic of the congo' then 'CD'
    when 'dr congo' then 'CD'
    when 'congo' then 'CD'
    when 'turkey' then 'TR'
    when 'iran' then 'IR'
    when 'germany' then 'DE'
    when 'thailand' then 'TH'
    when 'united kingdom' then 'GB'
    when 'uk' then 'GB'
    when 'great britain' then 'GB'
    when 'france' then 'FR'
    when 'italy' then 'IT'
    when 'south africa' then 'ZA'
    when 'tanzania' then 'TZ'
    when 'myanmar' then 'MM'
    when 'kenya' then 'KE'
    when 'south korea' then 'KR'
    when 'korea' then 'KR'
    when 'colombia' then 'CO'
    when 'spain' then 'ES'
    when 'argentina' then 'AR'
    when 'algeria' then 'DZ'
    when 'sudan' then 'SD'
    when 'uganda' then 'UG'
    when 'iraq' then 'IQ'
    when 'ukraine' then 'UA'
    when 'canada' then 'CA'
    when 'poland' then 'PL'
    when 'morocco' then 'MA'
    when 'saudi arabia' then 'SA'
    when 'uzbekistan' then 'UZ'
    when 'peru' then 'PE'
    when 'malaysia' then 'MY'
    when 'angola' then 'AO'
    when 'mozambique' then 'MZ'
    when 'ghana' then 'GH'
    when 'yemen' then 'YE'
    when 'nepal' then 'NP'
    when 'venezuela' then 'VE'
    when 'netherlands' then 'NL'
    when 'sweden' then 'SE'
    when 'australia' then 'AU'
    else null
  end;
$$;

update public.profiles
set
  location_granularity = case
    when nullif(trim(city), '') is not null then 'city'
    when nullif(trim(country), '') is not null then 'country'
    else location_granularity
  end,
  country_code = coalesce(nullif(trim(country_code), ''), public.iso_country_code(country))
where location_granularity is null
   or country_code is null;

create or replace function public.normalize_location_key(value text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.location_country_matches(
  profile_country text,
  profile_country_code text,
  haystack text,
  filter_country text,
  filter_country_code text,
  country_aliases jsonb
)
returns boolean
language plpgsql
immutable
parallel safe
as $$
declare
  alias_name text;
begin
  if filter_country_code <> '' and coalesce(profile_country_code, '') <> '' then
    return upper(trim(profile_country_code)) = filter_country_code;
  end if;

  if filter_country <> '' and public.normalize_location_key(profile_country) = filter_country then
    return true;
  end if;

  if filter_country_code <> '' and public.iso_country_code(profile_country) = filter_country_code then
    return true;
  end if;

  if filter_country <> '' and haystack ~ ('(^|[^a-z0-9])' || filter_country || '([^a-z0-9]|$)') then
    return true;
  end if;

  for alias_name in
    select public.normalize_location_key(value)
    from jsonb_array_elements_text(coalesce(country_aliases, '[]'::jsonb)) as value
  loop
    if alias_name = '' then
      continue;
    end if;
    if public.normalize_location_key(profile_country) = alias_name then
      return true;
    end if;
    if haystack ~ ('(^|[^a-z0-9])' || alias_name || '([^a-z0-9]|$)') then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

drop function if exists public.profile_matches_location_filters(text, text, text, jsonb);

create or replace function public.profile_matches_location_filters(
  profile_country text,
  profile_city text,
  profile_location text,
  filter_locations jsonb,
  profile_region text default null,
  profile_country_code text default null,
  profile_granularity text default null
)
returns boolean
language plpgsql
immutable
parallel safe
as $$
declare
  sel jsonb;
  city_count integer;
  filter_country text;
  filter_country_code text;
  filter_region text;
  filter_granularity text;
  filter_city text;
  haystack text;
  profile_level text;
  resolved_country_code text;
begin
  if filter_locations is null or jsonb_typeof(filter_locations) <> 'array' or jsonb_array_length(filter_locations) = 0 then
    return true;
  end if;

  haystack := public.normalize_location_key(profile_location);
  profile_level := coalesce(
    nullif(public.normalize_location_key(profile_granularity), ''),
    case
      when nullif(public.normalize_location_key(profile_city), '') is not null then 'city'
      when nullif(public.normalize_location_key(profile_region), '') is not null then 'region'
      when nullif(public.normalize_location_key(profile_country), '') is not null
        or nullif(public.normalize_location_key(profile_country_code), '') is not null
        then 'country'
      else ''
    end
  );
  resolved_country_code := coalesce(
    nullif(upper(trim(profile_country_code)), ''),
    public.iso_country_code(profile_country)
  );

  for sel in select value from jsonb_array_elements(filter_locations)
  loop
    filter_country := public.normalize_location_key(sel->>'country');
    filter_country_code := upper(trim(coalesce(sel->>'country_code', '')));
    filter_region := public.normalize_location_key(sel->>'region');
    filter_granularity := public.normalize_location_key(sel->>'granularity');
    city_count := coalesce(jsonb_array_length(sel->'cities'), 0);

    if filter_granularity = '' then
      filter_granularity := case
        when city_count > 0 then 'city'
        when filter_region <> '' then 'region'
        else 'country'
      end;
    end if;

    if filter_country = '' and filter_country_code = '' then
      continue;
    end if;

    if not public.location_country_matches(
      profile_country,
      resolved_country_code,
      haystack,
      filter_country,
      filter_country_code,
      sel->'country_aliases'
    ) then
      continue;
    end if;

    if filter_granularity = 'country' then
      return true;
    end if;

    if filter_granularity = 'region' then
      if filter_region = '' then
        continue;
      end if;
      if profile_level = 'country' then
        continue;
      end if;
      if public.normalize_location_key(profile_region) = filter_region then
        return true;
      end if;
      continue;
    end if;

    -- City filter: only city-level profiles, same city + country.
    if profile_level is distinct from 'city' then
      continue;
    end if;

    if city_count = 0 then
      filter_city := public.normalize_location_key(sel->>'city');
      if filter_city = '' then
        continue;
      end if;
      if public.normalize_location_key(profile_city) = filter_city
        and (
          filter_region = ''
          or public.normalize_location_key(profile_region) = ''
          or public.normalize_location_key(profile_region) = filter_region
        )
      then
        return true;
      end if;
    else
      for filter_city in
        select public.normalize_location_key(value)
        from jsonb_array_elements_text(sel->'cities') as value
      loop
        if filter_city = '' then
          continue;
        end if;
        if public.normalize_location_key(profile_city) = filter_city
          and (
            filter_region = ''
            or public.normalize_location_key(profile_region) = ''
            or public.normalize_location_key(profile_region) = filter_region
          )
        then
          return true;
        end if;
      end loop;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.iso_country_code(text) from public;
grant execute on function public.iso_country_code(text) to authenticated;

revoke all on function public.normalize_location_key(text) from public;
grant execute on function public.normalize_location_key(text) to authenticated;

revoke all on function public.location_country_matches(text, text, text, text, text, jsonb) from public;
grant execute on function public.location_country_matches(text, text, text, text, text, jsonb) to authenticated;

revoke all on function public.profile_matches_location_filters(text, text, text, jsonb, text, text, text) from public;
grant execute on function public.profile_matches_location_filters(text, text, text, jsonb, text, text, text) to authenticated;

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
        filter_locations,
        p.region,
        p.country_code,
        p.location_granularity
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
