import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileFullscreenFeedItem } from "@/components/profile/profile-fullscreen-feed-item";
import { OwnVideoActionsBar } from "@/components/profile/own-video-actions-bar";
import { OwnVideoEditModal } from "@/components/profile/own-video-edit-modal";
import { OwnVideoShareModal } from "@/components/profile/own-video-share-modal";
import { ensureVideoAspectCached } from "@/components/video/aspect-cache";
import { getNavBarHeight } from "@/lib/nav-bar";
import type { FeedVideo, ProfileVideo } from "@/lib/native-social-data";
import type { ProBadgeKind } from "@/lib/pro-entitlements";
import { isPendingSentJam, profileVideoToFeedVideo } from "@/lib/profile-mappers";
import { styles } from "@/theme/styles";
import {
  FEED_ACTION_GAP,
  FEED_CHROME_FADE_MS,
  FULLSCREEN_MESSAGE_SEND_WIDTH,
  FULLSCREEN_MESSAGE_TICK_WIDTH,
  SWIPE_BACK_HIT_WIDTH,
  viewportHeight,
  viewportWidth,
} from "@/theme/tokens";

export function ProfileVideoFullscreenModal({
  visible,
  videos,
  initialIndex,
  owner,
  saved,
  presentation = "modal",
  onClose,
  onSave,
  onMessage,
  onOpenProfile,
  getSavedForVideo,
  getOwnerForVideo,
  ownVideoActions,
  onNotInterested,
  onBlock,
  onReport,
  onSendMessage,
  profileOverlay = null,
}: {
  visible: boolean;
  videos: Array<ProfileVideo | FeedVideo>;
  initialIndex: number;
  owner: {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    earlyAdopter: boolean;
    proBadge?: ProBadgeKind | null;
  };
  saved: boolean;
  presentation?: "modal" | "overlay";
  onClose: () => void;
  onSave: (video: ProfileVideo | FeedVideo, nextSaved: boolean) => void;
  onMessage: (video: ProfileVideo | FeedVideo) => void;
  onOpenProfile?: (video: ProfileVideo | FeedVideo) => void;
  getSavedForVideo?: (video: ProfileVideo | FeedVideo) => boolean;
  ownVideoActions?: {
    userId: string;
    onDelete: (video: ProfileVideo | FeedVideo) => void;
    onEdited?: (video: ProfileVideo) => void;
    onShared?: () => void;
    onInsights: (video: ProfileVideo | FeedVideo) => void;
    insightsLocked?: boolean;
  };
  onNotInterested?: (video: ProfileVideo | FeedVideo) => void;
  onBlock?: (video: ProfileVideo | FeedVideo) => void;
  onReport?: (video: ProfileVideo | FeedVideo) => void;
  onSendMessage?: (video: ProfileVideo | FeedVideo, body: string) => Promise<void>;
  getOwnerForVideo?: (video: ProfileVideo | FeedVideo) => {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    earlyAdopter: boolean;
    proBadge?: ProBadgeKind | null;
  };
  /** Inline profile (or other) stack rendered over the video — swipe-back reveals this player. */
  profileOverlay?: ReactNode;
}) {
  const wasVisibleRef = useRef(false);
  const listRef = useRef<FlatList<ProfileVideo | FeedVideo>>(null);
  const [index, setIndex] = useState(initialIndex);
  const [sessionVideos, setSessionVideos] = useState<Array<ProfileVideo | FeedVideo>>(videos);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(
    videos[initialIndex]?.id ?? videos[0]?.id ?? null,
  );
  const [messageDraft, setMessageDraft] = useState("");
  const [messageInputFocused, setMessageInputFocused] = useState(false);
  const messageInputRef = useRef<TextInput>(null);
  const [messageSending, setMessageSending] = useState(false);
  const [messageSentTickVisible, setMessageSentTickVisible] = useState(false);
  const [messageSentTickScale] = useState(() => new Animated.Value(0));
  const [messageSendButtonWidth] = useState(() => new Animated.Value(FULLSCREEN_MESSAGE_SEND_WIDTH));
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [translateX] = useState(() => new Animated.Value(0));
  const [horizontalTranslateY] = useState(() => new Animated.Value(0));
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  const chromeLockedRef = useRef(false);
  const [chromeHolding, setChromeHolding] = useState(false);
  const [chromeLocked, setChromeLocked] = useState(false);
  const [speedHolding, setSpeedHolding] = useState(false);
  const [editVideo, setEditVideo] = useState<ProfileVideo | FeedVideo | null>(null);
  const [shareVideo, setShareVideo] = useState<ProfileVideo | FeedVideo | null>(null);
  const insets = useSafeAreaInsets();
  // Keep the fullscreen tree mounted briefly after close so players receive
  // shouldPlay=false and hard-stop before unmount (prevents leaked background audio).
  const [contentMounted, setContentMounted] = useState(visible);
  const activeVideos = visible ? sessionVideos : videos;
  const pageHeight = viewportHeight;
  const video = activeVideos[index] ?? activeVideos[0] ?? null;
  const currentIsSlideshow = Boolean(
    video &&
      (("mediaType" in video && video.mediaType === "slideshow") ||
        ("media_type" in video && video.media_type === "slideshow")) &&
      (
        ("imageUrls" in video && Array.isArray(video.imageUrls) && video.imageUrls.length > 0) ||
        ("image_urls" in video && Array.isArray(video.image_urls) && video.image_urls.length > 0)
      ),
  );
  const showMessageBar = Boolean(onSendMessage && !ownVideoActions);
  const messageBarHeight = getNavBarHeight(insets.bottom);
  const messageBarInset = showMessageBar ? messageBarHeight + keyboardOffset : 0;
  const ownProfileNavBarHeight = ownVideoActions ? messageBarHeight : 0;
  // Always reserve bottom chrome on first paint (never mount full-bleed then inset).
  const videoBottomInset = showMessageBar ? messageBarInset : ownProfileNavBarHeight;
  const actionsBottom = videoBottomInset + FEED_ACTION_GAP;
  const metaBottom = showMessageBar ? messageBarInset + 30 : 122;
  const currentFeedItem = video ? profileVideoToFeedVideo(video) : null;
  const currentPendingSentJam = Boolean(currentFeedItem && isPendingSentJam(currentFeedItem));
  const chromeInteractive = !chromeHolding && !chromeLocked;
  const ownActionSheetOpen = Boolean(editVideo || shareVideo);
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(activeVideos.length - 1, 0),
  );

  // Keep nearby fullscreen pages aspect-warmed so swipe doesn't cover→contain flash.
  useEffect(() => {
    if (!visible) return;
    for (const offset of [-1, 0, 1, 2]) {
      const entry = activeVideos[index + offset] ?? activeVideos[safeInitialIndex + offset];
      if (entry) void ensureVideoAspectCached(entry);
    }
  }, [activeVideos, index, safeInitialIndex, visible]);

  const animateChrome = useCallback(
    (nextVisible: boolean) => {
      chromeOpacity.stopAnimation();
      Animated.timing(chromeOpacity, {
        toValue: nextVisible ? 1 : 0,
        duration: FEED_CHROME_FADE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [chromeOpacity],
  );

  const restoreChrome = useCallback(() => {
    chromeLockedRef.current = false;
    setChromeLocked(false);
    setChromeHolding(false);
    animateChrome(true);
  }, [animateChrome]);

  const handleChromeHoldStart = useCallback(() => {
    if (chromeLockedRef.current) return;
    setChromeHolding(true);
    animateChrome(false);
  }, [animateChrome]);

  const handleChromeHoldEnd = useCallback(() => {
    setChromeHolding(false);
    if (chromeLockedRef.current) return;
    animateChrome(true);
  }, [animateChrome]);

  const handleChromeLock = useCallback(() => {
    chromeLockedRef.current = true;
    setChromeLocked(true);
    setChromeHolding(false);
    animateChrome(false);
  }, [animateChrome]);

  const handleChromeUnlock = useCallback(() => {
    restoreChrome();
  }, [restoreChrome]);

  const handleSpeedHoldStart = useCallback(() => {
    setSpeedHolding(true);
  }, []);

  const handleSpeedHoldEnd = useCallback(() => {
    setSpeedHolding(false);
  }, []);

  const clampedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-1, 0, viewportWidth],
        outputRange: [0, 0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  // Shrink as the finger drags away so dismiss feels like the whole screen leaving.
  const dismissScale = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, viewportWidth],
        outputRange: [1, 0.5],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  const onHorizontalGestureEvent = useMemo(
    () =>
      Animated.event(
        [
          {
            nativeEvent: {
              translationX: translateX,
              translationY: horizontalTranslateY,
            },
          },
        ],
        { useNativeDriver: true },
      ),
    [horizontalTranslateY, translateX],
  );

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      setActiveVideoId(null);
      setEditVideo(null);
      setShareVideo(null);
      const timer = setTimeout(() => setContentMounted(false), 80);
      return () => clearTimeout(timer);
    }

    setContentMounted(true);
    if (wasVisibleRef.current) return;

    wasVisibleRef.current = true;
    const nextIndex = Math.min(Math.max(initialIndex, 0), Math.max(videos.length - 1, 0));
    const frame = requestAnimationFrame(() => {
      setSessionVideos(
        videos.map((entry) => ({
          ...entry,
          savedByMe: getSavedForVideo?.(entry) ?? entry.savedByMe ?? saved,
        })),
      );
      setIndex(nextIndex);
      setActiveVideoId(videos[nextIndex]?.id ?? videos[0]?.id ?? null);
      setMessageDraft("");
      setMessageInputFocused(false);
      setMessageSentTickVisible(false);
      messageSentTickScale.setValue(0);
      messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_SEND_WIDTH);
      translateX.setValue(0);
      horizontalTranslateY.setValue(0);
      restoreChrome();
      listRef.current?.scrollToOffset({
        offset: nextIndex * pageHeight,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    getSavedForVideo,
    horizontalTranslateY,
    initialIndex,
    messageSendButtonWidth,
    messageSentTickScale,
    pageHeight,
    restoreChrome,
    saved,
    translateX,
    videos,
    visible,
  ]);

  useEffect(() => {
    if (!visible) return;
    setMessageDraft("");
    setMessageInputFocused(false);
    setMessageSentTickVisible(false);
    messageSentTickScale.setValue(0);
    messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_SEND_WIDTH);
    restoreChrome();
  }, [activeVideoId, messageSendButtonWidth, messageSentTickScale, restoreChrome, visible]);

  useEffect(() => {
    if (!visible || !showMessageBar) {
      setKeyboardOffset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(Math.max(0, viewportHeight - event.endCoordinates.screenY));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [showMessageBar, visible]);

  function updateActiveFromScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / pageHeight);
    const safeIndex = Math.max(0, Math.min(nextIndex, activeVideos.length - 1));
    const nextVideo = activeVideos[safeIndex];
    if (!nextVideo) return;
    setIndex(safeIndex);
    setActiveVideoId(nextVideo.id);
  }

  function handleHorizontalStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;

    const { translationX, translationY, velocityX } = event.nativeEvent;
    // Slightly eager dismiss so it's easier to swipe back off a video.
    const shouldClose =
      state === State.END &&
      translationX > 28 &&
      Math.abs(translationY) < 110 &&
      (translationX > viewportWidth * 0.22 || velocityX > 480);

    if (!shouldClose) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(horizontalTranslateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: viewportWidth,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(horizontalTranslateY, {
        toValue: translationY,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onClose);
  }

  function dismissMessageInput() {
    messageInputRef.current?.blur();
    Keyboard.dismiss();
    setMessageInputFocused(false);
  }

  function runMessageSentAnimation() {
    setMessageSentTickVisible(true);
    messageSentTickScale.setValue(0.4);
    messageSendButtonWidth.setValue(FULLSCREEN_MESSAGE_TICK_WIDTH);
    Animated.sequence([
      Animated.spring(messageSentTickScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.55,
        useNativeDriver: true,
      }),
      Animated.delay(850),
      Animated.parallel([
        Animated.timing(messageSentTickScale, {
          toValue: 0,
          duration: 170,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(messageSendButtonWidth, {
          toValue: FULLSCREEN_MESSAGE_SEND_WIDTH,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      setMessageSentTickVisible(false);
    });
  }

  async function submitFullscreenMessage() {
    const body = messageDraft.trim();
    if (!video || !body || !onSendMessage || messageSending) return;

    if (currentPendingSentJam) return;

    setMessageSending(true);
    try {
      await onSendMessage(video, body);
      setMessageDraft("");
      runMessageSentAnimation();
      const sentFeedItem = profileVideoToFeedVideo(video);
      if (sentFeedItem && !sentFeedItem.mutual) {
        const nextJammedMe = Boolean(sentFeedItem.jammedMe);
        setSessionVideos((current) =>
          current.map((entry) =>
            entry.id === video.id
              ? {
                  ...entry,
                  jammedByMe: true,
                  mutual: nextJammedMe,
                }
              : entry,
          ),
        );
      }
    } catch (err) {
      Alert.alert("could not send", err instanceof Error ? err.message : "try again");
    } finally {
      setMessageSending(false);
    }
  }

  function handleSave(nextVideo: ProfileVideo | FeedVideo, nextSaved: boolean) {
    setSessionVideos((current) =>
      current.map((entry) =>
        entry.id === nextVideo.id
          ? {
              ...entry,
              savedByMe: nextSaved,
            }
          : entry,
      ),
    );
    onSave(nextVideo, nextSaved);
  }

  if (!contentMounted) return null;

  const profileOverlayOpen = Boolean(profileOverlay);

  const content = (
    <View
      style={styles.fullscreenMessageRoot}
      pointerEvents={visible ? "auto" : "none"}
    >
      <PanGestureHandler
        enabled={visible && !profileOverlayOpen && !currentIsSlideshow && !ownActionSheetOpen}
        activeOffsetX={14}
        failOffsetY={[-22, 22]}
        onGestureEvent={onHorizontalGestureEvent}
        onHandlerStateChange={handleHorizontalStateChange}
      >
        <Animated.View
          style={[
            styles.fullscreenVideoRoot,
            {
              opacity: visible ? 1 : 0,
              transform: [
                { translateX: clampedTranslateX },
                { translateY: horizontalTranslateY },
                { scale: dismissScale },
              ],
            },
          ]}
        >
          <FlatList
            ref={listRef}
            data={activeVideos}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            pagingEnabled
            directionalLockEnabled
            scrollEnabled={visible && !chromeHolding && !speedHolding && !profileOverlayOpen && !ownActionSheetOpen}
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            windowSize={5}
            maxToRenderPerBatch={3}
            initialNumToRender={2}
            initialScrollIndex={safeInitialIndex}
            getItemLayout={(_, itemIndex) => ({
              length: pageHeight,
              offset: pageHeight * itemIndex,
              index: itemIndex,
            })}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.index * pageHeight,
                animated: false,
              });
            }}
            onMomentumScrollEnd={updateActiveFromScroll}
            onScrollBeginDrag={() => {
              if (showMessageBar && (keyboardOffset > 0 || messageInputFocused)) {
                dismissMessageInput();
              }
            }}
            renderItem={({ item }) => (
              <ProfileFullscreenFeedItem
                video={item}
                height={pageHeight}
                owner={getOwnerForVideo ? getOwnerForVideo(item) : owner}
                isActive={visible && item.id === activeVideoId && !editVideo}
                videoBottomInset={videoBottomInset}
                actionsBottom={actionsBottom}
                metaBottom={metaBottom}
                ownProfileNavBarHeight={ownProfileNavBarHeight}
                ownVideoActions={ownVideoActions}
                chromeOpacity={chromeOpacity}
                chromeHolding={chromeHolding}
                chromeLocked={chromeLocked}
                onChromeHoldStart={handleChromeHoldStart}
                onChromeHoldEnd={handleChromeHoldEnd}
                onChromeLock={handleChromeLock}
                onChromeUnlock={handleChromeUnlock}
                onSpeedHoldStart={handleSpeedHoldStart}
                onSpeedHoldEnd={handleSpeedHoldEnd}
                onSave={handleSave}
                onMessage={onMessage}
                onOpenProfile={
                  onOpenProfile && !ownVideoActions
                    ? () => onOpenProfile(item)
                    : undefined
                }
                onNotInterested={onNotInterested}
                onBlock={onBlock}
                onReport={onReport}
                swipeBackEnabled
                swipeBackTranslateX={translateX}
                swipeBackTranslateY={horizontalTranslateY}
                onSwipeBackStateChange={handleHorizontalStateChange}
              />
            )}
          />
          {/* Keep the message bar inside the swipe surface so dismiss moves the full screen. */}
          {showMessageBar ? (
            <Animated.View
              pointerEvents={chromeInteractive ? "box-none" : "none"}
              style={[
                styles.fullscreenMessageBar,
                {
                  height: messageBarHeight,
                  bottom: keyboardOffset,
                  paddingBottom: Math.max(insets.bottom, 12),
                  opacity: chromeOpacity,
                },
              ]}
            >
              <TextInput
                ref={messageInputRef}
                value={messageDraft}
                onChangeText={(value) => setMessageDraft(value.slice(0, 200))}
                onFocus={() => setMessageInputFocused(true)}
                onBlur={() => setMessageInputFocused(false)}
                editable={!currentPendingSentJam && !messageSending}
                placeholder={currentPendingSentJam ? "waiting for a jam" : "message..."}
                placeholderTextColor="#71717a"
                returnKeyType="send"
                enablesReturnKeyAutomatically
                onSubmitEditing={() => void submitFullscreenMessage()}
                maxLength={200}
                style={styles.fullscreenMessageInput}
              />
              <Animated.View style={[styles.fullscreenMessageSendFrame, { width: messageSendButtonWidth }]}>
                <Pressable
                  onPress={() => void submitFullscreenMessage()}
                  disabled={!messageDraft.trim() || currentPendingSentJam || messageSending}
                  style={[
                    styles.fullscreenMessageSendButton,
                    (!messageDraft.trim() || currentPendingSentJam || messageSending) && styles.disabled,
                  ]}
                >
                  {messageSentTickVisible ? (
                    <Animated.Text
                      style={[
                        styles.fullscreenMessageSendText,
                        styles.fullscreenMessageSentTick,
                        { transform: [{ scale: messageSentTickScale }] },
                      ]}
                    >
                      ✓
                    </Animated.Text>
                  ) : (
                    <Text style={styles.fullscreenMessageSendText}>{messageSending ? "..." : "send"}</Text>
                  )}
                </Pressable>
              </Animated.View>
            </Animated.View>
          ) : null}
          {ownVideoActions && video ? (
            <Animated.View
              pointerEvents={chromeInteractive && !ownActionSheetOpen ? "auto" : "none"}
              style={[
                styles.fullscreenMessageBar,
                {
                  height: messageBarHeight,
                  bottom: 0,
                  paddingBottom: Math.max(insets.bottom, 12),
                  opacity: chromeOpacity,
                },
              ]}
            >
              <OwnVideoActionsBar
                insightsLocked={Boolean(ownVideoActions.insightsLocked)}
                onDelete={() => ownVideoActions.onDelete(video)}
                onEdit={() => setEditVideo(video)}
                onShare={() => setShareVideo(video)}
                onInsights={() => ownVideoActions.onInsights(video)}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </PanGestureHandler>
      {profileOverlay}
      {ownVideoActions ? (
        <>
          <OwnVideoEditModal
            visible={Boolean(editVideo)}
            video={editVideo}
            onClose={() => setEditVideo(null)}
            onSaved={(updated) => {
              setSessionVideos((current) =>
                current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
              );
              ownVideoActions.onEdited?.(updated);
            }}
          />
          <OwnVideoShareModal
            visible={Boolean(shareVideo)}
            userId={ownVideoActions.userId}
            video={shareVideo}
            onClose={() => setShareVideo(null)}
            onShared={() => ownVideoActions.onShared?.()}
          />
        </>
      ) : null}
    </View>
  );

  if (presentation === "overlay") {
    return <View style={styles.fullscreenOverlay}>{content}</View>;
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      {content}
    </Modal>
  );
}
