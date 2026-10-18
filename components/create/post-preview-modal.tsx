import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { VideoThumbnailFilmstrip } from "@/components/create/video-thumbnail-filmstrip";
import { CreateEditSoundtrack } from "@/components/create/edit-soundtrack";
import { CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT } from "@/theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JamVideoView } from "@/components/video/jam-video-view";
import { JamSlideshowView } from "@/components/video/jam-slideshow-view";
import { getNineSixteenCanvasRect } from "@/components/video/aspect-cache";
import { getVideoFilterOverlayStyle, VideoTextOverlayGlyph } from "@/components/VideoPresentationOverlays";
import { Avatar } from "@/components/ui/avatar";
import { ProBadge } from "@/components/ui/badges";
import { FeedLookingForRow } from "@/components/discover/feed-looking-for-row";
import { getCreateTextOverlayFontSize, getCreateTextOverlayLineHeight } from "@/components/create/layout";
import { getUniqueStrings } from "@/lib/format";
import { formatProfileLocationLabel } from "@/lib/location-filter";
import { getProBadgeKind } from "@/lib/pro-entitlements";
import { getNavBarHeight } from "@/lib/nav-bar";
import {
  clampTextOverlayFontScale,
  getVideoTextEffectChrome,
  getVideoTextOverlayFontFamily,
  getVideoTextOverlayFontWeight,
} from "@/lib/video-presentation";
import { styles } from "@/theme/styles";
import { TEXT_OVERLAY_MAX_WIDTH_RATIO, viewportHeight, viewportWidth } from "@/theme/tokens";
import type { CreateTextOverlayItem, VideoFilter } from "@/types/app";
import type { Profile } from "@/lib/native-social-data";

