import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setActiveInboxChatUserId } from "@/lib/active-inbox-chat";
import { Avatar } from "@/components/ui/avatar";
import { JamSystemAvatar } from "@/components/ui/jam-system-avatar";
import { SwipeBackSurface } from "@/components/ui/swipe-back-surface";
import { FeedReportModal } from "@/components/discover/feed-report-modal";
import { ProfileVideoFullscreenModal } from "@/components/profile/profile-video-fullscreen-modal";
import { deleteOwnProfileVideo } from "@/lib/delete-own-profile-video";
import { triggerHoldHaptic } from "@/lib/hold-haptic";
import {
  subscribeJamRelationship,
  withJamRelationship,
} from "@/lib/jam-relationship-sync";
import {
  formatProfileLocationLabel,
} from "@/lib/location-filter";
import {
  blockUser,
  fetchCreatorProfile,
  fetchCreatorVideos,
  fetchMyVideos,
  fetchProfile,
  fetchRelationshipState,
  hideCreator,
  reportVideo,
  sendJamRequest,
  type ChatMessage,
  type Conversation,
  type FeedVideo,
  type InboxMessage,
  type MessageVideoAttachment,
  type ProfileVideo,
  type ReportReason,
} from "@/lib/native-social-data";
import { getProBadgeKind, hasProFeatures, type ProBadgeKind } from "@/lib/pro-entitlements";
import {
  profileToFeedVideo,
  profileVideoToFeedVideo,
  sortProfileVideosByNewest,
} from "@/lib/profile-mappers";
import {
  getMessageVideoThumbnailSource,
  toMessageVideoAttachmentFromVideo,
} from "@/lib/video-thumbnails";
import type { SavedVideoController } from "@/types/app";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import { muted } from "@/theme/tokens";

