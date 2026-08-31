import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  blockUser,
  fetchMyVideos,
  fetchProfile,
  fetchSavedVideos,
  getProfileVideoPinnedRank,
  hideCreator,
  MAX_PINNED_PROFILE_VIDEOS,
  pinProfileVideo,
  reportVideo,
  sendJamRequest,
  unpinProfileVideo,
  type FeedVideo,
  type Profile,
  type ProfileVideo,
  type ReportReason,
} from "@/lib/native-social-data";
import {
  pendingSlideshowToProfileVideo,
  retryPendingSlideshowUpload,
  usePendingSlideshowUploads,
} from "@/lib/pending-slideshow-uploads";
import {
  isPendingProfileVideoId,
  pendingUploadToProfileVideo,
  retryPendingVideoUpload,
  subscribePendingUploadPosted,
  usePendingVideoUploads,
} from "@/lib/pending-video-uploads";
import {
  getProBadgeKind,
  hasProFeatures,
  shouldShowProProgress,
} from "@/lib/pro-entitlements";
import { formatProfileLocationLabel } from "@/lib/location-filter";
import {
  feedItemToPreloadedProfile,
  getProfileVideoOwner,
  profileVideoToFeedVideo,
  sortProfileVideos,
} from "@/lib/profile-mappers";
import {
  subscribeJamRelationship,
  withJamRelationship,
} from "@/lib/jam-relationship-sync";
import {
  PROFILE_VIDEO_PIN_REORDER_ANIMATION,
  filterOutLocallyDeletedVideos,
  pruneLocallyDeletedProfileVideoIds,
} from "@/lib/profile-video-delete-cache";
import { deleteOwnProfileVideo } from "@/lib/delete-own-profile-video";
import type { SavedVideoController, ThemeMode } from "@/types/app";
import { viewportWidth } from "@/theme/tokens";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import { FeedReportModal } from "@/components/discover/feed-report-modal";
import { DmModal } from "@/components/chat/dm-modal";
import { UserProfileModal } from "@/components/profile/user-profile-modal";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { SettingsDrawerModal } from "@/components/profile/settings-drawer-modal";
import {
  ProfileNameAnchor,
  ProfileTopScrollFade,
  type ProfileScrollFadeHandle,
} from "@/components/profile/profile-scroll-fade";
import { ProfileVideoFullscreenModal } from "@/components/profile/profile-video-fullscreen-modal";
import { VideoGrid } from "@/components/profile/video-grid";
import { openProfileVideoFullscreen } from "@/components/video/jam-video-view";
import { ExpandableAvatar } from "@/components/ui/expandable-avatar";
import { EmptyCard } from "@/components/ui/empty-card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { ProBadge, ProProgressBar } from "@/components/ui/badges";
import { MenuIcon } from "@/components/icons/menu-icon";
import { TabLogoHeader } from "@/components/ui/tab-logo-header";
import { getTabScreenContentStyle } from "@/components/ui/tab-screen-content-style";

function ProfileLibraryTabs({
  active,
  onChange,
}: {
  active: "videos" | "saved";
  onChange: (tab: "videos" | "saved") => void;
}) {
  return (
    <View style={styles.profileLibraryTabs}>
      <Pressable
        onPress={() => onChange("videos")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: active === "videos" }}
      >
        <Text style={[styles.profileLibraryTabText, active === "videos" && styles.profileLibraryTabTextActive]}>
          videos
        </Text>
      </Pressable>
      <View style={styles.profileLibraryTabDivider} />
      <Pressable
        onPress={() => onChange("saved")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: active === "saved" }}
      >
        <Text style={[styles.profileLibraryTabText, active === "saved" && styles.profileLibraryTabTextActive]}>
          saved
        </Text>
      </Pressable>
    </View>
  );
}

function ProfileGridLoadingPlaceholder() {
  // Frosted cell shells — same silhouette as the real grid, never a black block.
  return (
    <View style={styles.grid} accessibilityLabel="loading videos">
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.gridItem}>
          <View style={styles.gridThumbPlaceholder} />
          <View style={styles.gridThumbLoadingBlur} />
        </View>
      ))}
    </View>
  );
}