export function CreatePostPreviewModal({
  visible,
  onClose,
  videoUri,
  videoWidth = null,
  videoHeight = null,
  slideshowImageUris = [],
  audioUri = null,
  audioTrimStartRatio = 0,
  audioTrimEndRatio = 1,
  filter,
  textOverlays,
  caption,
  lookingFor = false,
  lookingForRoles = [],
  lookingForGenres = [],
  profile,
  roles,
  genres,
  trimStartRatio = 0,
  trimEndRatio = 1,
  thumbnailFrames = [],
  selectedThumbnailTimeMs = 0,
  loadingThumbnailFrames = false,
  onSelectThumbnail,
}: {
  visible: boolean;
  onClose: () => void;
  videoUri: string | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  slideshowImageUris?: string[];
  audioUri?: string | null;
  audioTrimStartRatio?: number;
  audioTrimEndRatio?: number;
  filter: VideoFilter;
  textOverlays: CreateTextOverlayItem[];
  caption: string;
  lookingFor?: boolean;
  lookingForRoles?: string[];
  lookingForGenres?: string[];
  profile: Profile | null;
  roles: string[];
  genres: string[];
  trimStartRatio?: number;
  trimEndRatio?: number;
  thumbnailFrames?: Array<{ timeMs: number; uri: string }>;
  selectedThumbnailTimeMs?: number;
  loadingThumbnailFrames?: boolean;
  onSelectThumbnail?: (timeMs: number, uri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const displayName = profile?.display_name?.trim() || "you";
  const role = profile?.creator_types?.[0] ?? "creator";
  const location = profile
    ? formatProfileLocationLabel(profile) ??
      "unknown"
    : "unknown";
  const visibleTags = getUniqueStrings([...roles, ...genres]);
  const trimmedCaption = caption.trim();
  const createPreviewProBadge = getProBadgeKind({
    earlyAdopter: profile?.early_adopter,
    videoCount: profile?.video_count,
    proSubscriptionActive: profile?.pro_subscription_active,
  });
  const visibleTextOverlays = textOverlays.filter((overlay) => overlay.text.trim());
  const previewNavBarHeight = getNavBarHeight(insets.bottom);
  const [previewFrameSize, setPreviewFrameSize] = useState({ width: viewportWidth, height: viewportHeight });
  const [previewTextSizes, setPreviewTextSizes] = useState<Record<string, { width: number; height: number }>>({});
  const slideshowImages = slideshowImageUris.map((uri) => uri.trim()).filter(Boolean);
  const isSlideshowPreview = slideshowImages.length > 0;
  // Slideshow photos use the below-status-bar box (same as JamSlideshowView);
  // video preview keeps the full frame above the nav bar.
  const previewMediaTop = isSlideshowPreview ? insets.top : 0;
  const previewVideoHeight = Math.max(
    0,
    previewFrameSize.height - previewNavBarHeight - previewMediaTop,
  );
  const previewCanvas = getNineSixteenCanvasRect(previewFrameSize.width, previewVideoHeight);
  const previewCanvasFontScale =
    viewportWidth > 0 ? previewCanvas.width / viewportWidth : 1;
  const previewFilmstripHeight = Math.min(
    CREATE_THUMBNAIL_FILMSTRIP_FRAME_HEIGHT,
    Math.max(48, previewNavBarHeight - Math.max(insets.bottom, 10) - 12),
  );

  if (!visible || (!videoUri && !isSlideshowPreview)) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.createPostPreviewBackdrop} onPress={onClose}>
        <View
          style={[
            styles.createPostPreviewFrame,
            {
              // Slideshow applies its own status-bar inset inside JamSlideshowView.
              paddingTop: isSlideshowPreview ? 0 : insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewFrameSize({ width, height });
          }}
        >
          <View style={[styles.feedPreviewVideoClip, { bottom: previewNavBarHeight }]}>
            {isSlideshowPreview ? (
              <JamSlideshowView
                imageUrls={slideshowImages}
                audioUrl={null}
                shouldPlay
                isActive
                style={styles.createPostPreviewVideo}
              />
            ) : videoUri ? (
              <JamVideoView
                source={videoUri}
                style={styles.createPostPreviewVideo}
                knownWidth={videoWidth}
                knownHeight={videoHeight}
                shouldPlay
                isLooping
                isMuted={Boolean(audioUri)}
                volume={audioUri ? 0 : 1}
                trimStartRatio={trimStartRatio}
                trimEndRatio={trimEndRatio}
              />
            ) : null}
            {audioUri ? (
              <CreateEditSoundtrack
                uri={audioUri}
                playing
                trimStartRatio={audioTrimStartRatio}
                trimEndRatio={audioTrimEndRatio}
              />
            ) : null}
            {filter !== "none" && !isSlideshowPreview && (
              <View
                pointerEvents="none"
                style={[styles.createPostPreviewFilter, getVideoFilterOverlayStyle(filter)]}
              />
            )}
            <View pointerEvents="none" style={styles.createPostPreviewShade} />
          </View>
          {visibleTextOverlays.map((overlay) => {
            const previewTextSize = previewTextSizes[overlay.id] ?? { width: 0, height: 0 };
            const previewTextLeft =
              previewCanvas.left +
              previewCanvas.width * overlay.centerRatio.x -
              previewTextSize.width / 2;
            const previewTextTop =
              previewMediaTop +
              previewCanvas.top +
              previewCanvas.height * overlay.centerRatio.y -
              previewTextSize.height / 2;
            const previewFontSize =
              getCreateTextOverlayFontSize(clampTextOverlayFontScale(overlay.fontScale)) *
              previewCanvasFontScale;
            const previewLineHeight = getCreateTextOverlayLineHeight(previewFontSize);
            const previewMaxWidth = Math.max(120, previewCanvas.width * TEXT_OVERLAY_MAX_WIDTH_RATIO);
            const previewFontFamily = getVideoTextOverlayFontFamily(overlay.fontId);
            const previewFontWeight = getVideoTextOverlayFontWeight(overlay.fontId);
            const previewChrome = getVideoTextEffectChrome(overlay.effectId, {
              fontSize: previewFontSize,
              density: "edit",
            });
            const previewTextMaxWidth = Math.max(
              48,
              previewMaxWidth - previewChrome.paddingHorizontal * 2,
            );

            return (
              <View
                key={overlay.id}
                pointerEvents="none"
                style={[
                  styles.createPostPreviewTextOverlay,
                  {
                    left: previewTextLeft,
                    top: previewTextTop,
                    maxWidth: previewMaxWidth,
                    overflow: "visible",
                  },
                ]}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setPreviewTextSizes((current) => {
                    const previous = current[overlay.id];
                    if (previous?.width === width && previous?.height === height) return current;
                    return { ...current, [overlay.id]: { width, height } };
                  });
                }}
              >
                <VideoTextOverlayGlyph
                  text={overlay.text.trim()}
                  effectId={overlay.effectId}
                  density="edit"
                  textStyle={[
                    styles.createPostPreviewTextOverlayText,
                    {
                      fontSize: previewFontSize,
                      lineHeight: previewLineHeight,
                      maxWidth: previewTextMaxWidth,
                      fontFamily: previewFontFamily,
                      ...(previewFontWeight
                        ? { fontWeight: previewFontWeight }
                        : { fontWeight: undefined }),
                    },
                  ]}
                />
              </View>
            );
          })}
          <View pointerEvents="none" style={styles.createPostPreviewMeta}>
            <View style={styles.row}>
              <Avatar uri={profile?.avatar_url} size={52} />
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text style={styles.feedName}>{displayName}</Text>
                  {createPreviewProBadge ? <ProBadge kind={createPreviewProBadge} /> : null}
                </View>
                <Text style={styles.feedRole}>
                  {role} - {location}
                </Text>
              </View>
            </View>
            <FeedLookingForRow
              lookingFor={lookingFor}
              roles={lookingForRoles}
              genres={lookingForGenres}
            />
            {trimmedCaption ? (
              <View style={styles.feedCaptionRow}>
                <Text style={[styles.caption, styles.feedCaptionText]}>{trimmedCaption}</Text>
              </View>
            ) : null}
            {visibleTags.length > 0 ? (
              <View style={styles.tags}>
                {visibleTags.map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => undefined}
            style={[
              styles.createPostPreviewNavBarPlaceholder,
              styles.createPostPreviewFilmstripBar,
              { height: previewNavBarHeight, paddingBottom: Math.max(insets.bottom, 8) },
            ]}
          >
            {thumbnailFrames.length > 0 && onSelectThumbnail ? (
              <VideoThumbnailFilmstrip
                frames={thumbnailFrames}
                filter={filter}
                textOverlays={textOverlays}
                initialTimeMs={selectedThumbnailTimeMs}
                embedded
                frameHeight={previewFilmstripHeight}
                onSelect={onSelectThumbnail}
              />
            ) : loadingThumbnailFrames ? (
              <ActivityIndicator color="#fff" />
            ) : null}
          </Pressable>
          <Pressable
            style={[styles.createPostPreviewClose, { top: insets.top + 8 }]}
            onPress={onClose}
            accessibilityLabel="close preview"
          >
            <Text style={styles.closeIconText}>×</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
