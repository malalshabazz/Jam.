import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinedTagField } from "@/components/create/lined-tag-field";
import { LookingForTagFields } from "@/components/create/looking-for-tag-fields";
import { CreatePostPreviewModal } from "@/components/create/post-preview-modal";
import { LookingForIcon } from "@/components/icons/looking-for-icon";
import { PrimaryButton } from "@/components/ui/primary-button";
import { getRememberedVideoAspectSize, getVideoAspectCacheKeyFromVideo } from "@/components/video/aspect-cache";
import { getCloudflarePlaybackUrl, getCloudflareThumbnailUrl, probeHlsDurationMs } from "@/lib/native-cloudflare";
import { creatorRoles, musicGenres } from "@/lib/options";
import {
  updateOwnVideo,
  type FeedVideo,
  type Profile,
  type ProfileVideo,
} from "@/lib/native-social-data";
import { getLookingForVideoTags } from "@/lib/profile-mappers";
import { getGridVideoSource, getVideoStreamId } from "@/lib/video-display";
import {
  getCloudflareThumbnailFilmstripFrames,
  getGridThumbnailCandidates,
  getVideoCaption,
  getVideoThumbnailTimeMs,
} from "@/lib/video-thumbnails";
import { styles } from "@/theme/styles";
import {
  CREATE_THUMBNAIL_FRAME_COUNT,
  MAX_VIDEO_GENRES,
  MAX_VIDEO_ROLES,
  viewportHeight,
} from "@/theme/tokens";

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

