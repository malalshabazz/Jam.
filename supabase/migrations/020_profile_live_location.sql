alter table public.profiles
  add column if not exists live_latitude double precision,
  add column if not exists live_longitude double precision;
