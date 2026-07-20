-- Lock entitlement columns so authenticated clients cannot grant themselves pro.
-- video_count may only change via the trusted videos trigger.
-- pro_subscription_active may only change via service_role (future billing webhook).
-- early_adopter may only change via profiles_set_early_adopter (runs after this trigger).

create or replace function public.protect_profile_entitlement_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if tg_op = 'INSERT' then
    new.video_count := 0;
    new.pro_subscription_active := false;
    return new;
  end if;

  -- Billing / admin path can update entitlement columns intentionally.
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- Preserve early_adopter; set_early_adopter may overwrite on onboarding complete.
  new.early_adopter := old.early_adopter;
  new.pro_subscription_active := old.pro_subscription_active;

  if current_setting('jam.allow_video_count_update', true) is distinct from 'on' then
    new.video_count := old.video_count;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_entitlements on public.profiles;
create trigger profiles_protect_entitlements
  before insert or update
  on public.profiles
  for each row
  execute function public.protect_profile_entitlement_columns();

-- Trusted video-count refreshes temporarily unlock video_count updates.
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

  perform set_config('jam.allow_video_count_update', 'on', true);

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
