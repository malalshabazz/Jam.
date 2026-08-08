-- Profile video pins: up to 3 per creator, ordered by pinned_rank then recency.

alter table public.videos
  add column if not exists pinned_rank smallint null
  constraint videos_pinned_rank_range_check
  check (pinned_rank is null or pinned_rank between 1 and 3);

comment on column public.videos.pinned_rank is
  '1–3 when pinned to the top of the creator profile; null when unpinned.';

create unique index if not exists videos_user_pinned_rank_uidx
  on public.videos (user_id, pinned_rank)
  where pinned_rank is not null;
