import { Image, type ImageContentFit, type ImageLoadEventData } from "expo-image";
import { PixelRatio, StyleSheet, type StyleProp, type ImageStyle } from "react-native";
import { PROFILE_GRID_ITEM_WIDTH } from "@/theme/tokens";

const GRID_CACHE_POLICY = "memory-disk" as const;
const pixelRatio = PixelRatio.get();

/** Decode budget for a profile grid tile (device pixels, 9:16). */
export const GRID_THUMB_DECODE_WIDTH = Math.ceil(PROFILE_GRID_ITEM_WIDTH * pixelRatio);
export const GRID_THUMB_DECODE_HEIGHT = Math.ceil(GRID_THUMB_DECODE_WIDTH * (16 / 9));

export function prefetchGridImage(uri: string) {
  return Image.prefetch(uri, GRID_CACHE_POLICY);
}

/** Feed / player covers: same memory-disk cache, no crossfade, never a blank decode. */
export function CachedCoverImage({
  uri,
  contentFit,
  recyclingKey,
  onLoad,
  onError,
  style,
}: {
  uri: string;
  contentFit: ImageContentFit;
  recyclingKey?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={{ uri }}
      style={style ?? StyleSheet.absoluteFill}
      contentFit={contentFit}
      cachePolicy={GRID_CACHE_POLICY}
      recyclingKey={recyclingKey ?? uri}
      allowDownscaling
      transition={0}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

/**
 * Profile-grid stills: disk+memory cache, no crossfade, optional tile-sized decode.
 * Live blur is only for locked cells — loading previews stay unblurred (already tiny).
 */
export function CachedGridImage({
  uri,
  contentFit,
  recyclingKey,
  alt,
  priority = "normal",
  blurRadius,
  decodeAtTileSize = false,
  onLoad,
  onLoadEnd,
  onError,
  style,
}: {
  uri: string;
  contentFit: ImageContentFit;
  recyclingKey?: string;
  alt?: string;
  priority?: "low" | "normal" | "high";
  blurRadius?: number;
  decodeAtTileSize?: boolean;
  onLoad?: (event: ImageLoadEventData) => void;
  onLoadEnd?: () => void;
  onError?: () => void;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={
        decodeAtTileSize
          ? { uri, width: GRID_THUMB_DECODE_WIDTH, height: GRID_THUMB_DECODE_HEIGHT }
          : { uri }
      }
      style={style ?? StyleSheet.absoluteFill}
      contentFit={contentFit}
      cachePolicy={GRID_CACHE_POLICY}
      recyclingKey={recyclingKey ?? uri}
      allowDownscaling
      transition={0}
      priority={priority}
      blurRadius={blurRadius}
      alt={alt}
      onLoad={onLoad}
      onLoadEnd={onLoadEnd}
      onError={onError}
    />
  );
}
