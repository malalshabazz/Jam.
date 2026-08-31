import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { getVideoUploadErrorDetails, logVideoUploadStep } from "@/lib/native-cloudflare";
import { MAX_SLIDESHOW_IMAGES } from "@/lib/native-slideshow-storage";

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif|tif{1,2}|dng)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|avi|mkv|webm|3gp|mts|m2ts)$/i;

export type MaterializedLibraryAsset = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  durationMs: number;
};

export function libraryPickerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/3164|PHPhotos|iCloud|network asset|not available|couldn['’]t be completed/i.test(message)) {
    return "couldn’t load that item. it may still be in iCloud, or the format couldn’t be opened. download it first or try another one.";
  }
  return message.trim() || "couldn’t load that file. try another one.";
}

export function isLibraryVideoAsset(asset: ImagePicker.ImagePickerAsset) {
  if (asset.type === "video" || asset.type === "pairedVideo") return true;
  if (asset.type === "image" || asset.type === "livePhoto") return false;
  const mimeType = (asset.mimeType ?? "").toLowerCase();
  if (mimeType.startsWith("video/")) return true;
  if (mimeType.startsWith("image/")) return false;
  const name = `${asset.fileName ?? ""} ${asset.uri}`;
  if (VIDEO_EXT.test(name)) return true;
  if (IMAGE_EXT.test(name)) return false;
  return typeof asset.duration === "number" && asset.duration > 0;
}

export function libraryVideoDurationMs(duration: number | null | undefined) {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return 0;
  // ImagePicker documents milliseconds; some devices still return seconds.
  return duration < 1000 ? Math.round(duration * 1000) : Math.round(duration);
}

function inferMime(extension: string, kind: "video" | "image") {
  if (kind === "video") {
    if (extension === "mov" || extension === "qt") return "video/quicktime";
    if (extension === "webm") return "video/webm";
    if (extension === "m4v") return "video/x-m4v";
    return "video/mp4";
  }
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}

function extensionForAsset(asset: ImagePicker.ImagePickerAsset, kind: "video" | "image") {
  const fromName = (asset.fileName ?? asset.uri).split("?")[0]?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  const mimeType = (asset.mimeType ?? "").toLowerCase();
  if (mimeType.includes("quicktime") || mimeType.includes("mov")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic")) return "heic";
  if (mimeType.includes("heif")) return "heif";
  if (mimeType.includes("gif")) return "gif";
  return kind === "video" ? "mp4" : "jpg";
}

export async function materializeLibraryAsset(
  asset: ImagePicker.ImagePickerAsset,
  kind: "video" | "image",
): Promise<MaterializedLibraryAsset> {
  if (!asset.uri) {
    throw new Error("couldn’t read that file.");
  }

  const extension = extensionForAsset(asset, kind);
  const fileName = asset.fileName ?? `jam-${kind}-${Date.now()}.${extension}`;
  const mimeType = asset.mimeType ?? inferMime(extension, kind);
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error("couldn’t save that file.");
  }

  const dest = `${cacheDir}jam-library-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  async function acceptUri(uri: string, size: number | null): Promise<MaterializedLibraryAsset> {
    return {
      uri,
      fileName,
      mimeType,
      fileSize: size,
      width: asset.width || null,
      height: asset.height || null,
      durationMs: libraryVideoDurationMs(asset.duration),
    };
  }

  try {
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    const copied = await FileSystem.getInfoAsync(dest);
    if (copied.exists && (copied.size ?? 0) > 0) {
      return acceptUri(dest, copied.size ?? asset.fileSize ?? null);
    }
  } catch (error) {
    logVideoUploadStep("library asset copy failed", {
      kind,
      uriScheme: asset.uri.split(":")[0] || "unknown",
      ...getVideoUploadErrorDetails(error),
    });
  }

  if (asset.uri.startsWith("file://")) {
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (info.exists && (info.size ?? 0) > 0) {
      return acceptUri(asset.uri, info.size ?? asset.fileSize ?? null);
    }
  }

  throw new Error(libraryPickerErrorMessage(new Error("that file isn’t available on this phone.")));
}

type LibraryPickerLaunchOptions = {
  mediaTypes?: ImagePicker.MediaType[];
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
  /**
   * Ask Photos for a standard H.264 file. Needed when extracting audio: the
   * passthrough/current path uses PHAssetResourceManager.writeData, which
   * throws PHPhotosError 3164 on iCloud / HEVC / HDR clips.
   */
  preferCompatibleVideo?: boolean;
};

function libraryPickerOptions(options?: LibraryPickerLaunchOptions): ImagePicker.ImagePickerOptions {
  const preferCompatibleVideo = Boolean(options?.preferCompatibleVideo);
  return {
    mediaTypes: options?.mediaTypes ?? ["images", "videos"],
    allowsMultipleSelection: options?.allowsMultipleSelection ?? true,
    selectionLimit: options?.selectionLimit ?? MAX_SLIDESHOW_IMAGES,
    // Current + passthrough keeps original HEIC / HEVC for album picks.
    // Compatible + MediumQuality skips the native writeData fast-path that
    // throws PHPhotosError 3164 on many camera-roll videos.
    preferredAssetRepresentationMode: preferCompatibleVideo
      ? ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
      : ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    videoExportPreset: preferCompatibleVideo
      ? ImagePicker.VideoExportPreset.MediumQuality
      : ImagePicker.VideoExportPreset.Passthrough,
    quality: 1,
    orderedSelection: !preferCompatibleVideo,
    presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
  };
}

export async function launchCreateLibraryPicker(options?: LibraryPickerLaunchOptions) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("photo library access is needed to pick from your camera roll.");
  }

  const primary = libraryPickerOptions(options);
  try {
    return await ImagePicker.launchImageLibraryAsync(primary);
  } catch (firstError) {
    logVideoUploadStep("library picker primary failed — retrying compatible video picker", {
      preferCompatibleVideo: options?.preferCompatibleVideo ?? false,
      ...getVideoUploadErrorDetails(firstError),
    });
    try {
      return await ImagePicker.launchImageLibraryAsync({
        ...libraryPickerOptions({
          ...options,
          allowsMultipleSelection: false,
          selectionLimit: 1,
          preferCompatibleVideo: true,
        }),
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });
    } catch (retryError) {
      throw new Error(libraryPickerErrorMessage(retryError));
    }
  }
}
