import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import * as Linking from "expo-linking";
import { DarkTheme, NavigationContainer, type NavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchInbox,
  fetchProfile,
  fetchSavedVideos,
  saveVideo,
  unsaveVideo,
  type Profile,
} from "@/lib/native-social-data";
import {
  fetchRecentInboundMessages,
  resolveInboxNotification,
  type DirectMessageNotificationRow,
  type InboxNotification,
} from "@/lib/inbox-notifications";
import { getActiveInboxChatUserId } from "@/lib/active-inbox-chat";
import {
  pauseLiveLocationSharingOnLogout,
  resumeLiveLocationSharingIfEnabled,
} from "@/lib/live-location-sharing";
import {
  subscribePendingUploadPosted,
} from "@/lib/pending-video-uploads";
import { supabase } from "@/lib/native-supabase";
import {
  ensureFilterCatalogLoaded,
} from "@/lib/video-filters";
import type {
  AuthDeepLinkResult,
  MainTabParamList,
  Route,
  SavedVideoController,
  ThemeMode,
} from "@/types/app";
import {
  THEME_STORAGE_KEY,
  border,
  dark,
} from "@/theme/tokens";
import {
  darkStyles,
  setActiveThemeMode,
  styles,
} from "@/theme/styles";
import { getUnreadInboxCount } from "@/lib/inbox-unread";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { preloadRecentVideoThumbnail } from "@/components/create/create-media";
import { handleAuthDeepLink } from "@/lib/auth-deep-link";
import { JamTabBar } from "@/components/navigation/jam-tab-bar";
import { DiscoverScreen } from "@/screens/discover-screen";
import { CreateScreen } from "@/screens/create-screen";
import { InboxScreen } from "@/screens/inbox-screen";
import { MyProfileScreen } from "@/screens/my-profile-screen";
import { AuthScreen } from "@/screens/auth-screen";
import { OnboardingScreen } from "@/screens/onboarding-screen";
import { WelcomeScreen } from "@/screens/welcome-screen";

const MainTab = createBottomTabNavigator<MainTabParamList>();

