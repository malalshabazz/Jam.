# Jam

Jam is an Expo/React Native app for creators to discover collaborators.

## Development

```bash
npm install
npm run dev
```

Metro should be ready in a few seconds. Optional iOS bundle pre-warm (slower):
`npm run dev -- --warm` or `JAM_WARM_IOS_BUNDLE=1 npm run dev`.

If Metro hangs or fails to resolve packages under `~/Documents`, iCloud may have
evicted `node_modules` (Optimize Mac Storage). Run `npm ci`, or keep the repo
outside iCloud Documents.

Use `npm run ios` or `npm run android` for native development builds.

## Native API

The native app requests Cloudflare Stream direct-upload URLs from
`app/api/cloudflare-stream/uploads/route.ts`. This small authenticated endpoint
also removes Cloudflare media before a confirmed account deletion. It is
deployed on Vercel and is the only retained Next.js code.

The deployed URL is configured through `cloudflareUploadEndpoint` in `app.json`
or `EXPO_PUBLIC_CLOUDFLARE_UPLOAD_ENDPOINT`. The Vercel deployment requires
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only
`SUPABASE_SERVICE_ROLE_KEY`.

```bash
npm run dev:next
npm run build:next
```