function prepareProfileGridPinReorderAnimation() {
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  LayoutAnimation.configureNext(PROFILE_VIDEO_PIN_REORDER_ANIMATION);
}

async function toggleOwnProfileVideoPin(
  userId: string,
  video: ProfileVideo | FeedVideo,
  setVideos: (updater: (current: ProfileVideo[]) => ProfileVideo[]) => void,
  pendingPinRanks?: MutableRefObject<Map<string, number | null>>,
) {
  if (isPendingProfileVideoId(video.id)) return;

  const currentlyPinned = getProfileVideoPinnedRank(video as ProfileVideo) != null;
  let previousVideos: ProfileVideo[] = [];
  let optimisticRank: number | null = null;
  let didOptimisticReorder = false;

  // Keep fetch order in state; displayVideos sorts. Pending ranks stay until a
  // profile reload sees the matching server value — clearing them on API success
  // let focus refreshes flash the thumb back to its old slot.

  prepareProfileGridPinReorderAnimation();
  setVideos((current) => {
    previousVideos = current;
    if (currentlyPinned) {
      pendingPinRanks?.current.set(video.id, null);
      didOptimisticReorder = true;
      return current.map((entry) =>
        entry.id === video.id
          ? { ...entry, pinnedRank: null, pinned_rank: null }
          : entry,
      );
    }

    const pinnedCount = current.filter((entry) => getProfileVideoPinnedRank(entry) != null).length;
    if (pinnedCount >= MAX_PINNED_PROFILE_VIDEOS) {
      return current;
    }

    const used = new Set(
      current
        .map((entry) => getProfileVideoPinnedRank(entry))
        .filter((rank): rank is number => rank != null),
    );
    optimisticRank = 1;
    while (used.has(optimisticRank) && optimisticRank <= MAX_PINNED_PROFILE_VIDEOS) {
      optimisticRank += 1;
    }

    pendingPinRanks?.current.set(video.id, optimisticRank);
    didOptimisticReorder = true;
    return current.map((entry) =>
      entry.id === video.id
        ? { ...entry, pinnedRank: optimisticRank, pinned_rank: optimisticRank }
        : entry,
    );
  });

  if (!currentlyPinned) {
    const pinnedCount = previousVideos.filter(
      (entry) => getProfileVideoPinnedRank(entry) != null,
    ).length;
    if (pinnedCount >= MAX_PINNED_PROFILE_VIDEOS) {
      pendingPinRanks?.current.delete(video.id);
      Alert.alert("pin limit", `you can pin up to ${MAX_PINNED_PROFILE_VIDEOS} videos`);
      return;
    }
  }

  if (!didOptimisticReorder) return;

  try {
    if (currentlyPinned) {
      await unpinProfileVideo(userId, video.id);
      // Keep pending null until load() confirms the server cleared the pin.
      return;
    }

    const rank = await pinProfileVideo(userId, video.id);
    pendingPinRanks?.current.set(video.id, rank);
    prepareProfileGridPinReorderAnimation();
    setVideos((current) => {
      const existing = getProfileVideoPinnedRank(
        current.find((entry) => entry.id === video.id),
      );
      if (existing === rank) return current;
      return current.map((entry) =>
        entry.id === video.id
          ? { ...entry, pinnedRank: rank, pinned_rank: rank }
          : entry,
      );
    });
  } catch (err) {
    pendingPinRanks?.current.delete(video.id);
    prepareProfileGridPinReorderAnimation();
    setVideos(() => previousVideos);
    Alert.alert(
      currentlyPinned ? "could not unpin" : "could not pin",
      err instanceof Error ? err.message : "try again",
    );
  }
}