function getJamNavigationTheme(themeMode: ThemeMode) {
  return {
    ...DarkTheme,
    dark: themeMode === "dark",
    colors: {
      ...DarkTheme.colors,
      background: themeMode === "light" ? "#f7f7f8" : dark,
      card: themeMode === "light" ? "#ffffff" : dark,
      border: themeMode === "light" ? "rgba(0,0,0,0.12)" : border,
      text: themeMode === "light" ? "#0a0a0a" : "#fff",
      primary: themeMode === "light" ? "#0a0a0a" : "#fff",
    },
  };
}

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  const updateThemeMode = useCallback((nextThemeMode: ThemeMode) => {
    setActiveThemeMode(nextThemeMode);
    setThemeMode(nextThemeMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedThemeMode) => {
        if (savedThemeMode === "light" || savedThemeMode === "dark") {
          setActiveThemeMode(savedThemeMode);
          setThemeMode(savedThemeMode);
        }
      })
      .finally(() => setThemeReady(true));
  }, []);

  // Hold a stable dark jam. loader until theme is known — flipping light/dark mid-boot
  // was restyling the logo and reading as a glitch.
  if (!themeReady) {
    return (
      <GestureHandlerRootView style={darkStyles.gestureRoot}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <StatusBar style="light" />
          <LoadingScreen label="opening jam." logoOnly />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style={themeMode === "light" ? "dark" : "light"} />
        <JamApp themeMode={themeMode} onThemeModeChange={updateThemeMode} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function JamApp({
  themeMode,
  onThemeModeChange,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const [route, setRoute] = useState<Route>("auth");
  const [userId, setUserId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [shuffleSignal, setShuffleSignal] = useState(0);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2 | 3>(1);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  // jam. splash over the feed only for cold session restore — not after login/signup.
  const [showLaunchSplash, setShowLaunchSplash] = useState(false);

  const routeAfterAuth = useCallback(async (
    nextUserId: string,
    options?: { fromColdStart?: boolean },
  ) => {
    setPasswordRecoveryPending(false);
    const profile = await fetchProfile(nextUserId);
    setUserId(nextUserId);

    if (!profile?.onboarding_complete) {
      setShowLaunchSplash(false);
      setRoute("onboarding");
      return;
    }

    if (!profile.welcome_seen && profile.early_adopter) {
      setShowLaunchSplash(false);
      setRoute("welcome");
      return;
    }

    setShowLaunchSplash(Boolean(options?.fromColdStart));
    setRoute("main");
  }, []);

  const enterPasswordRecovery = useCallback(() => {
    setPasswordRecoveryPending(true);
    setUserId(null);
    setRoute("auth");
  }, []);

  useEffect(() => {
    if (!userId) return;

    void resumeLiveLocationSharingIfEnabled(userId).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function boot() {
      let linkResult: AuthDeepLinkResult = null;
      try {
        linkResult = await handleAuthDeepLink(await Linking.getInitialURL());
      } catch {
        linkResult = null;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (linkResult === "recovery") {
        enterPasswordRecovery();
      } else if (user) {
        await routeAfterAuth(user.id, { fromColdStart: true });
      } else {
        setRoute("auth");
      }
      setBooting(false);
    }

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthDeepLink(url)
        .then(async (linkResult) => {
          if (linkResult === "recovery") {
            enterPasswordRecovery();
            return;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) await routeAfterAuth(user.id);
        })
        .catch((err) => {
          Alert.alert(
            "could not open link",
            err instanceof Error ? err.message : "try requesting a new reset email.",
          );
        });
    });

    const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        enterPasswordRecovery();
        return;
      }

      if (!session?.user) {
        setPasswordRecoveryPending(false);
        setUserId(null);
        setRoute("auth");
      }
    });

    void boot();

    return () => {
      active = false;
      subscription.remove();
      authSubscription.data.subscription.unsubscribe();
    };
  }, [enterPasswordRecovery, routeAfterAuth]);

  if (booting) {
    return <LoadingScreen label="opening jam." logoOnly />;
  }

  if (route === "auth") {
    return (
      <AuthScreen
        onAuthenticated={routeAfterAuth}
        passwordRecovery={passwordRecoveryPending}
      />
    );
  }

  if (!userId) {
    return (
      <AuthScreen
        onAuthenticated={routeAfterAuth}
        passwordRecovery={passwordRecoveryPending}
      />
    );
  }

  if (route === "onboarding") {
    return (
      <OnboardingScreen
        key={`onboarding-step-${onboardingInitialStep}`}
        userId={userId}
        initialStep={onboardingInitialStep}
        onFinished={(isEarlyAdopter) => {
          setOnboardingInitialStep(1);
          setShowLaunchSplash(false);
          setRoute(isEarlyAdopter ? "welcome" : "main");
        }}
      />
      );
  }

  if (route === "welcome") {
    return (
      <WelcomeScreen
        userId={userId}
        onBack={() => {
          setOnboardingInitialStep(3);
          setRoute("onboarding");
        }}
        onDone={() => {
          setShowLaunchSplash(false);
          setRoute("main");
        }}
      />
    );
  }

  return (
    <MainTabs
      userId={userId}
      themeMode={themeMode}
      onThemeModeChange={onThemeModeChange}
      shuffleSignal={shuffleSignal}
      showLaunchSplash={showLaunchSplash}
      onShuffleDiscover={() => setShuffleSignal((current) => current + 1)}
      onLoggedOut={async () => {
        try {
          await pauseLiveLocationSharingOnLogout(userId).catch(() => undefined);
          const { error } = await supabase.auth.signOut({ scope: "local" });
          if (error) {
            await supabase.auth.signOut().catch(() => undefined);
          }
        } finally {
          setShowLaunchSplash(false);
          setUserId(null);
          setRoute("auth");
        }
      }}
    />
  );
}