export function ChatModal({
  active,
  currentUserId,
  savedVideoController,
  onClose,
  onOpenProfile,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onLoadOlderMessages,
  onInboxChanged,
  profileOverlay,
  presentation = "modal",
}: {
  active: Conversation | InboxMessage | null;
  currentUserId: string;
  savedVideoController: SavedVideoController;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onSend: (conversation: Conversation, body: string) => Promise<void>;
  onEditMessage: (messageId: string, body: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onLoadOlderMessages?: (conversation: Conversation) => Promise<void>;
  onInboxChanged?: () => void;
  profileOverlay?: React.ReactNode;
  presentation?: "modal" | "overlay";
}) {
  const [draft, setDraft] = useState("");
  const [contextMessageId, setContextMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [attachedViewer, setAttachedViewer] = useState<{
    isOwn: boolean;
    videos: Array<ProfileVideo | FeedVideo>;
    initialIndex: number;
    owner: {
      creatorName: string;
      role: string;
      location: string;
      avatarUrl: string | null;
      earlyAdopter: boolean;
      proBadge: ProBadgeKind | null;
    };
    jammedByMe: boolean;
    jammedMe: boolean;
  } | null>(null);
  const [attachedReportItem, setAttachedReportItem] = useState<FeedVideo | null>(null);
  const [attachedReportSubmitting, setAttachedReportSubmitting] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const messagesScrollRef = useRef<ScrollView>(null);
  const stickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const openingAttachedVideoRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;
  const conversationKey = active
    ? "sender_name" in active
      ? `system:${active.id}`
      : `user:${active.userId}`
    : null;
  const activeMessageIds = useMemo(() => {
    if (!active || "sender_name" in active) return new Set<string>();
    return new Set(
      active.messages.flatMap((message) =>
        [message.id, message.serverId].filter((value): value is string => Boolean(value)),
      ),
    );
  }, [active]);
  const pendingSessionMessages = useMemo(
    () =>
      sessionMessages.filter(
        (message) =>
          !activeMessageIds.has(message.id) &&
          !(message.serverId && activeMessageIds.has(message.serverId)),
      ),
    [activeMessageIds, sessionMessages],
  );
  const messageCount = active
    ? "sender_name" in active
      ? 1
      : active.messages.length + pendingSessionMessages.length
    : 0;

  const scrollMessagesToEnd = useCallback((animated = false) => {
    messagesScrollRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    if (!active) {
      setKeyboardHeight(0);
      return;
    }

    const applyKeyboardHeight = (nextHeight: number, duration: number) => {
      if (duration > 0) {
        LayoutAnimation.configureNext({
          duration,
          update: {
            duration,
            // iOS: system keyboard curve so the composer tracks the keyboard exactly.
            type:
              Platform.OS === "ios"
                ? LayoutAnimation.Types.keyboard
                : LayoutAnimation.Types.easeInEaseOut,
          },
        });
      }
      setKeyboardHeight(nextHeight);
    };

    if (Platform.OS === "ios") {
      const showSubscription = Keyboard.addListener("keyboardWillShow", (event) => {
        stickToBottomRef.current = true;
        applyKeyboardHeight(event.endCoordinates.height, event.duration || 250);
        const mid = Math.max(16, Math.floor((event.duration || 250) * 0.55));
        setTimeout(() => scrollMessagesToEnd(false), mid);
      });
      const hideSubscription = Keyboard.addListener("keyboardWillHide", (event) => {
        applyKeyboardHeight(0, event.duration || 250);
      });
      const frameSubscription = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
        // Interactive dismiss / scrub updates arrive with duration 0.
        if ((event.duration ?? 0) > 0) return;
        const screenHeight = Dimensions.get("screen").height;
        applyKeyboardHeight(Math.max(0, screenHeight - event.endCoordinates.screenY), 0);
      });

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
        frameSubscription.remove();
      };
    }

    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      stickToBottomRef.current = true;
      applyKeyboardHeight(event.endCoordinates.height, 0);
      requestAnimationFrame(() => scrollMessagesToEnd(false));
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      applyKeyboardHeight(0, 0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [active, scrollMessagesToEnd]);

  useEffect(() => {
    if (!conversationKey) return;
    stickToBottomRef.current = true;
    loadingOlderRef.current = false;
    setAttachedViewer(null);
    setAttachedReportItem(null);
    setSessionMessages([]);

    const frame = requestAnimationFrame(() => scrollMessagesToEnd(false));
    const timers = [32, 120, 320].map((delay) =>
      setTimeout(() => {
        if (stickToBottomRef.current) scrollMessagesToEnd(false);
      }, delay),
    );

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [conversationKey, scrollMessagesToEnd]);

  useEffect(() => {
    if (!conversationKey || messageCount === 0) return;
    if (!stickToBottomRef.current || loadingOlderRef.current) return;
    const frame = requestAnimationFrame(() => scrollMessagesToEnd(false));
    return () => cancelAnimationFrame(frame);
  }, [conversationKey, messageCount, scrollMessagesToEnd]);

  useEffect(() => {
    return subscribeJamRelationship((state) => {
      setAttachedViewer((current) => {
        if (!current || current.isOwn) return current;
        const ownerId = current.videos.find(
          (entry): entry is FeedVideo => "userId" in entry && typeof entry.userId === "string",
        )?.userId;
        if (ownerId !== state.userId) return current;
        return {
          ...current,
          jammedByMe: state.jammedByMe,
          jammedMe: state.jammedMe,
          videos: current.videos.map((entry) =>
            "userId" in entry && entry.userId === state.userId
              ? withJamRelationship(entry, state)
              : entry,
          ),
        };
      });
    });
  }, []);

  if (!active) return null;

  const isSystem = "sender_name" in active;
  const title = isSystem ? active.sender_name : active.creatorName;
  const avatarUri = isSystem ? null : active.avatarUrl;
  const profileUserId = isSystem ? null : active.userId;
  const messages = isSystem
    ? [{ id: active.id, body: active.body, incoming: true, createdAt: active.created_at }]
    : [...active.messages, ...pendingSessionMessages];
  const hasOutgoing = !isSystem && messages.some((message) => !message.incoming);
  const hasIncoming = !isSystem && messages.some((message) => message.incoming);
  // Locked threads: only allow the first reply to an incoming jam. Pending outbound jams stay closed.
  const canSend = !isSystem && (active.unlocked || (hasIncoming && !hasOutgoing));
  const canLoadOlder =
    !isSystem &&
    Boolean(onLoadOlderMessages) &&
    Boolean(active.hasMoreMessages || active.olderMessagesCursor);

  async function loadOlder() {
    if (isSystem || !onLoadOlderMessages || loadingOlder) return;
    stickToBottomRef.current = false;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      await onLoadOlderMessages(active as Conversation);
    } catch (err) {
      Alert.alert("could not load messages", err instanceof Error ? err.message : "try again");
    } finally {
      setLoadingOlder(false);
      requestAnimationFrame(() => {
        loadingOlderRef.current = false;
      });
    }
  }

  async function submit() {
    if (!draft.trim() || isSystem) return;
    const body = draft.trim();
    setDraft("");
    stickToBottomRef.current = true;
    await onSend(active as Conversation, body);
    requestAnimationFrame(() => scrollMessagesToEnd(true));
  }

  function openMessageMenu(message: ChatMessage) {
    if (message.incoming) return;
    triggerHoldHaptic();
    setContextMessageId((current) => (current === message.id ? null : message.id));
  }

  function openActiveProfile() {
    if (!profileUserId) return;

    try {
      onOpenProfile(profileUserId);
    } catch (err) {
      Alert.alert("could not open profile", err instanceof Error ? err.message : "try again");
    }
  }

  function startEditingMessage(message: ChatMessage) {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
    setContextMessageId(null);
  }

  async function saveEditedMessage() {
    if (!editingMessageId || !editDraft.trim()) return;
    const editingMessage = messages.find((message) => message.id === editingMessageId);
    if (!editingMessage) return;

    await onEditMessage(editingMessage.serverId ?? editingMessage.id, editDraft.trim());
    setEditingMessageId(null);
    setEditDraft("");
  }

  async function deleteOwnMessage(message: ChatMessage) {
    setContextMessageId(null);
    setEditingMessageId(null);
    await onDeleteMessage(message.serverId ?? message.id);
  }

  async function openAttachedVideo(attachment: MessageVideoAttachment) {
    if (openingAttachedVideoRef.current) return;
    openingAttachedVideoRef.current = true;
    Keyboard.dismiss();

    try {
      const ownerId = attachment.userId;
      if (!ownerId) {
        Alert.alert("video unavailable", "this video could not be opened.");
        return;
      }

      if (ownerId === currentUserId) {
        const [profile, videos] = await Promise.all([
          fetchProfile(currentUserId),
          fetchMyVideos(currentUserId),
        ]);
        if (!profile) {
          Alert.alert("video unavailable", "this video is no longer available.");
          return;
        }

        const ownVideos = videos.map((video) => ({ ...video, userId: currentUserId }));
        const initialIndex = ownVideos.findIndex((video) => video.id === attachment.id);
        if (initialIndex < 0) {
          Alert.alert("video unavailable", "this video is no longer available.");
          return;
        }

        setAttachedViewer({
          isOwn: true,
          videos: ownVideos,
          initialIndex,
          owner: {
            creatorName: profile.display_name ?? "you",
            role: profile.creator_types?.[0] ?? "creator",
            location: formatProfileLocationLabel(profile) ?? "unknown",
            avatarUrl: profile.avatar_url,
            earlyAdopter: Boolean(profile.early_adopter),
            proBadge: getProBadgeKind({
              earlyAdopter: profile.early_adopter,
              videoCount: Math.max(ownVideos.length, profile.video_count ?? 0),
              proSubscriptionActive: profile.pro_subscription_active,
            }),
          },
          jammedByMe: false,
          jammedMe: false,
        });
        return;
      }

      const [profile, videos, relationship] = await Promise.all([
        fetchCreatorProfile(currentUserId, ownerId),
        fetchCreatorVideos(currentUserId, ownerId),
        fetchRelationshipState(currentUserId, ownerId),
      ]);
      if (!profile) {
        Alert.alert("video unavailable", "this video is no longer available.");
        return;
      }

      const sortedVideos = sortProfileVideosByNewest(videos);
      const postedVideoCount = Math.max(sortedVideos.length, profile.video_count ?? 0);
      const feedVideos = sortedVideos.map((video) =>
        profileToFeedVideo(
          profile,
          video,
          savedVideoIds.has(video.id),
          relationship.jammedByMe,
          relationship.jammedMe,
          postedVideoCount,
        ),
      );
      const initialIndex = feedVideos.findIndex((video) => video.id === attachment.id);
      if (initialIndex < 0) {
        Alert.alert("video unavailable", "this video is no longer available.");
        return;
      }

      setAttachedViewer({
        isOwn: false,
        videos: feedVideos,
        initialIndex,
        owner: {
          creatorName: profile.display_name ?? "creator",
          role: profile.creator_types?.[0] ?? "creator",
          location: formatProfileLocationLabel(profile) ?? "unknown",
          avatarUrl: profile.avatar_url,
          earlyAdopter: Boolean(profile.early_adopter),
          proBadge: getProBadgeKind({
            earlyAdopter: profile.early_adopter,
            videoCount: postedVideoCount,
            proSubscriptionActive: profile.pro_subscription_active,
          }),
        },
        jammedByMe: relationship.jammedByMe,
        jammedMe: relationship.jammedMe,
      });
    } catch (err) {
      Alert.alert("could not open video", err instanceof Error ? err.message : "try again");
    } finally {
      openingAttachedVideoRef.current = false;
    }
  }

  function closeAttachedViewer() {
    setAttachedViewer(null);
  }

  function submitAttachedReport(item: FeedVideo, reason: ReportReason) {
    if (attachedReportSubmitting) return;
    setAttachedReportSubmitting(true);
    void reportVideo({
      reporterId: currentUserId,
      reportedUserId: item.userId,
      videoId: item.id,
      reason,
    })
      .then(() => {
        setAttachedReportItem(null);
        closeAttachedViewer();
      })
      .catch((err) => {
        Alert.alert("could not submit report", err instanceof Error ? err.message : "try again");
      })
      .finally(() => setAttachedReportSubmitting(false));
  }

  const chatScreen = (
    <SwipeBackSurface
      resetKey={isSystem ? active.id : active.userId}
      onBack={onClose}
      style={presentation === "overlay" ? styles.chatOverlaySwipeSurface : styles.flex}
      enterFromRight
    >
      <View style={styles.safe}>
        <View style={styles.flex}>
          <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top + 10, 18) }]}>
            <Pressable
              onPress={onClose}
              style={styles.chatBackButton}
              accessibilityLabel="back"
              hitSlop={10}
            >
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            {!isSystem ? (
              <Pressable
                onPress={openActiveProfile}
                accessibilityLabel={`open ${title}'s profile`}
                hitSlop={10}
                style={styles.chatProfileTarget}
              >
                <Avatar uri={avatarUri} size={44} />
                <View>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={styles.helper}>{canSend ? "messages unlocked" : "waiting for a jam"}</Text>
                </View>
              </Pressable>
            ) : (
              <>
                <JamSystemAvatar size={44} />
                <View>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={styles.helper}>system message</Text>
                </View>
              </>
            )}
          </View>
          <ScrollView
            ref={messagesScrollRef}
            style={styles.flex}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            onScroll={(event) => {
              if (loadingOlderRef.current) return;
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              const distanceFromBottom =
                contentSize.height - layoutMeasurement.height - contentOffset.y;
              stickToBottomRef.current = distanceFromBottom < 100;
            }}
            onContentSizeChange={() => {
              if (loadingOlderRef.current) return;
              if (stickToBottomRef.current) {
                scrollMessagesToEnd(false);
              }
            }}
          >
            {canLoadOlder ? (
              <Pressable
                onPress={() => void loadOlder()}
                disabled={loadingOlder}
                style={styles.chatLoadOlderButton}
                accessibilityRole="button"
                accessibilityLabel="Load earlier messages"
              >
                {loadingOlder ? (
                  <ActivityIndicator color={getActivityIndicatorColor()} />
                ) : (
                  <Text style={styles.chatLoadOlderText}>load earlier messages</Text>
                )}
              </Pressable>
            ) : null}
            {messages.map((message) => {
              const isEditing = editingMessageId === message.id;
              const isMenuOpen = contextMessageId === message.id;

              return (
                <AnimatedChatMessage
                  key={message.id}
                  messageId={message.id}
                  style={[
                    styles.messageWrap,
                    message.incoming ? styles.messageWrapIn : styles.messageWrapOut,
                  ]}
                >
                      {message.video && !isEditing ? (
                        <MessageVideoThumbnail
                          video={message.video}
                          incoming={message.incoming}
                          onPress={() => void openAttachedVideo(message.video!)}
                          onLongPress={
                            message.incoming ? undefined : () => openMessageMenu(message)
                          }
                        />
                      ) : null}
                      {isEditing || (message.body ?? "").trim() ? (
                        <Pressable
                          disabled={message.incoming}
                          onLongPress={() => openMessageMenu(message)}
                          style={[
                            styles.bubble,
                            message.incoming ? styles.bubbleIn : styles.bubbleOut,
                            message.video && !isEditing ? styles.bubbleWithVideo : null,
                          ]}
                        >
                          {isEditing ? (
                            <View style={styles.editMessageBox}>
                              <TextInput
                                value={editDraft}
                                onChangeText={setEditDraft}
                                multiline
                                autoFocus
                                style={[styles.editMessageInput, styles.bubbleTextOut]}
                              />
                              <View style={styles.editMessageActions}>
                                <Pressable onPress={() => {
                                  setEditingMessageId(null);
                                  setEditDraft("");
                                }}>
                                  <Text style={styles.editMessageCancel}>cancel</Text>
                                </Pressable>
                                <Pressable onPress={() => void saveEditedMessage()}>
                                  <Text style={styles.editMessageSave}>save</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <Text style={[styles.bubbleText, !message.incoming && styles.bubbleTextOut]}>
                              {message.body}
                            </Text>
                          )}
                        </Pressable>
                      ) : null}
                  {isMenuOpen && !message.incoming && !isEditing && (
                    <View style={styles.messageContextMenu}>
                      <Pressable style={styles.messageContextItem} onPress={() => startEditingMessage(message)}>
                        <Text style={styles.messageContextText}>edit</Text>
                      </Pressable>
                      <Pressable style={styles.messageContextItem} onPress={() => void deleteOwnMessage(message)}>
                        <Text style={styles.messageContextDangerText}>delete</Text>
                      </Pressable>
                    </View>
                  )}
                </AnimatedChatMessage>
              );
            })}
          </ScrollView>
          {!isSystem ? (
            <View
              style={[
                styles.chatComposerDock,
                {
                  marginBottom: keyboardHeight,
                  paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12),
                },
              ]}
            >
              <View style={styles.composer}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  editable={canSend}
                  placeholder={canSend ? "message..." : "waiting for a jam"}
                  placeholderTextColor="#71717a"
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                  onSubmitEditing={() => void submit()}
                  style={[styles.input, styles.flex]}
                />
                <Pressable onPress={() => void submit()} disabled={!canSend} style={styles.sendButton}>
                  <Text style={styles.sendButtonText}>send</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
        {profileOverlay}
        {attachedViewer ? (
          <ProfileVideoFullscreenModal
            visible
            videos={attachedViewer.videos}
            initialIndex={attachedViewer.initialIndex}
            owner={attachedViewer.owner}
            saved={Boolean(
              !attachedViewer.isOwn &&
                (attachedViewer.videos[attachedViewer.initialIndex] as FeedVideo | undefined)?.savedByMe,
            )}
            presentation="overlay"
            onClose={closeAttachedViewer}
            getSavedForVideo={(video) => savedVideoIds.has(video.id)}
            onSave={(video, nextSaved) => {
              void setVideoSaved(video.id, nextSaved);
              setAttachedViewer((current) => {
                if (!current || current.isOwn) return current;
                return {
                  ...current,
                  videos: current.videos.map((entry) =>
                    entry.id === video.id ? { ...entry, savedByMe: nextSaved } : entry,
                  ),
                };
              });
            }}
            onMessage={() => {
              closeAttachedViewer();
            }}
            ownVideoActions={
              attachedViewer.isOwn
                ? {
                    userId: currentUserId,
                    insightsLocked: !hasProFeatures({
                      earlyAdopter: attachedViewer.owner.earlyAdopter,
                      proSubscriptionActive: attachedViewer.owner.proBadge === "blue",
                      videoCount: attachedViewer.videos.length,
                    }),
                    onDelete: (video) => {
                      Alert.alert("delete video?", "this removes it from your profile.", [
                        { text: "cancel", style: "cancel" },
                        {
                          text: "delete",
                          style: "destructive",
                          onPress: () => {
                            void deleteOwnProfileVideo(video.id, (updater) => {
                              setAttachedViewer((current) => {
                                if (!current?.isOwn) return current;
                                const nextVideos = updater(current.videos as ProfileVideo[]);
                                if (nextVideos.length === 0) return null;
                                return {
                                  ...current,
                                  videos: nextVideos,
                                  initialIndex: Math.min(current.initialIndex, nextVideos.length - 1),
                                };
                              });
                            }, () => closeAttachedViewer());
                          },
                        },
                      ]);
                    },
                    onEdited: (updated) => {
                      setAttachedViewer((current) => {
                        if (!current?.isOwn) return current;
                        return {
                          ...current,
                          videos: current.videos.map((entry) =>
                            entry.id === updated.id ? { ...entry, ...updated } : entry,
                          ),
                        };
                      });
                    },
                    onShared: () => onInboxChanged?.(),
                    onInsights: () => {
                      const hasPro = hasProFeatures({
                        earlyAdopter: attachedViewer.owner.earlyAdopter,
                        proSubscriptionActive: attachedViewer.owner.proBadge === "blue",
                        videoCount: attachedViewer.videos.length,
                      });
                      Alert.alert(
                        hasPro ? "insights" : "insights · pro",
                        hasPro
                          ? "video insights are coming soon."
                          : "unlock jam. pro to see views, saves, and more for your posts.",
                      );
                    },
                  }
                : undefined
            }
            onNotInterested={
              attachedViewer.isOwn
                ? undefined
                : (video) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (!feedItem) return;
                    closeAttachedViewer();
                    void hideCreator(currentUserId, feedItem.userId)
                      .then(() => refreshSavedVideos())
                      .catch((err) => {
                        Alert.alert(
                          "could not hide creator",
                          err instanceof Error ? err.message : "try again",
                        );
                      });
                  }
            }
            onBlock={
              attachedViewer.isOwn
                ? undefined
                : (video) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (!feedItem) return;
                    closeAttachedViewer();
                    void blockUser(currentUserId, feedItem.userId)
                      .then(() => {
                        onInboxChanged?.();
                        return refreshSavedVideos();
                      })
                      .catch((err) => {
                        Alert.alert(
                          "could not block",
                          err instanceof Error ? err.message : "try again",
                        );
                      });
                  }
            }
            onReport={
              attachedViewer.isOwn
                ? undefined
                : (video) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (feedItem) setAttachedReportItem(feedItem);
                  }
            }
            onSendMessage={
              attachedViewer.isOwn
                ? undefined
                : async (video, body) => {
                    const feedItem = profileVideoToFeedVideo(video);
                    if (!feedItem) return;
                    const savedMessage = await sendJamRequest(feedItem.userId, body, video.id);
                    const outgoingMessage: ChatMessage = {
                      id: savedMessage.id,
                      serverId: savedMessage.id,
                      body: savedMessage.body,
                      incoming: false,
                      createdAt: savedMessage.created_at,
                      video: toMessageVideoAttachmentFromVideo(video, feedItem.userId),
                    };
                    stickToBottomRef.current = true;
                    setSessionMessages((current) =>
                      current.some((message) => message.id === outgoingMessage.id)
                        ? current
                        : [...current, outgoingMessage],
                    );
                    setAttachedViewer((current) => {
                      if (!current || current.isOwn) return current;
                      return {
                        ...current,
                        jammedByMe: true,
                        jammedMe: Boolean(feedItem.jammedMe),
                        videos: current.videos.map((entry) =>
                          entry.id === video.id ||
                          ("userId" in entry && entry.userId === feedItem.userId)
                            ? {
                                ...entry,
                                jammedByMe: true,
                                mutual: Boolean(feedItem.jammedMe),
                              }
                            : entry,
                        ),
                      };
                    });
                    onInboxChanged?.();
                    requestAnimationFrame(() => scrollMessagesToEnd(true));
                  }
            }
          />
        ) : null}
        <FeedReportModal
          item={attachedReportItem}
          submitting={attachedReportSubmitting}
          onClose={() => setAttachedReportItem(null)}
          onSubmit={(reason) => {
            if (attachedReportItem) submitAttachedReport(attachedReportItem, reason);
          }}
        />
      </View>
    </SwipeBackSurface>
  );

  if (presentation === "overlay") {
    return <View style={styles.chatOverlayHost}>{chatScreen}</View>;
  }

  return (
    <Modal animationType="none" transparent visible={Boolean(active)} onRequestClose={onClose}>
      {chatScreen}
    </Modal>
  );
}

export function AnimatedChatMessage({
  children,
  messageId,
  style,
}: {
  children: React.ReactNode;
  messageId: string;
  style: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [messageId, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function MessageVideoThumbnail({
  video,
  incoming,
  onPress,
  onLongPress,
}: {
  video: MessageVideoAttachment;
  incoming: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const uri = getMessageVideoThumbnailSource(video);
  if (!uri) return null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={video.caption ? `Open video: ${video.caption}` : "Open shared video"}
      style={[
        styles.messageVideoThumbnailWrap,
        incoming ? styles.messageVideoThumbnailIn : styles.messageVideoThumbnailOut,
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.messageVideoThumbnail as ImageStyle}
        alt={video.caption ? `Video: ${video.caption}` : "Shared video"}
      />
    </Pressable>
  );
}
