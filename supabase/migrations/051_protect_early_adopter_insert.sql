-- H6: clients must not self-grant early_adopter on profile INSERT.
-- profiles_set_early_adopter (runs after protect by name order) still
-- assigns early_adopter when onboarding completes for the first 1000 users.

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
    -- Do not trust client-supplied early_adopter on insert.
    new.early_adopter := false;
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

-- Also clear client-supplied early_adopter on INSERT unless this update is the
-- onboarding-complete assignment path (handled below).
create or replace function public.set_early_adopter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count integer;
begin
  if new.onboarding_complete is true and (
    tg_op = 'INSERT' or coalesce(old.onboarding_complete, false) is false
  ) then
    select count(*)
    into completed_count
    from public.profiles
    where onboarding_complete is true
      and id <> new.id;

    new.early_adopter = completed_count < 1000;
  elsif tg_op = 'UPDATE' then
    new.early_adopter = old.early_adopter;
  else
    -- INSERT without completing onboarding: never keep a client-supplied true.
    new.early_adopter = false;
  end if;

  return new;
end;
$$;
