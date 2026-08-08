-- Timestamp for live GPS freshness (near-me demotes live coords older than 72h).
alter table public.profiles
  add column if not exists live_location_updated_at timestamptz;
