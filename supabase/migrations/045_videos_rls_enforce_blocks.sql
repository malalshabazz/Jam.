-- Enforce mutual blocks on video row reads at RLS (not only feed RPCs / client filters).
-- users_are_blocked is security definer and returns false for self, so own videos stay readable.

create index if not exists user_blocks_blocked_id_idx
  on public.user_blocks (blocked_id);

drop policy if exists "videos_select_authenticated" on public.videos;

create policy "videos_select_authenticated"
  on public.videos
  for select
  to authenticated
  using (
    not public.users_are_blocked(auth.uid(), user_id)
  );
