alter table public.profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists near_me_radius_miles integer not null default 25;

alter table public.profiles
  drop constraint if exists profiles_near_me_radius_miles_check;

alter table public.profiles
  add constraint profiles_near_me_radius_miles_check
  check (near_me_radius_miles in (5, 10, 25, 50));
