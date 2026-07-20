alter table public.profiles
  add column if not exists country text,
  add column if not exists city text;

create temp table profile_location_options (
  country text not null,
  aliases text[] not null,
  cities text[] not null
) on commit drop;

insert into profile_location_options (country, aliases, cities)
values
  ('United States', array['united states', 'usa', 'us', 'america'], array['new york', 'los angeles', 'chicago', 'houston', 'miami']),
  ('China', array['china'], array['shanghai', 'beijing', 'guangzhou', 'shenzhen', 'chengdu']),
  ('India', array['india'], array['mumbai', 'delhi', 'bengaluru', 'kolkata', 'chennai']),
  ('Indonesia', array['indonesia'], array['jakarta', 'surabaya', 'bandung', 'medan', 'semarang']),
  ('Pakistan', array['pakistan'], array['karachi', 'lahore', 'faisalabad', 'rawalpindi', 'islamabad']),
  ('Brazil', array['brazil'], array['sao paulo', 'rio de janeiro', 'brasilia', 'salvador', 'fortaleza']),
  ('Nigeria', array['nigeria'], array['lagos', 'kano', 'ibadan', 'abuja', 'port harcourt']),
  ('Bangladesh', array['bangladesh'], array['dhaka', 'chittagong', 'khulna', 'rajshahi', 'sylhet']),
  ('Russia', array['russia'], array['moscow', 'saint petersburg', 'novosibirsk', 'yekaterinburg', 'kazan']),
  ('Mexico', array['mexico'], array['mexico city', 'guadalajara', 'monterrey', 'puebla', 'tijuana']),
  ('Japan', array['japan'], array['tokyo', 'osaka', 'nagoya', 'yokohama', 'fukuoka']),
  ('Philippines', array['philippines'], array['manila', 'quezon city', 'davao city', 'caloocan', 'cebu city']),
  ('Ethiopia', array['ethiopia'], array['addis ababa', 'dire dawa', 'mekelle', 'gondar', 'hawassa']),
  ('Egypt', array['egypt'], array['cairo', 'alexandria', 'giza', 'shubra el kheima', 'port said']),
  ('Vietnam', array['vietnam'], array['ho chi minh city', 'hanoi', 'da nang', 'hai phong', 'can tho']),
  ('Democratic Republic of the Congo', array['democratic republic of the congo', 'dr congo', 'congo'], array['kinshasa', 'lubumbashi', 'mbuji-mayi', 'kananga', 'kisangani']),
  ('Turkey', array['turkey'], array['istanbul', 'ankara', 'izmir', 'bursa', 'antalya']),
  ('Iran', array['iran'], array['tehran', 'mashhad', 'isfahan', 'karaj', 'shiraz']),
  ('Germany', array['germany'], array['berlin', 'hamburg', 'munich', 'cologne', 'frankfurt']),
  ('Thailand', array['thailand'], array['bangkok', 'chiang mai', 'pattaya', 'phuket', 'nakhon ratchasima']),
  ('United Kingdom', array['united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales'], array['london', 'birmingham', 'manchester', 'glasgow', 'liverpool']),
  ('France', array['france'], array['paris', 'marseille', 'lyon', 'toulouse', 'nice']),
  ('Italy', array['italy'], array['rome', 'milan', 'naples', 'turin', 'palermo']),
  ('South Africa', array['south africa'], array['johannesburg', 'cape town', 'durban', 'pretoria', 'port elizabeth']),
  ('Tanzania', array['tanzania'], array['dar es salaam', 'mwanza', 'arusha', 'dodoma', 'mbeya']),
  ('Myanmar', array['myanmar'], array['yangon', 'mandalay', 'naypyidaw', 'mawlamyine', 'bago']),
  ('Kenya', array['kenya'], array['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret']),
  ('South Korea', array['south korea', 'korea'], array['seoul', 'busan', 'incheon', 'daegu', 'daejeon']),
  ('Colombia', array['colombia'], array['bogota', 'medellin', 'cali', 'barranquilla', 'cartagena']),
  ('Spain', array['spain'], array['madrid', 'barcelona', 'valencia', 'seville', 'zaragoza']),
  ('Argentina', array['argentina'], array['buenos aires', 'cordoba', 'rosario', 'mendoza', 'la plata']),
  ('Algeria', array['algeria'], array['algiers', 'oran', 'constantine', 'annaba', 'blida']),
  ('Sudan', array['sudan'], array['khartoum', 'omdurman', 'nyala', 'port sudan', 'kassala']),
  ('Uganda', array['uganda'], array['kampala', 'gulu', 'lira', 'mbarara', 'jinja']),
  ('Iraq', array['iraq'], array['baghdad', 'basra', 'mosul', 'erbil', 'najaf']),
  ('Ukraine', array['ukraine'], array['kyiv', 'kharkiv', 'odesa', 'dnipro', 'lviv']),
  ('Canada', array['canada'], array['toronto', 'montreal', 'vancouver', 'calgary', 'ottawa']),
  ('Poland', array['poland'], array['warsaw', 'krakow', 'lodz', 'wroclaw', 'poznan']),
  ('Morocco', array['morocco'], array['casablanca', 'rabat', 'fes', 'marrakesh', 'tangier']),
  ('Saudi Arabia', array['saudi arabia'], array['riyadh', 'jeddah', 'mecca', 'medina', 'dammam']),
  ('Uzbekistan', array['uzbekistan'], array['tashkent', 'samarkand', 'namangan', 'andijan', 'bukhara']),
  ('Peru', array['peru'], array['lima', 'arequipa', 'trujillo', 'chiclayo', 'cusco']),
  ('Malaysia', array['malaysia'], array['kuala lumpur', 'george town', 'johor bahru', 'ipoh', 'kota kinabalu']),
  ('Angola', array['angola'], array['luanda', 'huambo', 'lobito', 'benguela', 'lubango']),
  ('Mozambique', array['mozambique'], array['maputo', 'matola', 'beira', 'nampula', 'chimoio']),
  ('Ghana', array['ghana'], array['accra', 'kumasi', 'tamale', 'takoradi', 'cape coast']),
  ('Yemen', array['yemen'], array['sanaa', 'aden', 'taiz', 'hodeidah', 'ibb']),
  ('Nepal', array['nepal'], array['kathmandu', 'pokhara', 'lalitpur', 'biratnagar', 'bharatpur']),
  ('Venezuela', array['venezuela'], array['caracas', 'maracaibo', 'valencia', 'barquisimeto', 'maracay']),
  ('Netherlands', array['netherlands'], array['amsterdam', 'rotterdam', 'the hague', 'utrecht', 'eindhoven']),
  ('Sweden', array['sweden'], array['stockholm', 'gothenburg', 'malmo', 'uppsala', 'vasteras']),
  ('Australia', array['australia'], array['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide']);

