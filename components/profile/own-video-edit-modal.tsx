import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TagPicker } from "@/components/create/tag-picker";
import { VideoThumbnailFilmstrip } from "@/components/create/video-thumbnail-filmstrip";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SectionLabel } from "@/components/ui/section-label";
import { getCloudflarePlaybackUrl, getCloudflareThumbnailUrl, probeHlsDurationMs } from "@/lib/native-cloudflare";
import { creatorRoles, musicGenres } from "@/lib/options";
import {
  updateOwnVideo,
  type FeedVideo,
  type ProfileVideo,
} from "@/lib/native-social-data";
import { getVideoStreamId } from "@/lib/video-display";
import {
  getCloudflareThumbnailFilmstripFrames,
  getGridThumbnailCandidates,
  getVideoCaption,
  getVideoThumbnailTimeMs,
} from "@/lib/video-thumbnails";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import { CREATE_THUMBNAIL_FRAME_COUNT, MAX_VIDEO_GENRES, MAX_VIDEO_ROLES } from "@/theme/tokens";

const FALLBACK_THUMBNAIL_DURATION_MS = 45_000;

function isSlideshowPost(video: ProfileVideo | FeedVideo) {
  const imageUrls =
    ("imageUrls" in video && Array.isArray(video.imageUrls) && video.imageUrls) ||
    ("image_urls" in video && Array.isArray(video.image_urls) && video.image_urls) ||
    [];
  return (
    ("mediaType" in video && video.mediaType === "slideshow") ||
    ("media_type" in video && video.media_type === "slideshow") ||
    imageUrls.length > 0
  );
}

function getSlideshowImages(video: ProfileVideo | FeedVideo) {
  if ("imageUrls" in video && Array.isArray(video.imageUrls)) return video.imageUrls.filter(Boolean);
  if ("image_urls" in video && Array.isArray(video.image_urls)) return video.image_urls.filter(Boolean);
  return [];
}