async function toggleSavedProfileVideo(
  video: ProfileVideo | FeedVideo,
  nextSaved: boolean,
  setSaved: (updater: (current: ProfileVideo[]) => ProfileVideo[]) => void,
  setVideoSaved: (videoId: string, nextSaved: boolean) => Promise<boolean>,
) {
  const profileVideo = video as ProfileVideo;

  if (nextSaved) {
    setSaved((current) =>
      current.some((entry) => entry.id === video.id) ? current : [profileVideo, ...current],
    );
  } else {
    setSaved((current) => current.filter((entry) => entry.id !== video.id));
  }

  const saved = await setVideoSaved(video.id, nextSaved);
  if (!saved) {
    if (nextSaved) {
      setSaved((current) => current.filter((entry) => entry.id !== video.id));
    } else {
      setSaved((current) =>
        current.some((entry) => entry.id === video.id) ? current : [profileVideo, ...current],
      );
    }
  }
}

export function MyProfileScreen({
  userId,
  themeMode,
  onThemeModeChange,
  refreshSignal,
  savedVideoController,
  initialProfile = null,
  onInboxChanged,
  onProfileChanged,
  onLoggedOut,
}: {
  userId: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  /** Cached profile from app shell so the header can paint before videos load. */
  initialProfile?: Profile | null;
  onInboxChanged: () => void;
  onProfileChanged: (profile: Profile) => void;
  onLoggedOut: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [saved, setSaved] = useState<ProfileVideo[]>([]);
  const [activeTab, setActiveTab] = useState<"videos" | "saved">("videos");
  const [tabSlide] = useState(() => new Animated.Value(0));
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [ownFullscreenIndex, setOwnFullscreenIndex] = useState<number | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileHeaderCollapsed, setProfileHeaderCollapsed] = useState(false);
  const [reportItem, setReportItem] = useState<FeedVideo | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [videosLoading, setVideosLoading] = useState(true);
  const [pinPreviewActive, setPinPreviewActive] = useState(false);
  const hasLoadedVideosRef = useRef(false);
  /** Local pin ranks that must win over in-flight profile reloads. */
  const pendingPinRanksRef = useRef(new Map<string, number | null>());
  const profileScrollRef = useRef<ProfileScrollFadeHandle>(null);
  const insets = useSafeAreaInsets();
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;
  const pendingUploads = usePendingVideoUploads();
  const pendingSlideshowUploads = usePendingSlideshowUploads();
  const pendingProfileVideos = useMemo(
    () => [
      ...pendingUploads
        .filter((upload) => upload.userId === userId)
        .map(pendingUploadToProfileVideo),
      ...pendingSlideshowUploads
        .filter((upload) => upload.userId === userId)
        .map(pendingSlideshowToProfileVideo),
    ],
    [pendingSlideshowUploads, pendingUploads, userId],
  );
  const displayVideos = useMemo(
    () =>
      filterOutLocallyDeletedVideos([
        ...pendingProfileVideos,
        ...sortProfileVideos(videos),
      ]),
    [pendingProfileVideos, videos],
  );
  const sortedOwnVideos = useMemo(() => sortProfileVideos(videos), [videos]);
  const visibleProfile = profile ?? initialProfile;

  useEffect(() => {
    if (!initialProfile) return;
    setProfile((current) => current ?? initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    return subscribeJamRelationship((state) => {
      setSaved((current) =>
        current.map((entry) =>
          entry.userId === state.userId ? withJamRelationship(entry, state) : entry,
        ),
      );
      setActiveDm((current) =>
        current?.userId === state.userId ? withJamRelationship(current, state) : current,
      );
    });
  }, []);

  const load = useCallback(async () => {
    // Only show grid placeholders on the first fetch — later focus refreshes keep the grid.
    if (!hasLoadedVideosRef.current) setVideosLoading(true);
    // Paint/refresh the header as soon as profile returns — don't wait on videos.
    const profilePromise = fetchProfile(userId).then((nextProfile) => {
      setProfile(nextProfile);
      if (nextProfile) onProfileChanged(nextProfile);
      return nextProfile;
    });
    try {
      const [, ownVideos, savedVideos] = await Promise.all([
        profilePromise,
        fetchMyVideos(userId),
        fetchSavedVideos(userId),
        refreshSavedVideos(),
      ]);
      pruneLocallyDeletedProfileVideoIds(ownVideos);
      setVideos((current) => {
        const next = filterOutLocallyDeletedVideos(ownVideos).map((video) => {
          if (!pendingPinRanksRef.current.has(video.id)) return video;
          const pendingRank = pendingPinRanksRef.current.get(video.id) ?? null;
          const serverRank = getProfileVideoPinnedRank(video);
          // Drop the pending override only once the server matches — clearing it
          // earlier lets an in-flight focus refresh flash the video back unpinned.
          if (serverRank === pendingRank) {
            pendingPinRanksRef.current.delete(video.id);
            return video;
          }
          return { ...video, pinnedRank: pendingRank, pinned_rank: pendingRank };
        });
        // Compare by id (not index) — pin reorder must not look like a full reload.
        if (current.length !== next.length) return next;
        const nextById = new Map(next.map((video) => [video.id, video]));
        const same = current.every((video) => {
          const other = nextById.get(video.id);
          if (!other) return false;
          const lookingFor =
            Boolean(video.lookingFor ?? ("looking_for" in video ? video.looking_for : false)) ===
            Boolean(other.lookingFor ?? ("looking_for" in other ? other.looking_for : false));
          const pinned =
            getProfileVideoPinnedRank(video) === getProfileVideoPinnedRank(other);
          return lookingFor && pinned;
        });
        return same ? current : next;
      });
      setSaved(savedVideos);
      hasLoadedVideosRef.current = true;
    } finally {
      setVideosLoading(false);
    }
  }, [onProfileChanged, refreshSavedVideos, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch(() => setVideosLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load, refreshSignal]);

  useEffect(() => {
    setSaved((current) => {
      if (current.length === 0) return current;
      const next = current.filter((video) => savedVideoIds.has(video.id));
      return next.length === current.length ? current : next;
    });
  }, [savedVideoIds]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Defer refresh until after the tab switch paints so navigation stays snappy.
      const timer = setTimeout(() => {
        void load().catch(() => {
          if (active) setVideosLoading(false);
        });
      }, 280);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [load]),
  );

  useEffect(() => {
    return subscribePendingUploadPosted((event) => {
      if (event.userId !== userId) return;
      void load();
    });
  }, [load, userId]);

  function openJamFromProfile(profileFeedItem: FeedVideo) {
    setProfileUserId(null);
    setActiveDm(profileFeedItem);
  }

  function changeProfileTab(nextTab: "videos" | "saved") {
    if (nextTab === activeTab) return;

    const toValue = nextTab === "saved" ? -viewportWidth : 0;
    tabSlide.stopAnimation();
    setActiveTab(nextTab);
    Animated.timing(tabSlide, {
      toValue,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function removeCreatorFromSaved(creatorUserId: string) {
    setSaved((current) => current.filter((entry) => entry.userId !== creatorUserId));
    setFullscreenIndex((current) => {
      if (current === null) return current;
      const nextSaved = saved.filter((entry) => entry.userId !== creatorUserId);
      return nextSaved.length === 0 ? null : Math.min(current, nextSaved.length - 1);
    });
    setProfileUserId((current) => (current === creatorUserId ? null : current));
    setActiveDm((current) => (current?.userId === creatorUserId ? null : current));
  }

  function hideSavedCreator(item: FeedVideo) {
    removeCreatorFromSaved(item.userId);
    void hideCreator(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not hide creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function blockSavedCreator(item: FeedVideo) {
    removeCreatorFromSaved(item.userId);
    void blockUser(userId, item.userId)
      .then(() => refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not block creator", err instanceof Error ? err.message : "try again");
        void load().catch(() => undefined);
      });
  }

  function submitSavedReport(item: FeedVideo, reason: ReportReason) {
    if (reportSubmitting) return;

    setReportSubmitting(true);
    void reportVideo({
      reporterId: userId,
      reportedUserId: item.userId,
      videoId: item.id,
      reason,
    })
      .then(() => {
        setReportItem(null);
        setFullscreenIndex(null);
      })
      .catch((err) => {
        Alert.alert("could not submit report", err instanceof Error ? err.message : "try again");
      })
      .finally(() => setReportSubmitting(false));
  }

  // Only block the whole tab when we have nothing to paint for the header yet.
  if (!visibleProfile && videosLoading) {
    return <LoadingScreen label="loading profile..." />;
  }

  const postedVideoCount = Math.max(videos.length, visibleProfile?.video_count ?? 0);
  const proEntitlement = {
    earlyAdopter: visibleProfile?.early_adopter,
    videoCount: postedVideoCount,
    proSubscriptionActive: visibleProfile?.pro_subscription_active,
  };
  const proBadge = getProBadgeKind(proEntitlement);
  const hasPro = hasProFeatures(proEntitlement);
  const showProProgress = Boolean(visibleProfile) && shouldShowProProgress(proEntitlement);
  const showVideosGridLoading = videosLoading && displayVideos.length === 0;
  const showSavedGridLoading = videosLoading && saved.length === 0;

  const settingsButton = (
    <Pressable
      style={styles.headerIconButton}
      onPressIn={() => {
        // Open on press-in so the drawer mounts immediately; waiting for press-out
        // made the slide-in feel flaky when the finger lingered or scrolled slightly.
        if (!settingsOpen) setSettingsOpen(true);
      }}
      accessibilityLabel="settings"
      accessibilityRole="button"
    >
      <MenuIcon color={getActivityIndicatorColor()} />
    </Pressable>
  );

  return (
    <View style={styles.safeWithNav}>
      <ProfileTopScrollFade
        ref={profileScrollRef}
        topInset={insets.top}
        contentContainerStyle={getTabScreenContentStyle(insets.top)}
        scrollEnabled={!pinPreviewActive}
        onCollapseChange={setProfileHeaderCollapsed}
        collapsedHeader={
          visibleProfile
            ? {
                title: visibleProfile.display_name ?? "your profile",
                right: settingsButton,
              }
            : undefined
        }
      >
        <TabLogoHeader
          center={
            showProProgress && !profileHeaderCollapsed ? (
              <ProProgressBar posted={postedVideoCount} />
            ) : null
          }
          right={profileHeaderCollapsed ? <View style={styles.headerSpacer} /> : settingsButton}
        />
        {visibleProfile ? (
          <>
            <View style={styles.profileCentered}>
              <ExpandableAvatar uri={visibleProfile.avatar_url} size={78} />
              <ProfileNameAnchor>
                <View style={styles.centerRow}>
                  <Text style={styles.h2}>{visibleProfile.display_name ?? "your profile"}</Text>
                  {proBadge ? <ProBadge kind={proBadge} /> : null}
                </View>
              </ProfileNameAnchor>
              <Text style={styles.subtitle}>{visibleProfile.creator_types?.join(", ") || "creator"}</Text>
              {formatProfileLocationLabel(visibleProfile) ? (
                <Text style={styles.subtitle}>{formatProfileLocationLabel(visibleProfile)}</Text>
              ) : null}
              <Text style={styles.profileBio}>{visibleProfile.bio || "no bio yet."}</Text>
            </View>
            <Pressable style={styles.profileActionPill} onPress={() => setEditing(true)}>
              <Text style={styles.profileActionPillText}>edit profile</Text>
            </Pressable>
          </>
        ) : (
          <EmptyCard text="no profile found." />
        )}
        <View style={styles.profileVideoDivider} />
        <ProfileLibraryTabs
          active={activeTab}
          onChange={(value) => changeProfileTab(value)}
        />
        <View style={styles.profileTabSliderViewport}>
          <Animated.View
            style={[
              styles.profileTabSliderTrack,
              {
                width: viewportWidth * 2,
                transform: [{ translateX: tabSlide }],
              },
            ]}
          >
            <View style={styles.profileTabPane}>
              {showVideosGridLoading ? (
                <ProfileGridLoadingPlaceholder />
              ) : (
                <VideoGrid
                  videos={displayVideos}
                  showPendingUploadState
                  prewarmVisibleVideos={activeTab === "videos"}
                  allowPinning
                  onRetryPendingUpload={(uploadId) => {
                    if (uploadId.startsWith("ss-")) {
                      retryPendingSlideshowUpload(uploadId);
                      return;
                    }
                    retryPendingVideoUpload(uploadId);
                  }}
                  onPinPreviewChange={setPinPreviewActive}
                  ensurePinItemVisible={(rect) =>
                    profileScrollRef.current?.ensureWindowRectVisible(rect) ?? Promise.resolve()
                  }
                  onTogglePin={(video) => {
                    void toggleOwnProfileVideoPin(userId, video, setVideos, pendingPinRanksRef);
                  }}
                  onVideoPress={(video, index) => {
                    if (isPendingProfileVideoId(video.id)) return;
                    const realIndex = sortedOwnVideos.findIndex((entry) => entry.id === video.id);
                    if (realIndex < 0) return;
                    openProfileVideoFullscreen(video, () => setOwnFullscreenIndex(realIndex));
                  }}
                />
              )}
            </View>
            <View style={styles.profileTabPane}>
              {showSavedGridLoading ? (
                <ProfileGridLoadingPlaceholder />
              ) : (
                <VideoGrid
                  videos={saved}
                  privateCopy
                  prewarmVisibleVideos={activeTab === "saved"}
                  onVideoPress={(video, index) => {
                    openProfileVideoFullscreen(video, () => setFullscreenIndex(index));
                  }}
                />
              )}
            </View>
          </Animated.View>
        </View>
      </ProfileTopScrollFade>
      {profile && (
        <ProfileVideoFullscreenModal
          visible={ownFullscreenIndex !== null}
          videos={sortedOwnVideos}
          initialIndex={ownFullscreenIndex ?? 0}
          owner={{
            creatorName: profile.display_name ?? "you",
            role: profile.creator_types?.[0] ?? "creator",
            location: formatProfileLocationLabel(profile) ?? "unknown",
            avatarUrl: profile.avatar_url,
            earlyAdopter: Boolean(profile.early_adopter),
            proBadge,
          }}
          saved={false}
          onClose={() => setOwnFullscreenIndex(null)}
          onSave={() => undefined}
          onMessage={() => undefined}
          ownVideoActions={{
            userId,
            insightsLocked: !hasPro,
            onDelete: (video) => {
              Alert.alert("delete video?", "this removes it from your profile.", [
                { text: "cancel", style: "cancel" },
                {
                  text: "delete",
                  style: "destructive",
                  onPress: () => {
                    void deleteOwnProfileVideo(video.id, setVideos, setOwnFullscreenIndex);
                  },
                },
              ]);
            },
            onEdited: (updated) => {
              setVideos((current) =>
                current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
              );
            },
            onShared: () => onInboxChanged(),
            onInsights: () => {
              Alert.alert(
                hasPro ? "insights" : "insights · pro",
                hasPro
                  ? "video insights are coming soon."
                  : "unlock jam. pro to see views, saves, and more for your posts.",
              );
            },
          }}
        />
      )}
      <ProfileVideoFullscreenModal
        visible={fullscreenIndex !== null}
        videos={saved}
        initialIndex={fullscreenIndex ?? 0}
        owner={{
          creatorName: "saved",
          role: "creator",
          location: "unknown",
          avatarUrl: null,
          earlyAdopter: false,
          proBadge: null,
        }}
        saved
        getOwnerForVideo={getProfileVideoOwner}
        getSavedForVideo={(video) => savedVideoIds.has(video.id)}
        onClose={() => {
          // Back / dismiss: close inline profile first, then the video.
          if (profileUserId) {
            setProfileUserId(null);
            return;
          }
          setFullscreenIndex(null);
        }}
        onSave={(video, nextSaved) => {
          void toggleSavedProfileVideo(video, nextSaved, setSaved, setVideoSaved);
        }}
        onOpenProfile={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          const creatorId = feedItem?.userId;
          if (!creatorId || creatorId === userId) return;
          // Keep the video mounted underneath — profile slides in as an inline overlay.
          setProfileUserId(creatorId);
        }}
        onMessage={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (!feedItem) return;
          setProfileUserId(null);
          setFullscreenIndex(null);
          void openJamFromProfile(feedItem);
        }}
        onNotInterested={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (feedItem) hideSavedCreator(feedItem);
        }}
        onBlock={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (feedItem) blockSavedCreator(feedItem);
        }}
        onReport={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (feedItem) setReportItem(feedItem);
        }}
        onSendMessage={async (video, body) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (!feedItem) return;
          await sendJamRequest(feedItem.userId, body, video.id);
          setSaved((current) =>
            current.map((entry) =>
              entry.id === video.id
                ? {
                    ...entry,
                    jammedByMe: true,
                    mutual: Boolean(feedItem.jammedMe),
                  }
                : entry,
            ),
          );
          onInboxChanged();
        }}
        profileOverlay={
          fullscreenIndex !== null && profileUserId ? (
            <UserProfileModal
              currentUserId={userId}
              userId={profileUserId}
              preloadedProfile={(() => {
                const seed = saved
                  .map((entry) => profileVideoToFeedVideo(entry))
                  .filter((entry): entry is FeedVideo => Boolean(entry));
                const item = seed.find((entry) => entry.userId === profileUserId);
                return item ? feedItemToPreloadedProfile(item, seed) : null;
              })()}
              savedVideoController={savedVideoController}
              inline
              onClose={() => setProfileUserId(null)}
              onMessage={(profileFeedItem) => {
                setProfileUserId(null);
                setFullscreenIndex(null);
                void openJamFromProfile(profileFeedItem);
              }}
              onInboxChanged={onInboxChanged}
              onUnjammed={(removedUserId) => {
                setProfileUserId(null);
                setActiveDm((current) => (current?.userId === removedUserId ? null : current));
                onInboxChanged();
              }}
              onBlocked={(blockedUserId) => {
                removeCreatorFromSaved(blockedUserId);
                setProfileUserId(null);
                setFullscreenIndex(null);
                setActiveDm((current) => (current?.userId === blockedUserId ? null : current));
                onInboxChanged();
              }}
            />
          ) : null
        }
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          setActiveDm(null);
          setProfileUserId(item.userId);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          await sendJamRequest(activeDm.userId, body, activeDm.id);
          setActiveDm(null);
          onInboxChanged();
        }}
      />
      <UserProfileModal
        currentUserId={userId}
        // Saved fullscreen hosts its own inline profile overlay — don't stack a second Modal.
        userId={fullscreenIndex !== null ? null : profileUserId}
        savedVideoController={savedVideoController}
        onClose={() => setProfileUserId(null)}
        onMessage={(profileFeedItem) => {
          void openJamFromProfile(profileFeedItem);
        }}
        onUnjammed={(removedUserId) => {
          setActiveDm((current) => (current?.userId === removedUserId ? null : current));
          setProfileUserId(null);
          onInboxChanged();
        }}
        onBlocked={(blockedUserId) => {
          removeCreatorFromSaved(blockedUserId);
          setActiveDm((current) => (current?.userId === blockedUserId ? null : current));
          setProfileUserId(null);
          onInboxChanged();
        }}
      />
      <EditProfileModal
        visible={editing}
        profile={visibleProfile}
        onClose={() => setEditing(false)}
        onSaved={(nextProfile) => {
          setProfile(nextProfile);
          onProfileChanged(nextProfile);
          setEditing(false);
        }}
      />
      <SettingsDrawerModal
        visible={settingsOpen}
        currentUserId={userId}
        themeMode={themeMode}
        onThemeModeChange={onThemeModeChange}
        profile={profile}
        onClose={() => setSettingsOpen(false)}
        onProfileUpdated={(nextProfile) => {
          setProfile(nextProfile);
          onProfileChanged(nextProfile);
        }}
        onLoggedOut={onLoggedOut}
      />
      <FeedReportModal
        item={reportItem}
        submitting={reportSubmitting}
        onClose={() => setReportItem(null)}
        onSubmit={(reason) => {
          if (reportItem) submitSavedReport(reportItem, reason);
        }}
      />
    </View>
  );
}
