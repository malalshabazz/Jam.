import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JamVideoView } from "@/components/video/jam-video-view";
import { getVideoFilterOverlayStyle, VideoTextOverlayGlyph } from "@/components/VideoPresentationOverlays";
import { Avatar } from "@/components/ui/avatar";
import { ProBadge } from "@/components/ui/badges";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import { getCreateTextOverlayFontSize, getCreateTextOverlayLineHeight } from "@/components/create/layout";
import { getUniqueStrings } from "@/lib/format";
import { formatProfileLocation, getProfileLocationParts } from "@/lib/location-filter";
import { getProBadgeKind } from "@/lib/pro-entitlements";
import { getNavBarHeight } from "@/lib/nav-bar";
import {
  clampTextOverlayFontScale,
  getVideoTextEffectChrome,
  getVideoTextOutlineRadius,
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
  filter,
  textOverlays,
  caption,
  lookingFor = false,
  profile,
  roles,
  genres,
  trimStartRatio = 0,
  trimEndRatio = 1,
}: {
  visible: boolean;
  onClose: () => void;
  videoUri: string | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  filter: VideoFilter;
  textOverlays: CreateTextOverlayItem[];
  caption: string;
  lookingFor?: boolean;
  profile: Profile | null;
  roles: string[];
  genres: string[];
  trimStartRatio?: number;
  trimEndRatio?: number;
}) {
  const insets = useSafeAreaInsets();
  const displayName = profile?.display_name?.trim() || "you";
  const role = profile?.creator_types?.[0] ?? "creator";
  const location = profile
    ? formatProfileLocation(getProfileLocationParts(profile).country, getProfileLocationParts(profile).city) ??
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
  const previewVideoHeight = Math.max(0, previewFrameSize.height - previewNavBarHeight);

  if (!visible || !videoUri) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.createPostPreviewBackdrop} onPress={onClose}>
        <View
          style={[styles.createPostPreviewFrame, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewFrameSize({ width, height });
          }}
        >
          <View style={[styles.feedPreviewVideoClip, { bottom: previewNavBarHeight }]}>
            <JamVideoView
              source={videoUri}
              style={styles.createPostPreviewVideo}
              knownWidth={videoWidth}
              knownHeight={videoHeight}
              shouldPlay
              isLooping
              isMuted={false}
              volume={1}
              trimStartRatio={trimStartRatio}
              trimEndRatio={trimEndRatio}
            />
            {filter !== "none" && (
              <View
                pointerEvents="none"
                style={[styles.createPostPreviewFilter, getVideoFilterOverlayStyle(filter)]}
              />
            )}
            <View pointerEvents="none" style={styles.createPostPreviewShade} />
          </View>
          {visibleTextOverlays.map((overlay) => {
            const previewTextSize = previewTextSizes[overlay.id] ?? { width: 0, height: 0 };
            const previewTextLeft = previewFrameSize.width * overlay.centerRatio.x - previewTextSize.width / 2;
            const previewTextTop = previewVideoHeight * overlay.centerRatio.y - previewTextSize.height / 2;
            const previewFontSize = getCreateTextOverlayFontSize(
              clampTextOverlayFontScale(overlay.fontScale),
            );
            const previewLineHeight = getCreateTextOverlayLineHeight(previewFontSize);
            const previewMaxWidth = Math.max(120, previewFrameSize.width * TEXT_OVERLAY_MAX_WIDTH_RATIO);
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
            {lookingFor || trimmedCaption ? (
              <View style={styles.feedCaptionRow}>
                {lookingFor ? (
                  <View style={styles.feedLookingForIcon} accessibilityLabel="looking for collaborators">
                    <LookingForIcon active size={19} shadow />
                  </View>
                ) : null}
                {trimmedCaption ? (
                  <Text style={[styles.caption, styles.feedCaptionText]}>{trimmedCaption}</Text>
                ) : null}
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
          <View
            pointerEvents="none"
            style={[styles.createPostPreviewNavBarPlaceholder, { height: previewNavBarHeight }]}
          />
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
