-- Hide/block must clear Saved without exposing a creator's full video id list.
-- fetch_creator_video_ids_for_moderation was callable by any authenticated user.

drop function if exists public.fetch_creator_video_ids_for_moderation(uuid);

create or replace function public.clear_saved_videos_by_creator(p_creator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_creator_id is null or p_creator_id = viewer_id then
    return;
  end if;

  delete from public.saved_videos
  where user_id = viewer_id
    and video_id in (
      select v.id
      from public.videos as v
      where v.user_id = p_creator_id
    );
end;
$$;

revoke all on function public.clear_saved_videos_by_creator(uuid) from public;
grant execute on function public.clear_saved_videos_by_creator(uuid) to authenticated;

-- Hide had no DB cleanup (block already does). Keep Saved consistent if the
-- client skips the RPC.
create or replace function public.cleanup_saves_on_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.saved_videos') is null or to_regclass('public.videos') is null then
    return new;
  end if;

  delete from public.saved_videos
  where user_id = new.user_id
    and video_id in (
      select v.id
      from public.videos as v
      where v.user_id = new.hidden_user_id
    );

  return new;
end;
$$;

drop trigger if exists user_hidden_creators_cleanup_saves on public.user_hidden_creators;
create trigger user_hidden_creators_cleanup_saves
  after insert
  on public.user_hidden_creators
  for each row
  execute function public.cleanup_saves_on_hide();
