-- Expose today's jam usage for compose UX. Uses the same current_date key as
-- send_jam_request, so the counter and the hard limit reset together at DB midnight.

create or replace function public.get_my_daily_jam_usage()
returns table (
  used integer,
  daily_limit integer,
  remaining integer,
  usage_date date,
  resets_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  sender_user_id uuid := auth.uid();
  today date := current_date;
  lim integer;
  used_count integer;
begin
  if sender_user_id is null then
    raise exception 'Not authenticated';
  end if;

  lim := coalesce(public.get_daily_jam_limit(sender_user_id), 5);

  select d.jam_count
  into used_count
  from public.daily_jam_usage as d
  where d.user_id = sender_user_id
    and d.usage_date = today;

  used_count := coalesce(used_count, 0);

  return query
  select
    used_count,
    lim,
    greatest(lim - used_count, 0),
    today,
    ((today + 1)::timestamp at time zone 'utc');
end;
$$;

revoke all on function public.get_my_daily_jam_usage() from public;
grant execute on function public.get_my_daily_jam_usage() to authenticated;