function MainTabs({
  userId,
  themeMode,
  onThemeModeChange,
  shuffleSignal,
  showLaunchSplash,
  onShuffleDiscover,
  onLoggedOut,
}: {
  userId: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  shuffleSignal: number;
  showLaunchSplash: boolean;
  onShuffleDiscover: () => void;
  onLoggedOut: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const navigationRef = useRef<NavigationContainerRef<MainTabParamList>>(null);
  const [tabProfile, setTabProfile] = useState<Profile | null>(null);
  const [profileRefreshSignal, setProfileRefreshSignal] = useState(0);
  const [inboxRefreshSignal, setInboxRefreshSignal] = useState(0);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [inboxNotification, setInboxNotification] = useState<InboxNotification | null>(null);
  const [postedToastVisible, setPostedToastVisible] = useState(false);
  const [discoverBootReady, setDiscoverBootReady] = useState(!showLaunchSplash);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(() => new Set());
  const pendingSavedVideoStateRef = useRef(new Map<string, boolean>());
  const seenInboundMessageIdsRef = useRef<Set<string>>(new Set());
  const inboxNotificationsReadyRef = useRef(false);
  const pendingInboundMessagesRef = useRef<DirectMessageNotificationRow[]>([]);
  const inboxNotificationHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inboxNotificationOpacity = useRef(new Animated.Value(0)).current;
  const inboxNotificationTranslateY = useRef(new Animated.Value(-8)).current;
  const feedChromeOpacity = useRef(new Animated.Value(1)).current;
  const [feedChromeClear, setFeedChromeClear] = useState(false);

  const refreshUnreadInboxCount = useCallback(async () => {
    const inbox = await fetchInbox(userId);
    const nextCount = getUnreadInboxCount(inbox);
    setUnreadInboxCount(nextCount);
    return nextCount;
  }, [userId]);

  const bumpInboxRefresh = useCallback(() => {
    setInboxRefreshSignal((current) => current + 1);
  }, []);

  const hideInboxNotification = useCallback(() => {
    if (inboxNotificationHideTimerRef.current) {
      clearTimeout(inboxNotificationHideTimerRef.current);
      inboxNotificationHideTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(inboxNotificationOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(inboxNotificationTranslateY, {
        toValue: -8,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setInboxNotification(null);
    });
  }, [inboxNotificationOpacity, inboxNotificationTranslateY]);

  const showInboxNotification = useCallback(
    (notification: InboxNotification) => {
      if (getActiveInboxChatUserId() === notification.senderId) return;

      if (inboxNotificationHideTimerRef.current) {
        clearTimeout(inboxNotificationHideTimerRef.current);
        inboxNotificationHideTimerRef.current = null;
      }

      setInboxNotification(notification);
      inboxNotificationOpacity.setValue(0);
      inboxNotificationTranslateY.setValue(-8);
      Animated.parallel([
        Animated.timing(inboxNotificationOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(inboxNotificationTranslateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      inboxNotificationHideTimerRef.current = setTimeout(() => {
        hideInboxNotification();
      }, 4200);
    },
    [hideInboxNotification, inboxNotificationOpacity, inboxNotificationTranslateY],
  );

  const handleIncomingDirectMessage = useCallback(
    async (row: DirectMessageNotificationRow) => {
      if (!inboxNotificationsReadyRef.current) {
        pendingInboundMessagesRef.current.push(row);
        return;
      }

      if (seenInboundMessageIdsRef.current.has(row.id)) return;
      seenInboundMessageIdsRef.current.add(row.id);

      if (row.recipient_id !== userId || row.sender_id === userId) return;

      bumpInboxRefresh();

      try {
        const notification = await resolveInboxNotification(userId, row);
        if (!notification) return;
        showInboxNotification(notification);
      } catch {
        // Keep badge/inbox refresh even if banner copy fails.
      }
    },
    [bumpInboxRefresh, showInboxNotification, userId],
  );

  useEffect(() => {
    let cancelled = false;
    inboxNotificationsReadyRef.current = false;
    seenInboundMessageIdsRef.current = new Set();
    pendingInboundMessagesRef.current = [];

    async function bootstrapSeenMessages() {
      try {
        const recent = await fetchRecentInboundMessages(userId);
        if (cancelled) return;
        seenInboundMessageIdsRef.current = new Set(recent.map((message) => message.id));
      } catch {
        // Realtime/polling can still catch future messages.
      } finally {
        if (cancelled) return;
        inboxNotificationsReadyRef.current = true;
        const pending = pendingInboundMessagesRef.current;
        pendingInboundMessagesRef.current = [];
        for (const message of pending) {
          await handleIncomingDirectMessage(message);
        }
      }
    }

    void bootstrapSeenMessages();

    const channel = supabase
      .channel(`inbox-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DirectMessageNotificationRow;
          if (!row?.id || !row.sender_id || !row.recipient_id) return;
          void handleIncomingDirectMessage({
            id: row.id,
            sender_id: row.sender_id,
            recipient_id: row.recipient_id,
            body: typeof row.body === "string" ? row.body : "",
            created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
          });
        },
      )
      .subscribe();

    const pollRecentMessages = async () => {
      if (cancelled || AppState.currentState !== "active") return;
      try {
        const recent = await fetchRecentInboundMessages(userId);
        if (cancelled) return;
        for (const message of [...recent].reverse()) {
          await handleIncomingDirectMessage(message);
        }
      } catch {
        // Ignore transient poll errors.
      }
    };

    const pollTimer = setInterval(() => {
      void pollRecentMessages();
    }, 12000);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void pollRecentMessages();
    });

    return () => {
      cancelled = true;
      inboxNotificationsReadyRef.current = false;
      clearInterval(pollTimer);
      appStateSubscription.remove();
      void supabase.removeChannel(channel);
      if (inboxNotificationHideTimerRef.current) {
        clearTimeout(inboxNotificationHideTimerRef.current);
        inboxNotificationHideTimerRef.current = null;
      }
    };
  }, [handleIncomingDirectMessage, userId]);

  const refreshSavedVideos = useCallback(async () => {
    const savedVideos = await fetchSavedVideos(userId);
    const nextSavedVideoIds = new Set(savedVideos.map((video) => video.id));
    pendingSavedVideoStateRef.current.forEach((pendingSaved, videoId) => {
      if (pendingSaved) {
        nextSavedVideoIds.add(videoId);
        return;
      }

      nextSavedVideoIds.delete(videoId);
    });
    setSavedVideoIds(nextSavedVideoIds);
    return nextSavedVideoIds;
  }, [userId]);

  useEffect(() => {
    void fetchProfile(userId).then((profile) => {
      if (profile) setTabProfile(profile);
    });
  }, [profileRefreshSignal, userId]);

  const setVideoSaved = useCallback(
    async (videoId: string, nextSaved: boolean) => {
      pendingSavedVideoStateRef.current.set(videoId, nextSaved);
      setSavedVideoIds((current) => {
        const next = new Set(current);
        if (nextSaved) {
          next.add(videoId);
        } else {
          next.delete(videoId);
        }
        return next;
      });

      try {
        if (nextSaved) {
          await saveVideo(userId, videoId);
        } else {
          await unsaveVideo(userId, videoId);
        }
        await refreshSavedVideos().catch(() => undefined);
        pendingSavedVideoStateRef.current.delete(videoId);
        return true;
      } catch (err) {
        pendingSavedVideoStateRef.current.delete(videoId);
        await refreshSavedVideos().catch(() => {
          setSavedVideoIds((current) => {
            const next = new Set(current);
            if (nextSaved) {
              next.delete(videoId);
            } else {
              next.add(videoId);
            }
            return next;
          });
        });
        Alert.alert(
          nextSaved ? "could not save" : "could not remove",
          err instanceof Error ? err.message : "try again",
        );
        return false;
      }
    },
    [refreshSavedVideos, userId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshSavedVideos();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshSavedVideos]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshUnreadInboxCount().catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [inboxRefreshSignal, refreshUnreadInboxCount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProfile(userId)
        .then(setTabProfile)
        .catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [profileRefreshSignal, userId]);

  useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribePendingUploadPosted((event) => {
      if (event.userId !== userId) return;
      setPostedToastVisible(true);
      setProfileRefreshSignal((current) => current + 1);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setPostedToastVisible(false), 2400);
    });
    return () => {
      unsubscribe();
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, [userId]);

  const savedVideoController = useMemo<SavedVideoController>(
    () => ({
      savedVideoIds,
      setVideoSaved,
      refreshSavedVideos,
    }),
    [refreshSavedVideos, savedVideoIds, setVideoSaved],
  );

  const handleDiscoverBootReady = useCallback(() => {
    setDiscoverBootReady(true);
  }, []);

  useEffect(() => {
    if (!discoverBootReady) return;
    // Warm the camera-roll thumb + filter catalog before create opens.
    const timer = setTimeout(() => {
      void preloadRecentVideoThumbnail();
      void ensureFilterCatalogLoaded();
    }, 700);
    return () => clearTimeout(timer);
  }, [discoverBootReady]);

  return (
    <NavigationContainer ref={navigationRef} theme={getJamNavigationTheme(themeMode)}>
      <View style={styles.flex}>
        <MainTab.Navigator
          initialRouteName="discover"
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            lazy: true,
            animation: "none",
            sceneStyle: styles.tabScene,
            tabBarHideOnKeyboard: true,
          }}
          tabBar={(props) => (
            <JamTabBar
              {...props}
              userId={userId}
              currentUserProfile={tabProfile}
              unreadInboxCount={unreadInboxCount}
              onShuffleDiscover={onShuffleDiscover}
              feedReady={discoverBootReady}
              chromeOpacity={feedChromeOpacity}
              chromeClear={feedChromeClear}
            />
          )}
        >
          <MainTab.Screen name="discover">
            {({ navigation }) => (
              <DiscoverScreen
                userId={userId}
                viewerProfile={tabProfile}
                shuffleSignal={shuffleSignal}
                savedVideoController={savedVideoController}
                showBootOverlay={showLaunchSplash}
                feedChromeOpacity={feedChromeOpacity}
                onFeedChromeClearChange={setFeedChromeClear}
                onCreate={() => navigation.navigate("create")}
                onInboxChanged={bumpInboxRefresh}
                onBootReady={handleDiscoverBootReady}
                onViewerProfileUpdated={setTabProfile}
              />
            )}
          </MainTab.Screen>
          <MainTab.Screen name="create">
            {({ navigation }) => (
              <CreateScreen
                userId={userId}
                onClose={() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                    return;
                  }

                  navigation.navigate("discover");
                }}
                onPosted={() => {
                  setProfileRefreshSignal((current) => current + 1);
                  navigation.navigate("discover");
                }}
              />
            )}
          </MainTab.Screen>
          <MainTab.Screen name="inbox">
            {() => (
              <InboxScreen
                userId={userId}
                viewerProfile={tabProfile}
                refreshSignal={inboxRefreshSignal}
                savedVideoController={savedVideoController}
                onUnreadCountChanged={setUnreadInboxCount}
                onViewerProfileUpdated={setTabProfile}
              />
            )}
          </MainTab.Screen>
          <MainTab.Screen name="you">
            {() => (
              <MyProfileScreen
                userId={userId}
                themeMode={themeMode}
                onThemeModeChange={onThemeModeChange}
                refreshSignal={profileRefreshSignal}
                savedVideoController={savedVideoController}
                initialProfile={tabProfile}
                onInboxChanged={bumpInboxRefresh}
                onProfileChanged={(nextProfile) => setTabProfile(nextProfile)}
                onLoggedOut={onLoggedOut}
              />
            )}
          </MainTab.Screen>
        </MainTab.Navigator>

        {inboxNotification ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.inboxNotificationWrap,
              {
                top: insets.top + 10,
                opacity: inboxNotificationOpacity,
                transform: [{ translateY: inboxNotificationTranslateY }],
              },
            ]}
          >
            <Pressable
              style={styles.inboxNotificationCard}
              onPress={() => {
                hideInboxNotification();
                navigationRef.current?.navigate("inbox");
              }}
              accessibilityRole="button"
              accessibilityLabel={inboxNotification.text}
            >
              <Text numberOfLines={2} style={styles.inboxNotificationText}>
                {inboxNotification.text}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {postedToastVisible ? (
          <View
            pointerEvents="none"
            style={[styles.profilePostedToast, { top: insets.top + 56 }]}
            accessibilityLabel="Posted"
          >
            <Text style={styles.profilePostedToastText}>Posted!</Text>
          </View>
        ) : null}

        {showLaunchSplash && !discoverBootReady ? (
          <View pointerEvents="auto" style={darkStyles.feedBootOverlay}>
            <LoadingScreen label="opening jam." logoOnly />
          </View>
        ) : null}
      </View>
    </NavigationContainer>
  );
}
