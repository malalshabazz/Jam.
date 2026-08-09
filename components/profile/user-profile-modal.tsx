import React, { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatModal } from "@/components/chat/chat-modal";
import { DmModal } from "@/components/chat/dm-modal";
import { FeedReportModal } from "@/components/discover/feed-report-modal";
import { BellIcon } from "@/components/icons/bell-icon";
import { Avatar } from "@/components/ui/avatar";
import { ProBadge, ProProgressBar } from "@/components/ui/badges";
import { EmptyCard } from "@/components/ui/empty-card";
import { ProfileJamButton } from "@/components/ui/profile-jam-button";
import { SwipeBackSurface } from "@/components/ui/swipe-back-surface";
import {
  ProfileNameAnchor,
  ProfileTopScrollFade,
} from "@/components/profile/profile-scroll-fade";
import { ProfileVideoFullscreenModal } from "@/components/profile/profile-video-fullscreen-modal";
import { VideoGrid } from "@/components/profile/video-grid";
import { openProfileVideoFullscreen } from "@/components/video/jam-video-view";
import {
  blockUser,
  deleteMessage,
  editMessage,
  fetchConversationMessages,
  fetchCreatorPostAlert,
  fetchCreatorProfile,
  fetchCreatorVideos,
  fetchInbox,
  fetchRelationshipState,
  hideCreator,
  removeJamConnection,
  reportVideo,
  sendJamRequest,
  sendMessage,
  setCreatorPostAlert,
  type ChatMessage,
  type Conversation,
  type FeedVideo,
  type Profile,
  type ProfileVideo,
  type ReportReason,
} from "@/lib/native-social-data";
import { subscribeJamRelationship } from "@/lib/jam-relationship-sync";
import {
  getProBadgeKind,
  shouldShowProProgress,
} from "@/lib/pro-entitlements";
import {
  conversationFromFeedItem,
  conversationFromRequest,
  profileToFeedVideo,
  profileVideoToFeedVideo,
  sortProfileVideos,
} from "@/lib/profile-mappers";
import type { PreloadedUserProfile, SavedVideoController } from "@/types/app";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import {
  NOTIFY_POPOVER_WIDTH,
  UNJAM_POPOVER_WIDTH,
  viewportWidth,
} from "@/theme/tokens";

