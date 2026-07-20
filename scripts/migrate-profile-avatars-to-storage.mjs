import { createClient } from "@supabase/supabase-js";

const AVATAR_BUCKET = "avatars";
const AVATAR_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

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

const { data: profiles, error } = await supabase
  .from("profiles")
  .select("id, avatar_url")
  .like("avatar_url", "data:image/%");

if (error) throw error;

let migrated = 0;

for (const profile of profiles ?? []) {
  try {
    const avatar = parseDataUrl(profile.avatar_url);
    if (!avatar) continue;

    const extension = getImageExtension(avatar.mimeType);
    const objectPath = `${profile.id}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, avatar.bytes, {
        contentType: avatar.mimeType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    await removePreviousAvatars(profile.id, objectPath);

    const { data: publicUrlData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(objectPath);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq("id", profile.id);

    if (updateError) throw updateError;

    migrated += 1;
    console.log(`Migrated avatar for profile ${profile.id}`);
  } catch (err) {
    console.error(
      `Failed to migrate avatar for profile ${profile.id}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

console.log(`Done. Migrated ${migrated} avatar(s).`);

function parseDataUrl(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

async function removePreviousAvatars(userId, keepPath) {
  const stalePaths = AVATAR_EXTENSIONS
    .map((extension) => `${userId}/avatar.${extension}`)
    .filter((path) => path !== keepPath);

  if (stalePaths.length === 0) return;

  await supabase.storage.from(AVATAR_BUCKET).remove(stalePaths);
}

function getImageExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  if (mimeType === "image/jpeg") return "jpg";
  return "jpg";
}
