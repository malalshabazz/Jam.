-- Pro access:
-- - First 1000 users are early_adopter (welcome message only until unlocked).
-- - Early adopters unlock lifetime pro features + gold badge after 3 uploads.
-- - Future paid subscribers get the same features with a blue badge.

alter table public.profiles
  add column if not exists video_count integer not null default 0;

alter table public.profiles
  add column if not exists pro_subscription_active boolean not null default false;

update public.profiles as profile
set video_count = coalesce(counts.total, 0)
from (
  select user_id, count(*)::integer as total
  from public.videos
  group by user_id
) as counts
where profile.id = counts.user_id;

update public.profiles
set video_count = 0
where video_count is null;

create or replace function public.refresh_profile_video_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id := coalesce(new.user_id, old.user_id);
  if target_user_id is null then
    return coalesce(new, old);
  end if;

  update public.profiles
  set video_count = (
    select count(*)::integer
    from public.videos
    where user_id = target_user_id
  )
  where id = target_user_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists videos_refresh_profile_video_count on public.videos;
create trigger videos_refresh_profile_video_count
  after insert or delete or update of user_id
  on public.videos
  for each row
  execute function public.refresh_profile_video_count();

create or replace function public.has_pro_features(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        coalesce(pro_subscription_active, false)
        or (
          coalesce(early_adopter, false)
          and coalesce(video_count, 0) >= 3
        )
      from public.profiles
      where id = target_user_id
    ),
    false
  );
$$;

create or replace function public.get_pro_badge(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(pro_subscription_active, false) then 'blue'
    when coalesce(early_adopter, false) and coalesce(video_count, 0) >= 3 then 'gold'
    else null
  end
  from public.profiles
  where id = target_user_id
$$;

create or replace function public.get_daily_jam_limit(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_pro_features(target_user_id) then 15
    else 5
  end
$$;

revoke all on function public.has_pro_features(uuid) from public;
revoke all on function public.get_pro_badge(uuid) from public;
revoke all on function public.get_daily_jam_limit(uuid) from public;
grant execute on function public.has_pro_features(uuid) to authenticated;
grant execute on function public.get_pro_badge(uuid) to authenticated;
grant execute on function public.get_daily_jam_limit(uuid) to authenticated;