with matched_locations as (
  select
    p.id,
    match.country,
    match.city
  from public.profiles p
  cross join lateral (
    select
      option.country,
      city.name as city,
      case when city.name is not null then 2 else 1 end as score
    from profile_location_options option
    left join lateral (
      select city_name as name
      from unnest(option.cities) as city_name
      where lower(coalesce(p.location, '')) ~ ('(^|[^a-z0-9])' || city_name || '([^a-z0-9]|$)')
      order by length(city_name) desc
      limit 1
    ) city on true
    where p.location is not null
      and (
        exists (
          select 1
          from unnest(option.aliases) as alias_name
          where lower(p.location) ~ ('(^|[^a-z0-9])' || alias_name || '([^a-z0-9]|$)')
        )
        or city.name is not null
      )
    order by score desc, length(option.country) desc
    limit 1
  ) match
  where p.location is not null
)
update public.profiles p
set
  country = coalesce(nullif(p.country, ''), matched_locations.country),
  city = coalesce(nullif(p.city, ''), initcap(matched_locations.city)),
  location = case
    when matched_locations.city is not null then initcap(matched_locations.city) || ', ' || matched_locations.country
    else matched_locations.country
  end
from matched_locations
where p.id = matched_locations.id
  and (p.country is null or p.country = '' or p.city is null or p.city = '');
