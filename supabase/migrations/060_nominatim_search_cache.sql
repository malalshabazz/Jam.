-- Server-side Nominatim cache + global 1 req/sec slot.
-- The Next.js geocode proxy uses the service role; clients have no access.

create table if not exists public.nominatim_rate_limit (
  id integer primary key check (id = 1),
  last_request_at timestamptz not null
);

insert into public.nominatim_rate_limit (id, last_request_at)
values (1, '-infinity')
on conflict (id) do nothing;

create table if not exists public.nominatim_search_cache (
  query_key text primary key,
  results jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists nominatim_search_cache_expires_idx
  on public.nominatim_search_cache (expires_at);

alter table public.nominatim_rate_limit enable row level security;
alter table public.nominatim_search_cache enable row level security;

revoke all on table public.nominatim_rate_limit from public, anon, authenticated;
revoke all on table public.nominatim_search_cache from public, anon, authenticated;

create or replace function public.claim_nominatim_slot()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.nominatim_rate_limit
  set last_request_at = now()
  where id = 1
    and last_request_at <= now() - interval '1 second';

  return found;
end;
$$;

revoke all on function public.claim_nominatim_slot() from public, anon, authenticated;
grant execute on function public.claim_nominatim_slot() to service_role;
