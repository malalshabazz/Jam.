import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const PAGE = 80;
let offset = 0;
let updated = 0;
let skipped = 0;
let failed = 0;

while (true) {
  const { data, error } = await supabase
    .from("videos")
    .select("id, cloudflare_stream_id, media_url")
    .eq("media_type", "video")
    .is("display_width", null)
    .not("cloudflare_stream_id", "is", null)
    .range(offset, offset + PAGE - 1);

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) break;

  for (const row of rows) {
    try {
      const size = await probeDisplaySize(row.cloudflare_stream_id, row.media_url);
      if (!size) {
        skipped += 1;
        continue;
      }
      const { error: updateError } = await supabase
        .from("videos")
        .update({ display_width: size.width, display_height: size.height })
        .eq("id", row.id);
      if (updateError) throw updateError;
      updated += 1;
      console.log(`Updated ${row.id} ${size.width}x${size.height}`);
    } catch (err) {
      failed += 1;
      console.error(
        `Failed ${row.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (rows.length < PAGE) break;
  offset += PAGE;
}

console.log(`Done. Updated ${updated}, skipped ${skipped}, failed ${failed}.`);

function isLikelyDefaultThumbCanvas(width, height) {
  const min = Math.min(width, height);
  const max = Math.max(width, height);
  if (Math.abs(width - height) <= 2 && (min === 640 || min === 720)) return true;
  if ((width === 640 && height === 720) || (width === 720 && height === 640)) return true;
  if (min === 640 && max === 640) return true;
  return false;
}

async function probeDisplaySize(streamId, mediaUrl) {
  if (streamId) {
    const thumb = await probeJpegSize(
      `https://videodelivery.net/${streamId}/thumbnails/thumbnail.jpg?time=0s&height=720&fit=scale`,
    );
    if (thumb && !isLikelyDefaultThumbCanvas(thumb.width, thumb.height)) {
      return thumb;
    }
  }
  const manifestUrl = streamId
    ? `https://videodelivery.net/${streamId}/manifest/video.m3u8`
    : typeof mediaUrl === "string" && mediaUrl.includes(".m3u8")
      ? mediaUrl.split("?")[0]
      : null;
  if (!manifestUrl) return null;
  return probeHlsSize(manifestUrl);
}

async function probeJpegSize(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return readJpegSize(buffer);
}

function readJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
      const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return null;
}

async function probeHlsSize(manifestUrl) {
  const response = await fetch(manifestUrl);
  if (!response.ok) return null;
  const text = await response.text();
  let best = null;
  for (const match of text.matchAll(/RESOLUTION=(\d+)x(\d+)/gi)) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!(width > 0 && height > 0)) continue;
    const pixels = width * height;
    if (!best || pixels > best.pixels) best = { width, height, pixels };
  }
  return best ? { width: best.width, height: best.height } : null;
}
