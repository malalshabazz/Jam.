create or replace function public.get_signup_position(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = auth, public
as $$
  select ranked.signup_position
  from (
    select
      id,
      row_number() over (order by created_at, id)::integer as signup_position
    from auth.users
  ) as ranked
  where ranked.id = target_user_id
    and target_user_id = auth.uid();
$$;

revoke all on function public.get_signup_position(uuid) from public;
grant execute on function public.get_signup_position(uuid) to authenticated;