function previewProfileFromVideo(video: ProfileVideo | FeedVideo): Profile {
  return {
    id: ("userId" in video && video.userId) || "",
    display_name: video.creatorName ?? null,
    bio: "bio" in video && typeof video.bio === "string" ? video.bio : null,
    creator_types: video.role ? [video.role] : null,
    location: video.location ?? null,
    country: null,
    city: null,
    region: null,
    country_code: null,
    location_granularity: null,
    latitude: null,
    longitude: null,
    live_latitude: null,
    live_longitude: null,
    live_location_updated_at: null,
    near_me_radius_miles: null,
    avatar_url: video.avatarUrl ?? null,
    onboarding_complete: null,
    welcome_seen: null,
    early_adopter: "earlyAdopter" in video ? Boolean(video.earlyAdopter) : null,
    video_count: "videoCount" in video && typeof video.videoCount === "number" ? video.videoCount : null,
    pro_subscription_active: null,
  };
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
  const [caption, setCaption] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState(false);
  const [selectedLookingForRoles, setSelectedLookingForRoles] = useState<string[]>([]);
  const [selectedLookingForGenres, setSelectedLookingForGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [thumbnailFrames, setThumbnailFrames] = useState<Array<{ timeMs: number; uri: string }>>([]);
  const [loadingThumbnailFrames, setLoadingThumbnailFrames] = useState(false);
  const [selectedThumbnailTimeMs, setSelectedThumbnailTimeMs] = useState(1000);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);
  const detailsScrollRef = useRef<ScrollView>(null);
  const detailsScrollYRef = useRef(0);
  const detailsPostBarHeightRef = useRef(64);
  const focusedTagFieldRef = useRef<View | null>(null);
  const slideshow = Boolean(video && isSlideshowPost(video));
  const slideshowImages = video ? getSlideshowImages(video) : [];
  const previewSource = video && !slideshow ? getGridVideoSource(video) : null;
  const previewAspect = video ? getRememberedVideoAspectSize(getVideoAspectCacheKeyFromVideo(video)) : null;

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
    const lookingForTags = getLookingForVideoTags(video);
    setSelectedLookingForRoles(lookingForTags.roles.slice(0, MAX_VIDEO_ROLES));
    setSelectedLookingForGenres(lookingForTags.genres.slice(0, MAX_VIDEO_GENRES));
    const thumbnailTimeMs = getVideoThumbnailTimeMs(video);
    setSelectedThumbnailTimeMs(thumbnailTimeMs);
    setPreviewUri(getGridThumbnailCandidates(video)[0] ?? null);
    setThumbnailFrames([]);
    setPostPreviewOpen(false);

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

  function revealFocusedTagField(keyboardHeight: number) {
    const field = focusedTagFieldRef.current;
    if (!field || keyboardHeight <= 0) return;
    field.measureInWindow((_x, y, _w, height) => {
      const reserved = keyboardHeight + detailsPostBarHeightRef.current + 16;
      const overflow = y + height - (viewportHeight - reserved);
      if (overflow <= 8) return;
      detailsScrollRef.current?.scrollTo({
        y: Math.max(0, detailsScrollYRef.current + overflow),
        animated: true,
      });
    });
  }

  function handleTagFieldFocus(fieldRef: RefObject<View | null>) {
    focusedTagFieldRef.current = fieldRef.current;
    const keyboardHeight = Keyboard.metrics?.()?.height ?? 0;
    if (keyboardHeight > 0) {
      requestAnimationFrame(() => revealFocusedTagField(keyboardHeight));
    }
  }

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      revealFocusedTagField(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      focusedTagFieldRef.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
    if (selected.length >= max) {
      Alert.alert("limit reached", `choose up to ${max} ${kind}s.`);
      return;
    }
    setSelected([...selected, tag]);
  }

  function selectThumbnailTime(timeMs: number, uri?: string) {
    setSelectedThumbnailTimeMs(timeMs);
    const streamId = video ? getVideoStreamId(video) : null;
    setPreviewUri(
      streamId
        ? getCloudflareThumbnailUrl(streamId, timeMs, { width: 360, height: 640, fit: "fill" })
        : uri ?? previewUri,
    );
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
        lookingForRoles: lookingFor ? selectedLookingForRoles : [],
        lookingForGenres: lookingFor ? selectedLookingForGenres : [],
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

  const lookingForTagFields = lookingFor ? (
    <LookingForTagFields
      onInputFocus={handleTagFieldFocus}
      selectedRoles={selectedLookingForRoles}
      selectedGenres={selectedLookingForGenres}
      onToggleRole={(role) =>
        toggleLimitedTag(
          role,
          selectedLookingForRoles,
          setSelectedLookingForRoles,
          "role",
          MAX_VIDEO_ROLES,
        )
      }
      onToggleGenre={(genre) =>
        toggleLimitedTag(
          genre,
          selectedLookingForGenres,
          setSelectedLookingForGenres,
          "genre",
          MAX_VIDEO_GENRES,
        )
      }
    />
  ) : null;

  const captionField = (
    <View style={styles.createDetailsCaptionColumn}>
      <TextInput
        value={caption}
        onChangeText={(value) => setCaption(value.slice(0, 200))}
        placeholder="write a caption"
        placeholderTextColor="#71717a"
        style={styles.createDetailsCaptionInput}
        multiline
        maxLength={200}
        underlineColorAndroid="transparent"
      />
    </View>
  );

  const previewThumb = (
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
            : "preview"}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.ownVideoEditOverlay} pointerEvents="auto">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            ref={detailsScrollRef}
            contentContainerStyle={[styles.screenContent, styles.createDetailsScrollContent]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={(event) => {
              detailsScrollYRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.headerRow}>
              <Text style={styles.logoSmall}>jam.</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="close">
                <Text style={styles.closeIconText}>×</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                setLookingFor((current) => {
                  if (current) {
                    setSelectedLookingForRoles([]);
                    setSelectedLookingForGenres([]);
                  }
                  return !current;
                });
              }}
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
            {lookingForTagFields}
            <View style={styles.createDetailsComposer}>
              <View style={styles.createCaptionHairline} />
              <View style={styles.createDetailsComposerRow}>
                {captionField}
                {slideshow || !previewSource ? (
                  previewThumb
                ) : (
                  <Pressable
                    onPress={() => setPostPreviewOpen(true)}
                    style={styles.createDetailsVideoTap}
                    accessibilityLabel="preview post"
                  >
                    {previewUri ? (
                      <Image
                        source={{ uri: previewUri }}
                        style={styles.createDetailsVideoTapImage as ImageStyle}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.createDetailsVideoTapFallback} />
                    )}
                    <View style={styles.createDetailsVideoTapBadge}>
                      <Text style={styles.createDetailsVideoTapBadgeText}>preview</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
            <LinedTagField
              placeholder="role"
              options={creatorRoles}
              selected={selectedRoles}
              onInputFocus={handleTagFieldFocus}
              onToggle={(role) =>
                toggleLimitedTag(role, selectedRoles, setSelectedRoles, "role", MAX_VIDEO_ROLES)
              }
            />
            <LinedTagField
              placeholder="genre"
              options={musicGenres}
              selected={selectedGenres}
              onInputFocus={handleTagFieldFocus}
              onToggle={(genre) =>
                toggleLimitedTag(genre, selectedGenres, setSelectedGenres, "genre", MAX_VIDEO_GENRES)
              }
            />
          </ScrollView>
          <View
            style={styles.createDetailsPostBar}
            onLayout={(event) => {
              detailsPostBarHeightRef.current = event.nativeEvent.layout.height;
            }}
          >
            <PrimaryButton
              style={styles.createDetailsPostButton}
              label={saving ? "saving..." : "save"}
              disabled={saving || (selectedRoles.length === 0 && selectedGenres.length === 0)}
              onPress={() => {
                void save();
              }}
            />
          </View>
          {!slideshow ? (
            <CreatePostPreviewModal
              visible={postPreviewOpen}
              onClose={() => setPostPreviewOpen(false)}
              videoUri={previewSource}
              videoWidth={previewAspect?.width ?? null}
              videoHeight={previewAspect?.height ?? null}
              filter="none"
              textOverlays={[]}
              caption={caption}
              lookingFor={lookingFor}
              lookingForRoles={lookingFor ? selectedLookingForRoles : []}
              lookingForGenres={lookingFor ? selectedLookingForGenres : []}
              profile={previewProfileFromVideo(video)}
              roles={selectedRoles}
              genres={selectedGenres}
              thumbnailFrames={thumbnailFrames}
              selectedThumbnailTimeMs={selectedThumbnailTimeMs}
              loadingThumbnailFrames={loadingThumbnailFrames}
              onSelectThumbnail={(timeMs, uri) => selectThumbnailTime(timeMs, uri)}
            />
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