export function UserProfileModal({
  currentUserId,
  userId,
  preloadedProfile,
  savedVideoController,
  onClose,
  onMessage,
  onInboxChanged,
  onUnjammed,
  onBlocked,
  onJamSent,
  inline,
}: {
  currentUserId: string;
  userId: string | null;
  preloadedProfile?: PreloadedUserProfile | null;
  savedVideoController: SavedVideoController;
  onClose: () => void;
  onMessage: (item: FeedVideo) => void;
  onInboxChanged?: () => void;
  onUnjammed?: (userId: string) => void;
  onBlocked?: (userId: string) => void;
  onJamSent?: (userId: string) => void;
  inline?: boolean;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jammedByMe, setJammedByMe] = useState(false);
  const [jammedMe, setJammedMe] = useState(false);
  const [relationshipOverride, setRelationshipOverride] = useState<{
    userId: string;
    jammedByMe: boolean;
    jammedMe: boolean;
  } | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unjamConfirm, setUnjamConfirm] = useState<{
    kind: "cancel" | "unjam";
    anchor: { x: number; y: number };
  } | null>(null);
  const [notifyConfirmAnchor, setNotifyConfirmAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const menuUnjamItemRef = useRef<View>(null);
  const notifyHeaderButtonRef = useRef<View>(null);
  const notifyCollapsedButtonRef = useRef<View>(null);
  const [profileHeaderCollapsed, setProfileHeaderCollapsed] = useState(false);
  const profileLockScrollSyncRef = useRef<(() => void) | null>(null);
  const [notifyOnPost, setNotifyOnPost] = useState(false);
  const [notifyScale] = useState(() => new Animated.Value(1));
  const notifyRequestIdRef = useRef(0);
  const [reportItem, setReportItem] = useState<FeedVideo | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [jamComposeItem, setJamComposeItem] = useState<FeedVideo | null>(null);
  const [profileChat, setProfileChat] = useState<Conversation | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (profileHeaderCollapsed) {
      setMenuOpen(false);
      setNotifyConfirmAnchor(null);
    }
  }, [profileHeaderCollapsed]);

  useEffect(() => {
    setMenuOpen(false);
    setNotifyConfirmAnchor(null);
    setJamComposeItem(null);
    setProfileChat(null);
    setNotifyOnPost(false);
    setRelationshipOverride(null);
    notifyScale.setValue(1);
    notifyRequestIdRef.current += 1;

    // Seed from preload for instant UI; DB refresh below is source of truth.
    // Only re-seed on userId change — not when parent recreates the preload object.
    if (preloadedProfile?.userId === userId) {
      setJammedByMe(preloadedProfile.jammedByMe);
      setJammedMe(preloadedProfile.jammedMe);
    } else {
      setJammedByMe(false);
      setJammedMe(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: navigate/seed on userId only
  }, [userId, notifyScale]);

  useEffect(() => {
    if (!userId || !currentUserId || userId === currentUserId) return;

    let active = true;
    const requestId = ++notifyRequestIdRef.current;

    void fetchCreatorPostAlert(currentUserId, userId)
      .then((enabled) => {
        if (!active || requestId !== notifyRequestIdRef.current) return;
        setNotifyOnPost(enabled);
      })
      .catch(() => {
        // Keep the bell off if the preference cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, [currentUserId, userId]);

  // Always read jam/connection state fresh from the DB when a profile opens —
  // preloaded feed items can be stale after jamming via message bar / DM / chat.
  useEffect(() => {
    if (!userId || !currentUserId || userId === currentUserId) return;

    let active = true;
    void fetchRelationshipState(currentUserId, userId)
      .then((relationship) => {
        if (!active) return;
        setJammedByMe(relationship.jammedByMe);
        setJammedMe(relationship.jammedMe);
      })
      .catch(() => {
        // Keep seeded/local relationship if the refresh fails.
      });

    return () => {
      active = false;
    };
  }, [currentUserId, userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeJamRelationship((state) => {
      if (state.userId !== userId) return;
      setJammedByMe(state.jammedByMe);
      setJammedMe(state.jammedMe);
      setRelationshipOverride({
        userId: state.userId,
        jammedByMe: state.jammedByMe,
        jammedMe: state.jammedMe,
      });
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (preloadedProfile?.userId === userId) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void Promise.all([
        fetchCreatorProfile(currentUserId, userId),
        fetchCreatorVideos(currentUserId, userId),
        fetchRelationshipState(currentUserId, userId),
      ])
        .then(([nextProfile, nextVideos, relationship]) => {
          if (!active) return;
          setProfile(nextProfile);
          setVideos(nextVideos);
          setJammedByMe(relationship.jammedByMe);
          setJammedMe(relationship.jammedMe);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "could not load profile");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentUserId, preloadedProfile, userId]);

  if (!userId) return null;

  const preloadedMatches = preloadedProfile?.userId === userId;
  const visibleProfile = preloadedMatches ? preloadedProfile.profile : profile;
  const visibleVideos = sortProfileVideos(
    preloadedMatches ? preloadedProfile.videos : videos,
  );
  const { savedVideoIds, setVideoSaved } = savedVideoController;
  const activeRelationshipOverride =
    relationshipOverride?.userId === userId ? relationshipOverride : null;
  // Prefer live/DB-backed local state over stale preloaded feed relationship flags.
  const visibleJammedByMe = activeRelationshipOverride?.jammedByMe ?? jammedByMe;
  const visibleJammedMe = activeRelationshipOverride?.jammedMe ?? jammedMe;
  const visibleLoading = preloadedMatches ? false : loading;
  const visibleError = preloadedMatches ? null : error;
  const displayName = visibleProfile?.display_name ?? "creator";
  const postedVideoCount = Math.max(visibleVideos.length, visibleProfile?.video_count ?? 0);
  const proEntitlement = {
    earlyAdopter: visibleProfile?.early_adopter,
    videoCount: postedVideoCount,
    proSubscriptionActive: visibleProfile?.pro_subscription_active,
  };
  const proBadge = getProBadgeKind(proEntitlement);
  const showProProgress =
    currentUserId === userId && shouldShowProProgress(proEntitlement);
  const canUnjam = visibleJammedByMe;
  const isOwnProfile = currentUserId === userId;
  const profileUnlocked = isOwnProfile || (visibleJammedByMe && visibleJammedMe);
  const visibleFeedVideos = visibleProfile
    ? visibleVideos.map((video) =>
        profileToFeedVideo(
          visibleProfile,
          video,
          savedVideoIds.has(video.id),
          visibleJammedByMe,
          visibleJammedMe,
          postedVideoCount,
        ),
      )
    : [];
  const profileFeedItem = visibleProfile
    ? visibleFeedVideos[0] ??
      profileToFeedVideo(
        visibleProfile,
        undefined,
        false,
        visibleJammedByMe,
        visibleJammedMe,
        postedVideoCount,
      )
    : null;

  function confirmUnjam(kind: "cancel" | "unjam", anchor: { x: number; y: number }) {
    if (!userId) return;

    setMenuOpen(false);
    setNotifyConfirmAnchor(null);
    setUnjamConfirm({ kind, anchor });
  }

  function performUnjam() {
    if (!userId) return;

    setUnjamConfirm(null);
    void removeJamConnection(userId)
      .then(() => {
        setJammedByMe(false);
        setJammedMe(false);
        setRelationshipOverride({ userId, jammedByMe: false, jammedMe: false });
        setProfileChat(null);
        onUnjammed?.(userId);
        onInboxChanged?.();
      })
      .catch((err) => {
        Alert.alert("could not unjam", err instanceof Error ? err.message : "try again");
      });
  }

  async function openExistingProfileChat(item: FeedVideo) {
    const unlocked = Boolean(item.mutual);
    let nextChat = conversationFromFeedItem(item, unlocked);

    try {
      const inbox = await fetchInbox(currentUserId);
      nextChat =
        inbox.conversations.find((conversation) => conversation.userId === item.userId) ??
        inbox.sent.find((conversation) => conversation.userId === item.userId) ??
        inbox.requests
          .filter((request) => request.userId === item.userId)
          .map(conversationFromRequest)
          .at(0) ??
        nextChat;
    } catch {
      // Keep the local conversation shell.
    }

    setProfileChat(nextChat);
    void fetchConversationMessages(currentUserId, item.userId)
      .then((page) => {
        setProfileChat((current) => {
          if (!current || current.userId !== item.userId) return current;
          return {
            ...current,
            messages: page.messages.length > 0 ? page.messages : current.messages,
            hasMoreMessages: Boolean(page.nextCursor),
            olderMessagesCursor: page.nextCursor,
          };
        });
      })
      .catch(() => undefined);
  }

  function hideProfileCreator(item: FeedVideo) {
    setFullscreenIndex(null);
    onClose();
    void hideCreator(currentUserId, item.userId)
      .then(() => savedVideoController.refreshSavedVideos())
      .catch((err) => {
        Alert.alert("could not hide creator", err instanceof Error ? err.message : "try again");
      });
  }

  function blockProfileCreator(item: FeedVideo) {
    setFullscreenIndex(null);
    onClose();
    void blockUser(currentUserId, item.userId)
      .then(() => {
        onBlocked?.(item.userId);
        onUnjammed?.(item.userId);
        onInboxChanged?.();
        return savedVideoController.refreshSavedVideos();
      })
      .catch((err) => {
        Alert.alert("could not block creator", err instanceof Error ? err.message : "try again");
      });
  }

  function submitProfileReport(item: FeedVideo, reason: ReportReason) {
    if (reportSubmitting) return;

    setReportSubmitting(true);
    void reportVideo({
      reporterId: currentUserId,
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

  function runNotifyAnimation() {
    notifyScale.setValue(1);
    Animated.sequence([
      Animated.timing(notifyScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(notifyScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function applyNotifyOnPost(enabled: boolean) {
    if (!userId || userId === currentUserId) return;

    const requestId = ++notifyRequestIdRef.current;
    setNotifyOnPost(enabled);
    if (enabled) runNotifyAnimation();

    void setCreatorPostAlert(currentUserId, userId, enabled).catch((err) => {
      if (requestId !== notifyRequestIdRef.current) return;
      setNotifyOnPost(!enabled);
      Alert.alert(
        enabled ? "could not turn on alerts" : "could not turn off alerts",
        err instanceof Error ? err.message : "try again",
      );
    });
  }

  function pressNotifyOnPost(anchorRef: RefObject<View | null>) {
    if (!userId || userId === currentUserId) return;

    if (notifyOnPost) {
      setNotifyConfirmAnchor(null);
      applyNotifyOnPost(false);
      return;
    }

    setMenuOpen(false);
    setUnjamConfirm(null);
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setNotifyConfirmAnchor({ x: x + width / 2, y: y + height });
    });
  }

  function renderProfileNotifyButton(anchorRef: RefObject<View | null>) {
    return (
      <View ref={anchorRef} collapsable={false} style={styles.profileMenuAnchor}>
        <Pressable
          style={styles.headerIconButton}
          onPress={() => pressNotifyOnPost(anchorRef)}
          accessibilityRole="button"
          accessibilityLabel={
            notifyOnPost
              ? `Stop notifications when ${displayName} posts`
              : `Notify me when ${displayName} posts`
          }
          accessibilityState={{ selected: notifyOnPost }}
        >
          <Animated.View style={{ transform: [{ scale: notifyScale }] }}>
            <BellIcon filled={notifyOnPost} />
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  const profileOptionsButton = (
    <View style={styles.profileMenuAnchor}>
      <Pressable
        style={styles.headerIconButton}
        onPress={() => {
          setNotifyConfirmAnchor(null);
          setMenuOpen((current) => !current);
        }}
        accessibilityLabel="profile options"
      >
        <Text style={styles.iconText}>⋯</Text>
      </Pressable>
    </View>
  );

  const profileScreen = (
    <SwipeBackSurface
      resetKey={userId}
      onBack={() => {
        setMenuOpen(false);
        onClose();
      }}
      style={styles.flex}
      enterFromRight
    >
      <View style={styles.safe}>
          <ProfileTopScrollFade
            topInset={insets.top}
            contentContainerStyle={[
              styles.screenContent,
              { paddingTop: insets.top + 4 },
            ]}
            collapsedHeader={
              visibleProfile
                ? {
                    title: displayName,
                    left: renderProfileNotifyButton(notifyCollapsedButtonRef),
                    right: profileOptionsButton,
                  }
                : undefined
            }
            onCollapseChange={setProfileHeaderCollapsed}
            onScroll={() => {
              profileLockScrollSyncRef.current?.();
            }}
            onScrollBeginDrag={() => {
              if (menuOpen) setMenuOpen(false);
              if (notifyConfirmAnchor) setNotifyConfirmAnchor(null);
            }}
          >
            <View style={styles.headerRow}>
              {profileHeaderCollapsed ? (
                <View style={styles.headerSpacer} />
              ) : (
                renderProfileNotifyButton(notifyHeaderButtonRef)
              )}
              <View style={styles.headerCenterSlot} pointerEvents="box-none">
                {showProProgress && !profileHeaderCollapsed ? (
                  <ProProgressBar posted={postedVideoCount} />
                ) : null}
              </View>
              {profileHeaderCollapsed ? <View style={styles.headerSpacer} /> : profileOptionsButton}
            </View>

            {visibleLoading ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
            ) : visibleProfile ? (
              <>
                <View style={styles.profileCentered}>
                  <Avatar uri={visibleProfile.avatar_url} size={78} />
                  <ProfileNameAnchor>
                    <View style={styles.centerRow}>
                      <Text style={styles.h2}>{displayName}</Text>
                      {proBadge ? <ProBadge kind={proBadge} /> : null}
                    </View>
                  </ProfileNameAnchor>
                  <Text style={styles.subtitle}>
                    {(visibleProfile.creator_types ?? []).join(", ") || "creator"}
                    {visibleProfile.location ? ` - ${visibleProfile.location}` : ""}
                  </Text>
                  <Text style={styles.profileBio}>{visibleProfile.bio || "no bio yet."}</Text>
                </View>
                <View>
                  <ProfileJamButton
                    label={
                      visibleJammedByMe && visibleJammedMe
                        ? "message"
                        : visibleJammedByMe
                          ? "request sent"
                          : "jam"
                    }
                    jamming={visibleJammedByMe && visibleJammedMe}
                    showCancel={visibleJammedByMe}
                    onCancelPress={(anchor) =>
                      confirmUnjam(visibleJammedByMe && visibleJammedMe ? "unjam" : "cancel", anchor)
                    }
                    onPress={() => {
                      if (!profileFeedItem) return;
                      setMenuOpen(false);
                      // Existing relationship → open chat over this profile (no feed flash).
                      if (visibleJammedByMe || visibleJammedMe) {
                        void openExistingProfileChat(profileFeedItem);
                        return;
                      }
                      setJamComposeItem(profileFeedItem);
                    }}
                  />
                </View>
                <View style={styles.profileVideoDivider} />
                <VideoGrid
                  videos={visibleFeedVideos}
                  locked={!profileUnlocked}
                  lockMessage={`you must be jamming with ${displayName} to see their full profile`}
                  lockScrollSyncRef={profileLockScrollSyncRef}
                  prewarmVisibleVideos
                  onVideoPress={(video, index) => {
                    setMenuOpen(false);
                    openProfileVideoFullscreen(video, () => setFullscreenIndex(index));
                  }}
                />
              </>
            ) : (
              <EmptyCard text={visibleError ?? "profile unavailable."} />
            )}
          </ProfileTopScrollFade>
          {menuOpen ? (
            <>
              <Pressable
                style={styles.profileMenuDismiss}
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="dismiss profile options"
              />
              <View style={[styles.profileMenu, { top: insets.top + 52, right: 18 }]}>
                {canUnjam ? (
                  <Pressable
                    ref={menuUnjamItemRef}
                    style={styles.profileMenuItem}
                    onPress={() => {
                      menuUnjamItemRef.current?.measureInWindow((x, y, width, height) => {
                        confirmUnjam(visibleJammedByMe && visibleJammedMe ? "unjam" : "cancel", {
                          x: x + width / 2,
                          y: y + height,
                        });
                      });
                    }}
                  >
                    <Text style={styles.profileMenuDangerText}>
                      {visibleJammedByMe && visibleJammedMe ? "Unjam" : "Cancel jam"}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.profileMenuItem}>
                    <Text style={styles.profileMenuMutedText}>more options soon</Text>
                  </View>
                )}
              </View>
            </>
          ) : null}
          {unjamConfirm ? (
            <Modal animationType="fade" transparent visible onRequestClose={() => setUnjamConfirm(null)}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setUnjamConfirm(null)}
                accessibilityLabel="dismiss"
              />
              <View
                style={[
                  styles.unjamPopover,
                  {
                    top: unjamConfirm.anchor.y + 8,
                    left: Math.min(
                      Math.max(unjamConfirm.anchor.x - UNJAM_POPOVER_WIDTH / 2, 12),
                      viewportWidth - UNJAM_POPOVER_WIDTH - 12,
                    ),
                  },
                ]}
              >
                <Text style={styles.unjamPopoverTitle}>
                  {unjamConfirm.kind === "cancel" ? "cancel jam?" : "unjam?"}
                </Text>
                <View style={styles.twoCol}>
                  <Pressable style={styles.confirmOption} onPress={() => setUnjamConfirm(null)}>
                    <Text style={styles.confirmOptionCancelText}>cancel</Text>
                  </Pressable>
                  <Pressable style={styles.confirmOption} onPress={performUnjam}>
                    <Text style={styles.confirmOptionDangerText}>confirm</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          ) : null}
          {notifyConfirmAnchor ? (
            <Modal
              animationType="fade"
              transparent
              visible
              onRequestClose={() => setNotifyConfirmAnchor(null)}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setNotifyConfirmAnchor(null)}
                accessibilityLabel="dismiss"
              />
              <View
                style={[
                  styles.notifyPopover,
                  {
                    top: notifyConfirmAnchor.y + 8,
                    left: Math.min(
                      Math.max(notifyConfirmAnchor.x - NOTIFY_POPOVER_WIDTH / 2, 12),
                      viewportWidth - NOTIFY_POPOVER_WIDTH - 12,
                    ),
                  },
                ]}
              >
                <Text style={styles.unjamPopoverTitle}>
                  get notified when {displayName} posts?
                </Text>
                <View style={styles.twoCol}>
                  <Pressable
                    style={styles.confirmOption}
                    onPress={() => setNotifyConfirmAnchor(null)}
                  >
                    <Text style={styles.confirmOptionCancelText}>cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmOption}
                    onPress={() => {
                      setNotifyConfirmAnchor(null);
                      applyNotifyOnPost(true);
                    }}
                  >
                    <Text style={styles.confirmOptionYesText}>yes</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          ) : null}
          <DmModal
            item={jamComposeItem}
            presentation="overlay"
            onClose={() => setJamComposeItem(null)}
            onOpenProfile={() => setJamComposeItem(null)}
            onSend={async (body) => {
              if (!jamComposeItem) return;
              const recipientUserId = jamComposeItem.userId;
              await sendJamRequest(recipientUserId, body, jamComposeItem.id);
              setJammedByMe(true);
              setRelationshipOverride({
                userId: recipientUserId,
                jammedByMe: true,
                jammedMe: visibleJammedMe,
              });
              setJamComposeItem(null);
              onJamSent?.(recipientUserId);
              onInboxChanged?.();
            }}
          />
          <ChatModal
            active={profileChat}
            currentUserId={currentUserId}
            savedVideoController={savedVideoController}
            presentation="overlay"
            onClose={() => setProfileChat(null)}
            onOpenProfile={() => setProfileChat(null)}
            onInboxChanged={onInboxChanged}
            onLoadOlderMessages={async (conversation) => {
              const page = await fetchConversationMessages(currentUserId, conversation.userId, {
                cursor: conversation.olderMessagesCursor ?? undefined,
              });
              setProfileChat((current) => {
                if (!current || current.userId !== conversation.userId) return current;
                const existingIds = new Set(current.messages.map((message) => message.id));
                const older = page.messages.filter((message) => !existingIds.has(message.id));
                return {
                  ...current,
                  messages: [...older, ...current.messages],
                  hasMoreMessages: Boolean(page.nextCursor),
                  olderMessagesCursor: page.nextCursor,
                };
              });
            }}
            onSend={async (conversation, body) => {
              const optimisticId = `local-${conversation.userId}-${Date.now()}`;
              const optimisticMessage: ChatMessage = {
                id: optimisticId,
                body,
                incoming: false,
                createdAt: new Date().toISOString(),
              };

              setProfileChat((current) => {
                if (!current || current.userId !== conversation.userId) return current;
                const unlocksFromReply =
                  !current.unlocked && current.messages.some((message) => message.incoming);
                return {
                  ...current,
                  unlocked: current.unlocked || unlocksFromReply,
                  lastMessage: body,
                  messages: [...current.messages, optimisticMessage],
                };
              });

              try {
                const savedMessage = conversation.unlocked
                  ? await sendMessage(conversation.userId, body)
                  : await sendJamRequest(conversation.userId, body);
                const unlocksFromReply =
                  !conversation.unlocked && conversation.messages.some((message) => message.incoming);

                setProfileChat((current) => {
                  if (!current || current.userId !== conversation.userId) return current;
                  return {
                    ...current,
                    unlocked: current.unlocked || unlocksFromReply,
                    messages: current.messages.map((message) =>
                      message.id === optimisticId
                        ? {
                            ...message,
                            id: savedMessage.id,
                            serverId: savedMessage.id,
                            createdAt: savedMessage.created_at,
                          }
                        : message,
                    ),
                  };
                });

                if (unlocksFromReply) {
                  setRelationshipOverride({
                    userId: conversation.userId,
                    jammedByMe: true,
                    jammedMe: true,
                  });
                  setJammedByMe(true);
                  setJammedMe(true);
                }

                onInboxChanged?.();
              } catch (err) {
                setProfileChat((current) => {
                  if (!current || current.userId !== conversation.userId) return current;
                  return {
                    ...current,
                    messages: current.messages.filter((message) => message.id !== optimisticId),
                  };
                });
                Alert.alert("could not send", err instanceof Error ? err.message : "try again");
              }
            }}
            onEditMessage={async (messageId, body) => {
              const updated = await editMessage(messageId, body);
              setProfileChat((current) => {
                if (!current) return current;
                return {
                  ...current,
                  messages: current.messages.map((message) =>
                    message.id === messageId || message.serverId === messageId
                      ? { ...message, body: updated.body }
                      : message,
                  ),
                  lastMessage:
                    current.messages.some(
                      (message) =>
                        (message.id === messageId || message.serverId === messageId) &&
                        message.body === current.lastMessage,
                    )
                      ? updated.body
                      : current.lastMessage,
                };
              });
            }}
            onDeleteMessage={async (messageId) => {
              await deleteMessage(messageId);
              setProfileChat((current) => {
                if (!current) return current;
                const nextMessages = current.messages.filter(
                  (message) => message.id !== messageId && message.serverId !== messageId,
                );
                return {
                  ...current,
                  messages: nextMessages,
                  lastMessage: nextMessages.at(-1)?.body ?? "",
                };
              });
              onInboxChanged?.();
            }}
          />
          {visibleProfile && (
            <ProfileVideoFullscreenModal
              visible={fullscreenIndex !== null}
              videos={profileUnlocked ? visibleFeedVideos : visibleFeedVideos.slice(0, 3)}
              initialIndex={fullscreenIndex ?? 0}
              owner={{
                creatorName: displayName,
                role: visibleProfile.creator_types?.[0] ?? "creator",
                location: visibleProfile.location ?? "unknown",
                avatarUrl: visibleProfile.avatar_url,
                earlyAdopter: Boolean(visibleProfile.early_adopter),
                proBadge,
              }}
              saved={Boolean(visibleFeedVideos[fullscreenIndex ?? 0]?.savedByMe)}
              presentation="overlay"
              onClose={() => setFullscreenIndex(null)}
              getSavedForVideo={(video) => savedVideoIds.has(video.id)}
              onSave={(video, nextSaved) => {
                void setVideoSaved(video.id, nextSaved);
              }}
              onMessage={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) {
                  setFullscreenIndex(null);
                  onMessage(feedItem);
                }
              }}
              onNotInterested={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) hideProfileCreator(feedItem);
              }}
              onBlock={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) blockProfileCreator(feedItem);
              }}
              onReport={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) setReportItem(feedItem);
              }}
              onSendMessage={async (video, body) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (!feedItem) return;
                await sendJamRequest(feedItem.userId, body, video.id);
                setJammedByMe(true);
                setRelationshipOverride({
                  userId: feedItem.userId,
                  jammedByMe: true,
                  jammedMe: Boolean(feedItem.jammedMe),
                });
                onJamSent?.(feedItem.userId);
                onInboxChanged?.();
              }}
            />
          )}
      </View>
    </SwipeBackSurface>
  );

  return (
    <>
      {inline ? (
        <View style={styles.profileStackOverlay}>{profileScreen}</View>
      ) : (
        <Modal animationType="none" transparent visible={Boolean(userId)} onRequestClose={onClose}>
          {profileScreen}
        </Modal>
      )}
      <FeedReportModal
        item={reportItem}
        submitting={reportSubmitting}
        onClose={() => setReportItem(null)}
        onSubmit={(reason) => {
          if (reportItem) submitProfileReport(reportItem, reason);
        }}
      />
    </>
  );
}
