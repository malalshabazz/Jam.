-- Enforce jam-gated profile video access at RLS (not only client UI).
-- Without a mutual jam, viewers may only SELECT the creator's top 3 profile
-- videos (pinned_rank 1–3 then newest) — matching the locked profile grid.
-- Discover / nearby still use security-definer RPCs; hydrate full rows via
-- fetch_videos_by_ids_for_viewer so feed playback is unaffected.

create or replace function public.users_are_mutually_jammed(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when user_a is null or user_b is null then false
    when user_a = user_b then true
    else exists (
      select 1
      from public.jam_requests as forward
      where forward.requester_id = user_a
        and forward.recipient_id = user_b
        and (
          forward.connected_at is not null
          or exists (
            select 1
            from public.jam_requests as reverse
            where reverse.requester_id = user_b
              and reverse.recipient_id = user_a
          )
        )
    )
    or exists (
      select 1
      from public.jam_requests as reverse
      where reverse.requester_id = user_b
        and reverse.recipient_id = user_a
        and reverse.connected_at is not null
    )
  end;
$$;

revoke all on function public.users_are_mutually_jammed(uuid, uuid) from public;
grant execute on function public.users_are_mutually_jammed(uuid, uuid) to authenticated;

create or replace function public.video_is_ungated_profile_preview(
  p_creator_id uuid,
  p_video_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from (
      select v.id
      from public.videos as v
      where v.user_id = p_creator_id
      order by v.pinned_rank asc nulls last, v.created_at desc
      limit 3
    ) as preview
    where preview.id = p_video_id
  );
$$;

revoke all on function public.video_is_ungated_profile_preview(uuid, uuid) from public;
grant execute on function public.video_is_ungated_profile_preview(uuid, uuid) to authenticated;

drop policy if exists "videos_select_authenticated" on public.videos;

create policy "videos_select_authenticated"
  on public.videos
  for select
  to authenticated
  using (
    not public.users_are_blocked(auth.uid(), user_id)
    and (
      auth.uid() = user_id
      or public.users_are_mutually_jammed(auth.uid(), user_id)
      or public.video_is_ungated_profile_preview(user_id, id)
    )
  );

-- Feed / saved hydration: allow reading specific video rows when not blocked,
-- even if the creator profile is jam-gated (IDs come from feed RPCs / saves).
create or replace function public.fetch_videos_by_ids_for_viewer(p_ids uuid[])
returns setof public.videos
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select v.*
  from public.videos as v
  where p_ids is not null
    and v.id = any (p_ids)
    and auth.uid() is not null
    and not public.users_are_blocked(auth.uid(), v.user_id);
$$;

revoke all on function public.fetch_videos_by_ids_for_viewer(uuid[]) from public;
grant execute on function public.fetch_videos_by_ids_for_viewer(uuid[]) to authenticated;

-- Used when clearing saves after block/unjam — needs every video id, not just the preview 3.
create or replace function public.fetch_creator_video_ids_for_moderation(p_creator_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select v.id
  from public.videos as v
  where p_creator_id is not null
    and v.user_id = p_creator_id
    and auth.uid() is not null
    and auth.uid() is distinct from p_creator_id
    and not public.users_are_blocked(auth.uid(), p_creator_id);
$$;

revoke all on function public.fetch_creator_video_ids_for_moderation(uuid) from public;
grant execute on function public.fetch_creator_video_ids_for_moderation(uuid) to authenticated;
