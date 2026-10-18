# Jam Bugbot

Creator discovery app (Expo / React Native). Next.js is API-only. Review for **real breaks**, not style, naming, or import order.

Ignore: formatting, comments, “prefer early return,” and refactors that do not change behavior.

## High — ship-breaking

Flag these as high severity:

1. **New `videos.insert` fallbacks** in `createVideo` / `lib/native-social-data.ts`. Writes go through `publish_own_video`. Existing fallbacks are debt; **adding** another insert shape is a bug.
2. **Clip without claim transfer.** After trim, the clipped Cloudflare UID must be published and `p_source_stream_id` must be the pre-clip UID so `stream_upload_claims` can move. Publishing the clipped id while the claim still sits on the source causes `42501`.
3. **Client writes to `stream_upload_claims`.** Only Next `app/api/cloudflare-stream/*` (service role) may mint or mark claims `publishable`.
4. **`auth.uid()` inside `SECURITY DEFINER`** instead of `request_user_id()`. `auth.uid()` is often null there. Missing `search_path` is the same class of bug.
5. **`lib/supabase-admin.ts` imported from the Expo app** (`screens/`, `components/`, client `lib/` used by RN). Service role is server-only.

## Medium — silent wrong feed or privacy

6. **Feed filter drift.** `lib/feed-filters.ts` (`feedVideoMatchesFilters`, `lookingForOnly`) must match `fetch_filtered_feed_videos` / `fetch_nearby_feed_videos`. Looking-for ON matches collaborator target tags; OFF matches the post’s own roles/genres, never the profile role. Changing only the client or only the SQL is a bug.
7. **Jam-gate / blocks.** Video reads must still hide blocked users, hidden creators, and non-jam profile videos (`user_blocks`, jam-gate). Do not “simplify” RLS to make a query work.
8. **Letterbox / aspect flash** on feed swipe or profile fullscreen. Do not reintroduce a DB `media_fit` column. Persist `display_width` / `display_height` (rotation applied) and derive fit client-side from that size (`lib/video-display.ts`, letterbox shell, aspect-cache). The first poster and VideoView frame must use the same fit — never start `contain` and snap to `cover`.
9. **Black frames, stuck covers, or muted-then-uncovered starts in the Discover feed.** Never play muted or covered. Start playback, unmute, and drop both covers in the same tick once a frame is displayable. Do not play under a still and flip audio/cover later. Do not clear the decoded-frame flag on pause/restart/hold. Do not swap to an uncached mid-clip Cloudflare thumb. Do not drop the cover on a timer. Do not leave the cover/spinner stuck over a playing video. Do not use `#000` as the feed cover fallback. Tab return must resume the exact leave position and pause/play state.

## Out of scope

- Do not demand a full split of `native-social-data.ts` or the giant screens.
- Do not flag missing tests as a blocker unless the PR changes feed RPC semantics or `publish_own_video` and includes no check at all.
- Do not invent product AI, matching, or moderation admin features.

When unsure, ask: would this ship a broken publish, an empty/wrong feed, or a privacy leak? If no, do not comment.
