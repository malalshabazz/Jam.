-- Rename saved_videos.created_at → saved_at so “most recently saved” is explicit.
-- Safe on DBs that never got 008 (no saved_videos table yet).

do $$
begin
  -- Ensure the table exists before renaming / commenting.
  if to_regclass('public.saved_videos') is null then
    if to_regclass('public.videos') is null then
      raise notice '047: skipping saved_at — public.videos / saved_videos missing';
      return;
    end if;

    create table public.saved_videos (
      user_id uuid not null references auth.users(id) on delete cascade,
      video_id uuid not null references public.videos(id) on delete cascade,
      saved_at timestamptz not null default now(),
      primary key (user_id, video_id)
    );

    alter table public.saved_videos enable row level security;

    create policy "saved_videos_select_own"
      on public.saved_videos
      for select
      to authenticated
      using (auth.uid() = user_id);

    create policy "saved_videos_insert_own"
      on public.saved_videos
      for insert
      to authenticated
      with check (auth.uid() = user_id);

    create policy "saved_videos_delete_own"
      on public.saved_videos
      for delete
      to authenticated
      using (auth.uid() = user_id);
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_videos'
      and column_name = 'created_at'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_videos'
      and column_name = 'saved_at'
  ) then
    alter table public.saved_videos rename column created_at to saved_at;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_videos'
      and column_name = 'saved_at'
  ) then
    execute $c$
      comment on column public.saved_videos.saved_at is
        'When the viewer saved this video; drives Saved tab order (newest first).'
    $c$;
  end if;
end $$;