export function OwnVideoEditModal({
  visible,
  video,
  onClose,
  onSaved,
}: {
  visible: boolean;
  video: ProfileVideo | FeedVideo | null;
  onClose: () => void;
  onSaved: (next: ProfileVideo) => void;
}) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [thumbnailFrames, setThumbnailFrames] = useState<Array<{ timeMs: number; uri: string }>>([]);
  const [loadingThumbnailFrames, setLoadingThumbnailFrames] = useState(false);
  const [selectedThumbnailTimeMs, setSelectedThumbnailTimeMs] = useState(1000);
  const [initialThumbnailTimeMs, setInitialThumbnailTimeMs] = useState(1000);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const slideshow = Boolean(video && isSlideshowPost(video));
  const slideshowImages = video ? getSlideshowImages(video) : [];

  useEffect(() => {
    if (!visible || !video) return;
    setCaption(getVideoCaption(video));
    setSelectedRoles(
      Array.isArray(video.roles) && video.roles.length
        ? video.roles.slice(0, MAX_VIDEO_ROLES)
        : [],
    );
    setSelectedGenres(
      Array.isArray(video.genres) && video.genres.length
        ? video.genres.slice(0, MAX_VIDEO_GENRES)
        : [],
    );
    setLookingFor(
      Boolean(
        "lookingFor" in video
          ? video.lookingFor
          : "looking_for" in video
            ? video.looking_for
            : false,
      ),
    );
    const thumbnailTimeMs = getVideoThumbnailTimeMs(video);
    setSelectedThumbnailTimeMs(thumbnailTimeMs);
    setInitialThumbnailTimeMs(thumbnailTimeMs);
    setPreviewUri(getGridThumbnailCandidates(video)[0] ?? null);
    setThumbnailFrames([]);

    if (isSlideshowPost(video)) {
      setLoadingThumbnailFrames(false);
      return;
    }

    const streamId = getVideoStreamId(video);
    if (!streamId) {
      setLoadingThumbnailFrames(false);
      return;
    }

    let active = true;
    setLoadingThumbnailFrames(true);
    void (async () => {
      const durationMs =
        (await probeHlsDurationMs(getCloudflarePlaybackUrl(streamId))) ??
        FALLBACK_THUMBNAIL_DURATION_MS;
      if (!active) return;
      setThumbnailFrames(
        getCloudflareThumbnailFilmstripFrames(
          streamId,
          durationMs,
          CREATE_THUMBNAIL_FRAME_COUNT,
        ),
      );
      setLoadingThumbnailFrames(false);
    })();

    return () => {
      active = false;
    };
  }, [video, visible]);

  function toggleLimitedTag(
    tag: string,
    selected: string[],
    setSelected: (next: string[]) => void,
    kind: "role" | "genre",
    max: number,
  ) {
    if (selected.includes(tag)) {
      setSelected(selected.filter((entry) => entry !== tag));
      return;
    }
    if (kind === "role") {
      setSelected([tag]);
      return;
    }
    if (selected.length >= max) {
      Alert.alert("limit reached", `choose up to ${max} ${kind}s.`);
      return;
    }
    setSelected([...selected, tag]);
  }

  async function save() {
    if (!video || saving) return;
    if (selectedRoles.length === 0 && selectedGenres.length === 0) {
      Alert.alert("choose tags", "select at least one role or genre.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateOwnVideo({
        videoId: video.id,
        caption,
        roles: selectedRoles,
        genres: selectedGenres,
        lookingFor,
        thumbnailTimeMs: slideshow ? null : selectedThumbnailTimeMs,
      });
      onSaved(updated);
      onClose();
    } catch (error) {
      Alert.alert(
        "could not save",
        error instanceof Error ? error.message : "try again",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!visible || !video) return null;

  return (
    <View style={styles.ownVideoEditOverlay} pointerEvents="auto">
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.logoSmall}>jam.</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="close">
            <Text style={styles.closeIconText}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.h1}>edit</Text>
        <Pressable
          onPress={() => setLookingFor((current) => !current)}
          style={styles.createLookingForToggle}
          accessibilityRole="switch"
          accessibilityState={{ checked: lookingFor }}
          accessibilityLabel="looking for collaborators"
        >
          <LookingForIcon active={lookingFor} size={28} />
          <View style={styles.createLookingForToggleCopy}>
            <Text style={styles.createLookingForToggleTitle}>looking for?</Text>
            <Text style={styles.createLookingForToggleHelper}>
              {slideshow
                ? "tag your post to show you're looking to collab"
                : "tag your video to show you're looking to collab"}
            </Text>
          </View>
        </Pressable>
        <View style={styles.createDetailsComposerRow}>
          <TextInput
            value={caption}
            onChangeText={(value) => setCaption(value.slice(0, 200))}
            placeholder="write a caption..."
            placeholderTextColor="#71717a"
            style={styles.createDetailsCaptionInput}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <View style={styles.createDetailsVideoTap}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.createDetailsVideoTapImage as ImageStyle}
                resizeMode={slideshow ? "contain" : "cover"}
              />
            ) : (
              <View style={styles.createDetailsVideoTapFallback} />
            )}
            <View style={styles.createDetailsVideoTapBadge}>
              <Text style={styles.createDetailsVideoTapBadgeText}>
                {slideshow
                  ? `${slideshowImages.length} photo${slideshowImages.length === 1 ? "" : "s"}`
                  : "thumbnail"}
              </Text>
            </View>
          </View>
        </View>
        {slideshow ? null : loadingThumbnailFrames ? (
          <ActivityIndicator color={getActivityIndicatorColor()} style={styles.createThumbnailLoader} />
        ) : thumbnailFrames.length > 0 ? (
          <VideoThumbnailFilmstrip
            frames={thumbnailFrames}
            initialTimeMs={initialThumbnailTimeMs}
            onSelect={(timeMs) => {
              setSelectedThumbnailTimeMs(timeMs);
              const streamId = getVideoStreamId(video);
              if (streamId) {
                setPreviewUri(getCloudflareThumbnailUrl(streamId, timeMs, { height: 640 }));
              }
            }}
          />
        ) : (
          <Text style={styles.helper}>could not load thumbnail frames.</Text>
        )}
        <SectionLabel label={`role (${selectedRoles.length}/${MAX_VIDEO_ROLES})`} />
        <Text style={styles.helper}>
          choose one role for this {slideshow ? "post" : "video"}.
        </Text>
        <TagPicker
          options={creatorRoles}
          selected={selectedRoles}
          onToggle={(role) =>
            toggleLimitedTag(role, selectedRoles, setSelectedRoles, "role", MAX_VIDEO_ROLES)
          }
        />
        <SectionLabel label={`genres (${selectedGenres.length}/${MAX_VIDEO_GENRES})`} />
        <Text style={styles.helper}>
          choose up to {MAX_VIDEO_GENRES} genres for this {slideshow ? "post" : "video"}.
        </Text>
        <TagPicker
          options={musicGenres}
          selected={selectedGenres}
          onToggle={(genre) =>
            toggleLimitedTag(genre, selectedGenres, setSelectedGenres, "genre", MAX_VIDEO_GENRES)
          }
        />
        <PrimaryButton
          label={saving ? "saving..." : "save"}
          disabled={saving || (selectedRoles.length === 0 && selectedGenres.length === 0)}
          onPress={() => {
            void save();
          }}
        />
        {saving ? (
          <ActivityIndicator color={getActivityIndicatorColor()} style={{ marginTop: 8 }} />
        ) : null}
      </ScrollView>
    </View>
  );
}
