<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Jam

Creator discovery app. The **Expo / React Native app is the product**. Next.js on Vercel is **API-only** (Cloudflare Stream, geocode, auth email bridge, account delete) — not a website.

## Stack

- Client: Expo 54, React Native, bottom tabs in `App.tsx`
- Data: Supabase (Postgres, Auth, Storage, Realtime). Product rules live in SQL under `supabase/migrations/`
- Video: Cloudflare Stream (`app/api/cloudflare-stream/`, `lib/native-cloudflare.ts`)
- Slideshow media: Supabase Storage bucket `post-media`

## Tabs

- **Discover** `screens/discover-screen.tsx` — vertical feed, filters, Near Me, looking-for, jam from feed
- **Create** `screens/create-screen.tsx` — camera/library → edit → tags → background upload
- **Inbox** `screens/inbox-screen.tsx` — jam requests and DMs
- **You** `screens/my-profile-screen.tsx` — own grid, pins, settings

“Jam” is a request/accept graph, not follows. Mutual jam unlocks full profile videos and DMs.

## Hard rules

1. Never import `lib/supabase-admin.ts` from the React Native app (`screens/`, `components/`, or client `lib/` modules). Service role stays on the server (`app/api/**`, `*-server.ts`).
2. Publish video/slideshow rows through `publish_own_video`. Do not add new `videos.insert` fallbacks in `createVideo`.
3. Client filters in `lib/feed-filters.ts` must match `fetch_filtered_feed_videos` / `fetch_nearby_feed_videos`. Looking-for ON uses collaborator target tags; OFF uses the post’s own roles/genres.
4. `SECURITY DEFINER` SQL uses `request_user_id()`, not raw `auth.uid()`. Keep `search_path`. Clients must not write `stream_upload_claims`.
5. Prefer small, local changes. Do not split `lib/native-social-data.ts` or the giant screens without tests covering the behavior you are moving.

## Commands

- App: `npm run dev`
- API: `npm run dev:next`
- Lint: `npm run lint`
