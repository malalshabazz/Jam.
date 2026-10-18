-- Undo 063_media_fit.sql if it was applied. Safe if the column was never added.

alter table public.videos
  drop constraint if exists videos_media_fit_check;

alter table public.videos
  drop column if exists media_fit;
