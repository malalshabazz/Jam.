-- Use the current JWT helpers. request.jwt.claim.role is the legacy
-- PostgREST setting and is empty in some runtimes, which would block
-- service_role billing updates from changing entitlement columns.

create or replace function public.protect_profile_entitlement_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), auth.jwt() ->> 'role', '');
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
