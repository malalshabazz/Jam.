import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useEventListener } from "expo";
import { setAudioModeAsync } from "expo-audio";
import { VideoView, useVideoPlayer, type VideoContentFit, type VideoPlayerStatus, type VideoSource } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { DarkTheme, NavigationContainer, useFocusEffect, useIsFocused } from "@react-navigation/native";
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { creatorRoles, locationSuggestions, musicGenres } from "@/lib/options";
import {
  createEarlyAdopterWelcome,
  createVideo,
  deleteMessage,
  deleteVideo,
  editMessage,
  fetchCreatorProfile,
  fetchCreatorVideos,
  fetchFeedVideos,
  fetchInbox,
  fetchMyVideos,
  fetchProfile,
  fetchRelationshipState,
  fetchSavedVideos,
  getSignupPosition,
  markConversationRead,
  markInboxMessageRead,
  markWelcomeSeen,
  removeJamConnection,
  saveProfile,
  saveVideo,
  sendJamRequest,
  sendMessage,
  unsaveVideo,
  type ChatMessage,
  type Conversation,
  type FeedVideo,
  type InboxData,
  type InboxMessage,
  type InboxRequest,
  type Profile,
  type ProfileVideo,
} from "@/lib/native-social-data";
import {
  createStreamUpload,
  getVideoUploadErrorDetails,
  getCloudflarePlaybackUrl,
  logVideoUploadStep,
  uploadToCloudflare,
  type NativeVideoAsset,
} from "@/lib/native-cloudflare";
import { supabase } from "@/lib/native-supabase";

type Route = "auth" | "onboarding" | "welcome" | "main";
type Tab = "discover" | "inbox" | "create" | "you";
type MainTabParamList = {
  discover: undefined;
  create: undefined;
  inbox: undefined;
  you: undefined;
};
type InboxTab = "requests" | "jams" | "sent";
type AuthMode = "login" | "signup";
type PreloadedUserProfile = {
  userId: string;
  profile: Profile | null;
  videos: ProfileVideo[];
  likedByMe: boolean;
  likedMe: boolean;
};
type SavedVideoController = {
  savedVideoIds: Set<string>;
  setVideoSaved: (videoId: string, nextSaved: boolean) => Promise<boolean>;
  refreshSavedVideos: () => Promise<Set<string>>;
};

const { width: viewportWidth, height: viewportHeight } = Dimensions.get("window");
const dark = "#0a0a0a";
const panel = "#18181b";
const panelSoft = "#111113";
const border = "rgba(255,255,255,0.12)";
const muted = "#a1a1aa";
const SCREEN_CONTENT_PADDING = 22;
const PROFILE_GRID_GAP = 4;
const PROFILE_GRID_ITEM_WIDTH = (viewportWidth - PROFILE_GRID_GAP * 2) / 3;
const NAV_BAR_HEIGHT = 92;
const NAV_BAR_ITEM_HEIGHT = 58;
const NAV_BAR_TOP_PADDING = 12;
const FREE_MAX_SECONDS = 45;
const PRO_MAX_SECONDS = 90;
const MAX_VIDEO_TAGS_PER_GROUP = 3;
const SWIPE_BACK_HIT_WIDTH = 112;
const MainTab = createBottomTabNavigator<MainTabParamList>();
function getNavBarHeight(bottomInset: number) {
  return Math.max(
    NAV_BAR_HEIGHT,
    NAV_BAR_ITEM_HEIGHT + NAV_BAR_TOP_PADDING + Math.max(bottomInset, 12),
  );
}
const jamNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: dark,
    card: dark,
    border,
    text: "#fff",
    primary: "#fff",
  },
};
const TAB_SWITCH_ANIMATION = {
  duration: 260,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

export default function App() {
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <JamApp />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function JamApp() {
  const [route, setRoute] = useState<Route>("auth");
  const [userId, setUserId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [shuffleSignal, setShuffleSignal] = useState(0);

  const routeAfterAuth = useCallback(async (nextUserId: string) => {
    const profile = await fetchProfile(nextUserId);
    setUserId(nextUserId);

    if (!profile?.onboarding_complete) {
      setRoute("onboarding");
      return;
    }

    if (!profile.welcome_seen && profile.early_adopter) {
      setRoute("welcome");
      return;
    }

    setRoute("main");
  }, []);

  useEffect(() => {
    let active = true;

    async function boot() {
      await handleAuthDeepLink(await Linking.getInitialURL());
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (user) {
        await routeAfterAuth(user.id);
      } else {
        setRoute("auth");
      }
      setBooting(false);
    }

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthDeepLink(url).then(async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await routeAfterAuth(user.id);
      });
    });

    const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
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
  }, [routeAfterAuth]);

  if (booting) {
    return <LoadingScreen label="opening jam." />;
  }

  if (route === "auth") {
    return <AuthScreen onAuthenticated={routeAfterAuth} />;
  }

  if (!userId) {
    return <AuthScreen onAuthenticated={routeAfterAuth} />;
  }

  if (route === "onboarding") {
    return <OnboardingScreen userId={userId} onFinished={() => setRoute("welcome")} />;
  }

  if (route === "welcome") {
    return (
      <WelcomeScreen
        userId={userId}
        onDone={() => {
          setRoute("main");
        }}
      />
    );
  }

  return (
    <MainTabs
      userId={userId}
      shuffleSignal={shuffleSignal}
      onShuffleDiscover={() => setShuffleSignal((current) => current + 1)}
      onLoggedOut={async () => {
        await supabase.auth.signOut();
        setUserId(null);
        setRoute("auth");
      }}
    />
  );
}

function MainTabs({
  userId,
  shuffleSignal,
  onShuffleDiscover,
  onLoggedOut,
}: {
  userId: string;
  shuffleSignal: number;
  onShuffleDiscover: () => void;
  onLoggedOut: () => Promise<void>;
}) {
  const [tabProfile, setTabProfile] = useState<Profile | null>(null);
  const [profileRefreshSignal, setProfileRefreshSignal] = useState(0);
  const [inboxRefreshSignal, setInboxRefreshSignal] = useState(0);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(() => new Set());

  const refreshUnreadInboxCount = useCallback(async () => {
    const inbox = await fetchInbox(userId);
    const nextCount = getUnreadInboxCount(inbox);
    setUnreadInboxCount(nextCount);
    return nextCount;
  }, [userId]);

  const refreshSavedVideos = useCallback(async () => {
    const savedVideos = await fetchSavedVideos(userId);
    const nextSavedVideoIds = new Set(savedVideos.map((video) => video.id));
    setSavedVideoIds(nextSavedVideoIds);
    return nextSavedVideoIds;
  }, [userId]);

  const setVideoSaved = useCallback(
    async (videoId: string, nextSaved: boolean) => {
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
        void refreshSavedVideos().catch(() => undefined);
        return true;
      } catch (err) {
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

  const savedVideoController = useMemo<SavedVideoController>(
    () => ({
      savedVideoIds,
      setVideoSaved,
      refreshSavedVideos,
    }),
    [refreshSavedVideos, savedVideoIds, setVideoSaved],
  );

  return (
    <NavigationContainer theme={jamNavigationTheme}>
      <MainTab.Navigator
        initialRouteName="discover"
        detachInactiveScreens={false}
        screenOptions={{
          headerShown: false,
          lazy: false,
          animation: "none",
          sceneStyle: styles.tabScene,
          tabBarHideOnKeyboard: true,
        }}
        tabBar={(props) => (
          <JamTabBar
            {...props}
            currentUserProfile={tabProfile}
            unreadInboxCount={unreadInboxCount}
            onShuffleDiscover={onShuffleDiscover}
          />
        )}
      >
        <MainTab.Screen name="discover">
          {({ navigation }) => (
            <DiscoverScreen
              userId={userId}
              shuffleSignal={shuffleSignal}
              savedVideoController={savedVideoController}
              onCreate={() => navigation.navigate("create")}
              onInboxChanged={() => setInboxRefreshSignal((current) => current + 1)}
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
                navigation.navigate("you");
              }}
            />
          )}
        </MainTab.Screen>
        <MainTab.Screen name="inbox">
          {() => (
            <InboxScreen
              userId={userId}
              refreshSignal={inboxRefreshSignal}
              savedVideoController={savedVideoController}
              onUnreadCountChanged={setUnreadInboxCount}
            />
          )}
        </MainTab.Screen>
        <MainTab.Screen name="you">
          {() => (
            <MyProfileScreen
              userId={userId}
              refreshSignal={profileRefreshSignal}
              savedVideoController={savedVideoController}
              onInboxChanged={() => setInboxRefreshSignal((current) => current + 1)}
              onProfileChanged={(nextProfile) => setTabProfile(nextProfile)}
              onLoggedOut={onLoggedOut}
            />
          )}
        </MainTab.Screen>
      </MainTab.Navigator>
    </NavigationContainer>
  );
}

async function handleAuthDeepLink(url: string | null) {
  if (!url) return;

  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const tokenHash = stringParam(query.token_hash);
  const type = stringParam(query.type);

  if (tokenHash && type === "email") {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  }
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (userId: string) => Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: Linking.createURL("auth") },
        });
        if (signUpError) throw signUpError;
        setEmail("");
        setPassword("");
        setMessage("check your email to confirm your account");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      if (data.user) await onAuthenticated(data.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.centered}
      >
        <View style={styles.authCard}>
          <Text style={styles.logo}>jam.</Text>
          <Text style={styles.subtitle}>
            {mode === "login" ? "welcome back" : "create your account"}
          </Text>

          {message && <Text style={styles.notice}>{message}</Text>}
          {error && <Text style={styles.error}>{error}</Text>}

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email"
            placeholderTextColor="#71717a"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="password"
            placeholderTextColor="#71717a"
            style={styles.input}
          />
          <PrimaryButton
            label={loading ? "please wait..." : mode === "login" ? "log in" : "sign up"}
            disabled={loading || !email.trim() || password.length < 6}
            onPress={submit}
          />
          <Pressable
            onPress={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setMessage(null);
            }}
          >
            <Text style={styles.switchText}>
              {mode === "login" ? "new here? sign up" : "already have an account? log in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OnboardingScreen({ userId, onFinished }: { userId: string; onFinished: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creatorSuggestions = useSuggestions(creatorRoles, creatorQuery, creatorTypes);
  const locationMatches = useSuggestions(locationSuggestions, locationQuery, location ? [location] : []);

  useEffect(() => {
    let active = true;
    void fetchProfile(userId).then((profile) => {
      if (!active || !profile) return;
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setCreatorTypes(profile.creator_types ?? []);
      setLocation(profile.location ?? "");
      setLocationQuery(profile.location ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function chooseAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset?.base64) {
        setAvatarUrl(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
      } else if (asset?.uri) {
        setAvatarUrl(asset.uri);
      }
    }
  }

  async function finish() {
    if (!displayName.trim() || creatorTypes.length === 0) {
      setError("add a name and at least one creator type");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const profile = await saveProfile(userId, {
        display_name: displayName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        creator_types: creatorTypes,
        location: location.trim() || null,
        avatar_url: avatarUrl,
        onboarding_complete: true,
        welcome_seen: false,
      });

      if (profile.early_adopter) {
        await createEarlyAdopterWelcome();
      }
      onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.logoSmall}>jam.</Text>
        <Text style={styles.h1}>make your profile</Text>
        <Text style={styles.copy}>keep it simple. collaborators need just enough to know you.</Text>

        <TextInput value={firstName} onChangeText={setFirstName} placeholder="first name" placeholderTextColor="#71717a" style={styles.input} />
        <TextInput value={lastName} onChangeText={setLastName} placeholder="last name" placeholderTextColor="#71717a" style={styles.input} />
        <TextInput value={displayName} onChangeText={setDisplayName} placeholder="name shown on jam." placeholderTextColor="#71717a" style={styles.input} />

        <SectionLabel label="creator type" />
        <ChipRow items={creatorTypes} onRemove={(item) => setCreatorTypes((current) => current.filter((role) => role !== item))} />
        <TextInput value={creatorQuery} onChangeText={setCreatorQuery} placeholder="search creator type" placeholderTextColor="#71717a" style={styles.input} />
        <SuggestionList
          items={creatorSuggestions}
          onPick={(role) => {
            setCreatorTypes((current) => [...current, role]);
            setCreatorQuery("");
          }}
        />

        <SectionLabel label="bio" />
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="short bio, optional"
          placeholderTextColor="#71717a"
          style={[styles.input, styles.textArea]}
          multiline
          maxLength={150}
        />

        <SectionLabel label="location" />
        <ChipRow items={location ? [location] : []} onRemove={() => {
          setLocation("");
          setLocationQuery("");
        }} />
        <TextInput
          value={locationQuery}
          onChangeText={(value) => {
            setLocationQuery(value);
            if (!value.trim()) setLocation("");
          }}
          placeholder="city or country, optional"
          placeholderTextColor="#71717a"
          style={styles.input}
        />
        <SuggestionList
          items={locationMatches}
          onPick={(item) => {
            setLocation(item);
            setLocationQuery(item);
          }}
        />

        <Pressable style={styles.secondaryButton} onPress={chooseAvatar}>
          <Text style={styles.secondaryButtonText}>
            {avatarUrl ? "change profile photo" : "add profile photo, optional"}
          </Text>
        </Pressable>
        {avatarUrl && <Avatar uri={avatarUrl} fallback={getInitials(displayName)} size={72} />}
        {error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton label={saving ? "saving..." : "start jamming"} disabled={saving} onPress={finish} />
      </ScrollView>
    </SafeAreaView>
  );
}

function WelcomeScreen({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [number, setNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getSignupPosition(userId)
      .then((position) => {
        if (active) setNumber(position);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function continueToFeed() {
    await markWelcomeSeen(userId);
    onDone();
  }

  if (loading) return <LoadingScreen label="getting your welcome ready..." />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Text style={styles.eyebrow}>a quick message...</Text>
        <Text style={styles.h1}>you are the {ordinal(number ?? 1)} person to ever have Jam.</Text>
        <Text style={styles.longCopy}>
          This started as an idea from a bedroom — no corporate investors or connections, no starting fan base. You’re joining an empty platform, hopefully because of a passion for creativity, and because you have faith that this could change the game. And that means a lot to me.
        </Text>
        <Text style={styles.callout}>As a thank you, accept a lifetime of pro features.</Text>
        <Text style={styles.longCopy}>
          And keep in mind — the feed might be empty to begin with, but as long as people like you continue to have faith, it will grow before our eyes and you will find what you’re looking for. Welcome to Jam.
        </Text>
        <PrimaryButton label="start jamming" onPress={continueToFeed} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverScreen({
  userId,
  shuffleSignal,
  savedVideoController,
  onCreate,
  onInboxChanged,
}: {
  userId: string;
  shuffleSignal: number;
  savedVideoController: SavedVideoController;
  onCreate: () => void;
  onInboxChanged: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<FeedVideo | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const listRef = useRef<FlatList<FeedVideo>>(null);
  const { savedVideoIds, setVideoSaved } = savedVideoController;

  const load = useCallback(async () => {
    setError(null);
    const feed = await fetchFeedVideos(userId);
    setItems(shuffleVideosWithSpacing(feed));
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load()
        .catch((err) => setError(err instanceof Error ? err.message : "could not load feed"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (shuffleSignal === 0) return;
    const frame = requestAnimationFrame(() => {
      setItems((current) => shuffleVideosWithSpacing(current));
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [shuffleSignal]);

  const itemsWithSavedState = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        likedByMe: savedVideoIds.has(item.id),
      })),
    [items, savedVideoIds],
  );

  const filtered = useMemo(() => {
    return itemsWithSavedState.filter((item) => {
      const itemRoles = item.roles.length
        ? item.roles.map((role) => role.toLowerCase())
        : item.categories.length
          ? item.categories.map((category) => category.toLowerCase())
          : [item.role.toLowerCase()];
      const itemGenres = item.genres.map((genre) => genre.toLowerCase());
      const roleMatch =
        roles.length === 0 ||
        roles.some((role) => itemRoles.includes(role.toLowerCase()));
      const genreMatch =
        genres.length === 0 ||
        genres.some((genre) => itemGenres.includes(genre.toLowerCase()));
      const locationMatch =
        !location ||
        item.location.toLowerCase().includes(location.toLowerCase()) ||
        location.toLowerCase().includes(item.location.toLowerCase());
      return roleMatch && genreMatch && locationMatch;
    });
  }, [genres, itemsWithSavedState, location, roles]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (filtered.length === 0) {
        setActiveVideoId(null);
        return;
      }

      setActiveVideoId((current) =>
        current && filtered.some((item) => item.id === current) ? current : filtered[0].id,
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [filtered]);

  async function refresh() {
    setRefreshing(true);
    await load().catch((err) => setError(err instanceof Error ? err.message : "could not refresh"));
    setRefreshing(false);
  }

  async function toggleSave(item: FeedVideo, nextSaved: boolean) {
    return setVideoSaved(item.id, nextSaved);
  }

  function openJamThread(item: FeedVideo) {
    setActiveProfile(null);

    if (!item.jammedByMe && !item.jammedMe && !item.mutual) {
      setActiveDm(item);
      return;
    }

    const fallbackConversation = conversationFromFeedItem(item, item.mutual);
    setActiveChat(fallbackConversation);

    void (async () => {
      try {
      const inbox = await fetchInbox(userId);
      const existingConversation =
        inbox.conversations.find((conversation) => conversation.userId === item.userId) ??
        inbox.sent.find((conversation) => conversation.userId === item.userId) ??
        inbox.requests
          .filter((request) => request.userId === item.userId)
          .map(conversationFromRequest)
          .at(0);

        if (existingConversation) {
          setActiveChat((current) =>
            current && !("sender_name" in current) && current.userId === item.userId
              ? existingConversation
              : current,
          );
        }
      } catch {
        // Keep the optimistic chat open; sending will still surface any real network errors.
      }
    })();
  }

  function openJamFromProfile(item: FeedVideo) {
    openJamThread(item);
  }

  function updateActiveVideo(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / viewportHeight);
    const nextItem = filtered[Math.max(0, Math.min(nextIndex, filtered.length - 1))];
    if (nextItem) setActiveVideoId(nextItem.id);
  }

  const filtersActive = roles.length > 0 || genres.length > 0 || Boolean(location);
  const navBarHeight = getNavBarHeight(insets.bottom);
  const shouldPlayFeedVideos = isFocused && !filtersOpen && !activeProfile && !activeDm && !activeChat;
  const activeProfilePreload = useMemo(
    () =>
      activeProfile
        ? feedItemToPreloadedProfile(activeProfile, itemsWithSavedState)
        : null,
    [activeProfile, itemsWithSavedState],
  );

  if (loading) return <LoadingScreen label="finding creators..." />;

  return (
    <View style={styles.feedRoot}>
      <Pressable
        onPress={() => setFiltersOpen(true)}
        style={[styles.filterButton, { top: insets.top + 12 }]}
      >
        <Text style={styles.iconText}>≡</Text>
      </Pressable>
      {error && <Toast text={error} />}
      {filtered.length === 0 ? (
        <SafeAreaView style={styles.emptyFeed}>
          <Text style={styles.emptyText}>{getEndOfFeedCopy(filtersActive)}</Text>
          <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
            <Text style={styles.createNavText}>+</Text>
          </Pressable>
        </SafeAreaView>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={updateActiveVideo}
          onScrollEndDrag={updateActiveVideo}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={refresh} />}
          ListFooterComponent={
            <EndOfFeedState
              filtersActive={filtersActive}
              height={viewportHeight}
              onCreate={onCreate}
            />
          }
          renderItem={({ item }) => (
            <FeedItem
              item={item}
              height={viewportHeight}
              videoBottomInset={navBarHeight}
              isActive={shouldPlayFeedVideos && item.id === activeVideoId}
              onOpenProfile={() => setActiveProfile(item)}
              onLike={(nextSaved) => toggleSave(item, nextSaved)}
              onMessage={() => void openJamThread(item)}
            />
          )}
        />
      )}
      <FilterSheet
        visible={filtersOpen}
        selectedRoles={roles}
        selectedGenres={genres}
        selectedLocation={location}
        onClose={() => setFiltersOpen(false)}
        onApply={(nextRoles, nextGenres, nextLocation) => {
          setRoles(nextRoles);
          setGenres(nextGenres);
          setLocation(nextLocation);
          setFiltersOpen(false);
        }}
      />
      <UserProfileModal
        currentUserId={userId}
        userId={activeProfile?.userId ?? null}
        preloadedProfile={activeProfilePreload}
        savedVideoController={savedVideoController}
        onClose={() => setActiveProfile(null)}
        onMessage={(profileFeedItem) => {
          void openJamFromProfile(profileFeedItem);
        }}
        onUnjammed={(removedUserId) => {
          setItems((current) =>
            current.map((entry) =>
              entry.userId === removedUserId
                ? {
                    ...entry,
                    jammedByMe: false,
                    jammedMe: false,
                    mutual: false,
                  }
                : entry,
            ),
          );
          setActiveProfile((current) =>
            current?.userId === removedUserId
              ? {
                  ...current,
                  jammedByMe: false,
                  jammedMe: false,
                  mutual: false,
                }
              : current,
          );
          setActiveChat((current) =>
            current && !("sender_name" in current) && current.userId === removedUserId ? null : current,
          );
          setActiveDm((current) => (current?.userId === removedUserId ? null : current));
        }}
      />
      {/*
        All routed profile views use UserProfileModal above. The old discover-specific
        profile implementation was removed from rendering so profile grids/fullscreen
        behavior stays identical across discover, inbox, and DM routes.
      */}
      <ChatModal
        active={activeChat}
        onClose={() => setActiveChat(null)}
        onOpenProfile={(nextUserId) => {
          const profileItem = itemsWithSavedState.find((entry) => entry.userId === nextUserId);
          if (profileItem) {
            setActiveChat(null);
            setActiveProfile(profileItem);
          }
        }}
        onSend={async (conversation, body) => {
          const optimisticId = `local-${conversation.userId}-${Date.now()}`;
          const optimisticMessage: ChatMessage = {
            id: optimisticId,
            body,
            incoming: false,
            createdAt: new Date().toISOString(),
          };

          setActiveChat((current) => {
            if (!current || "sender_name" in current || current.userId !== conversation.userId) {
              return current;
            }

            return {
              ...current,
              lastMessage: body,
              timestamp: "now",
              unread: false,
              messages: [...current.messages, optimisticMessage],
            };
          });

          try {
            const savedMessage = conversation.unlocked
              ? await sendMessage(conversation.userId, body)
              : await sendJamRequest(conversation.userId, body);
            const unlocksFromReply = !conversation.unlocked && conversation.messages.some((message) => message.incoming);

            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              return {
                ...current,
                unlocked: current.unlocked || unlocksFromReply,
                lastMessage: savedMessage.body,
                messages: current.messages.map((message) =>
                  message.id === optimisticId
                    ? {
                        id: message.id,
                        serverId: savedMessage.id,
                        body: savedMessage.body,
                        incoming: false,
                        createdAt: savedMessage.created_at,
                      }
                    : message,
                ),
              };
            });

            if (unlocksFromReply) {
              setItems((current) =>
                current.map((entry) =>
                  entry.userId === conversation.userId
                    ? {
                        ...entry,
                        jammedByMe: true,
                        jammedMe: true,
                        mutual: true,
                      }
                    : entry,
                ),
              );
              onInboxChanged();
            }

            await load();
          } catch (err) {
            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              const nextMessages = current.messages.filter((message) => message.id !== optimisticId);
              return {
                ...current,
                messages: nextMessages,
                lastMessage: nextMessages.at(-1)?.body ?? conversation.lastMessage,
              };
            });
            Alert.alert("could not send", err instanceof Error ? err.message : "try again");
          }
        }}
        onEditMessage={async (messageId, body) => {
          const updated = await editMessage(messageId, body);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, body: updated.body } : message,
              ),
              lastMessage: current.lastMessage === current.messages.find((message) => message.id === messageId)?.body
                ? updated.body
                : current.lastMessage,
            };
          });
        }}
        onDeleteMessage={async (messageId) => {
          await deleteMessage(messageId);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            const nextMessages = current.messages.filter((message) => message.id !== messageId);
            return {
              ...current,
              messages: nextMessages,
              lastMessage: nextMessages.at(-1)?.body ?? "",
            };
          });
        }}
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          setActiveDm(null);
          setActiveProfile(item);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          await sendJamRequest(activeDm.userId, body);
          setItems((current) =>
            current.map((entry) =>
              entry.userId === activeDm.userId ? { ...entry, jammedByMe: true } : entry,
            ),
          );
          setActiveDm(null);
          onInboxChanged();
        }}
      />
    </View>
  );
}

type JamVideoPlaybackStatus = {
  isLoaded: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
  positionMillis: number;
  status: VideoPlayerStatus;
};

function JamVideoView({
  source,
  style,
  contentFit,
  shouldPlay,
  isLooping = false,
  isMuted = false,
  volume = 1,
  nativeControls = false,
  onPlaybackStatusUpdate,
}: {
  source: string | null;
  style: StyleProp<ViewStyle>;
  contentFit: VideoContentFit;
  shouldPlay: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  nativeControls?: boolean;
  onPlaybackStatusUpdate?: (status: JamVideoPlaybackStatus) => void;
}) {
  const videoSource = useMemo<VideoSource>(() => getExpoVideoSource(source), [source]);
  const onPlaybackStatusUpdateRef = useRef(onPlaybackStatusUpdate);
  const playbackStatusRef = useRef<JamVideoPlaybackStatus>({
    isLoaded: false,
    isBuffering: Boolean(source),
    isPlaying: false,
    positionMillis: 0,
    status: "idle",
  });
  const player = useVideoPlayer(videoSource, (nextPlayer) => {
    nextPlayer.loop = isLooping;
    nextPlayer.muted = isMuted;
    nextPlayer.volume = volume;
    nextPlayer.timeUpdateEventInterval = 0.25;
    nextPlayer.audioMixingMode = "duckOthers";
    nextPlayer.staysActiveInBackground = false;
    nextPlayer.showNowPlayingNotification = false;
  });

  useEffect(() => {
    onPlaybackStatusUpdateRef.current = onPlaybackStatusUpdate;
  }, [onPlaybackStatusUpdate]);

  const emitPlaybackStatus = useCallback(
    (patch: Partial<JamVideoPlaybackStatus>) => {
      const nextStatus = {
        ...playbackStatusRef.current,
        ...patch,
      };
      playbackStatusRef.current = nextStatus;
      onPlaybackStatusUpdateRef.current?.(nextStatus);
    },
    [],
  );

  useEffect(() => {
    playbackStatusRef.current = {
      isLoaded: false,
      isBuffering: Boolean(source),
      isPlaying: false,
      positionMillis: 0,
      status: player.status,
    };
    onPlaybackStatusUpdateRef.current?.(playbackStatusRef.current);
  }, [emitPlaybackStatus, player, source]);

  useEventListener(player, "statusChange", ({ status }) => {
    emitPlaybackStatus({
      isLoaded: status === "readyToPlay",
      isBuffering: status === "loading",
      status,
    });
  });

  useEventListener(player, "playingChange", ({ isPlaying }) => {
    emitPlaybackStatus({ isPlaying });
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    emitPlaybackStatus({
      positionMillis: Math.max(0, Math.round(currentTime * 1000)),
    });
  });

  useEffect(() => {
    if (!source || !shouldPlay) {
      player.pause();
      return;
    }
    player.play();
  }, [player, shouldPlay, source]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={nativeControls}
      fullscreenOptions={{ enable: nativeControls }}
      allowsPictureInPicture={false}
    />
  );
}

function FeedItem({
  item,
  height,
  videoBottomInset,
  isActive,
  onOpenProfile,
  onLike,
  onMessage,
}: {
  item: FeedVideo;
  height: number;
  videoBottomInset: number;
  isActive: boolean;
  onOpenProfile: () => void;
  onLike: (nextSaved: boolean) => Promise<boolean>;
  onMessage: () => void;
}) {
  const source = getVideoSource(item);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(item.likedByMe);
  const [bufferingState, setBufferingState] = useState(() => ({
    source,
    loading: Boolean(source),
    buffering: false,
  }));
  const [delayedLoadingSource, setDelayedLoadingSource] = useState<string | null>(null);
  const [heartScale] = useState(() => new Animated.Value(1));
  const [jamShake] = useState(() => new Animated.Value(0));
  const connection = item.mutual ? "jamming" : item.jammedMe ? "jammed you" : null;
  const jamAlreadySent = item.jammedByMe || item.mutual;
  const jamPendingReply = item.jammedByMe && !item.mutual;
  const tags = [...item.roles, ...item.genres];
  const visibleTags = tags.length ? tags : item.categories;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLiked(item.likedByMe));
    return () => cancelAnimationFrame(frame);
  }, [item.likedByMe]);

  useEffect(() => {
    if (!source) return;
    const timer = setTimeout(() => {
      setDelayedLoadingSource(source);
    }, 1000);
    return () => clearTimeout(timer);
  }, [source]);

  function togglePlayback() {
    if (!source) return;
    setPaused((current) => !current);
  }

  function updatePlaybackStatus(status: JamVideoPlaybackStatus) {
    const nextState = status.isLoaded
      ? {
          source,
          loading: false,
          buffering: Boolean(status.isBuffering && (status.isPlaying || status.positionMillis > 0)),
        }
      : { source, loading: true, buffering: false };
    setBufferingState((current) =>
      current.source === nextState.source &&
      current.loading === nextState.loading &&
      current.buffering === nextState.buffering
        ? current
        : nextState,
    );
  }

  function runLikeAnimation() {
    heartScale.setValue(1);
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }


  function runJamShakeAnimation() {
    jamShake.stopAnimation();
    jamShake.setValue(0);
    Animated.sequence([
      Animated.timing(jamShake, {
        toValue: 1,
        duration: 55,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: -1,
        duration: 90,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: 0.7,
        duration: 80,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(jamShake, {
        toValue: 0,
        damping: 8,
        stiffness: 260,
        mass: 0.45,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function pressJam() {
    if (item.mutual) {
      onMessage();
      return;
    }

    if (jamPendingReply) {
      runJamShakeAnimation();
      return;
    }

    onMessage();
  }

  async function pressLike() {
    const nextLiked = !liked;

    setLiked(nextLiked);
    if (nextLiked) runLikeAnimation();

    const saved = await onLike(nextLiked);
    if (!saved) {
      setLiked(!nextLiked);
    }
  }

  return (
    <Pressable style={[styles.feedItem, { height }]} onPress={togglePlayback}>
      {source ? (
        <JamVideoView
          source={source}
          style={[styles.feedVideoLayer, { bottom: videoBottomInset }]}
          contentFit="cover"
          shouldPlay={isActive && !paused}
          isLooping
          isMuted={false}
          volume={1}
          onPlaybackStatusUpdate={updatePlaybackStatus}
        />
      ) : (
        <View style={[styles.feedVideoLayer, { bottom: videoBottomInset }]}>
          <View style={styles.videoPlaceholder}>
          <Avatar fallback={item.avatarFallback} size={90} />
          <Text style={styles.h2}>{item.creatorName}</Text>
          </View>
        </View>
      )}
      {source && (
        ((bufferingState.source !== source || bufferingState.loading) && delayedLoadingSource === source) ||
        (bufferingState.source === source && bufferingState.buffering)
      ) && (
        <View style={[styles.feedBufferingIndicator, { bottom: videoBottomInset }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <View style={styles.feedShade} />
      <View style={styles.feedMeta}>
        <View style={styles.row}>
          <Pressable onPress={onOpenProfile}>
            <Avatar uri={item.avatarUrl} fallback={item.avatarFallback} size={52} />
          </Pressable>
          <View style={styles.flex}>
            <View style={styles.row}>
              <Pressable onPress={onOpenProfile}>
                <Text style={styles.feedName}>{item.creatorName}</Text>
              </Pressable>
              {item.earlyAdopter && <GoldBadge />}
              {connection && <Text style={styles.badge}>{connection}</Text>}
            </View>
            <Text style={styles.feedRole}>{item.role} - {item.location}</Text>
          </View>
        </View>
        <Text style={styles.caption}>{item.caption}</Text>
        <View style={styles.tags}>
          {visibleTags.map((tag) => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={pressJam}
          style={styles.actionButton}
          accessibilityLabel={
            item.mutual
              ? `Open DM with ${item.creatorName}`
              : jamPendingReply
              ? `Jam already sent to ${item.creatorName}`
              : `Jam with ${item.creatorName}`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: jamAlreadySent }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  translateX: jamShake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-5, 0, 5],
                  }),
                },
                {
                  rotate: jamShake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: ["-7deg", "0deg", "7deg"],
                  }),
                },
              ],
            }}
          >
            <JamJarIcon filled={jamAlreadySent} />
          </Animated.View>
        </Pressable>
        <Pressable onPress={() => void pressLike()} style={styles.actionButton}>
          <Animated.Text
            style={[
              styles.actionText,
              liked && styles.actionTextActive,
              { transform: [{ scale: heartScale }] },
            ]}
          >
            {liked ? "♥" : "♡"}
          </Animated.Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function EndOfFeedState({
  filtersActive,
  height,
  onCreate,
}: {
  filtersActive: boolean;
  height: number;
  onCreate: () => void;
}) {
  return (
    <View style={[styles.endOfFeed, { height }]}>
      <Text style={styles.emptyText}>{getEndOfFeedCopy(filtersActive)}</Text>
      <Pressable style={styles.createNav} onPress={onCreate} accessibilityLabel="upload">
        <Text style={styles.createNavText}>+</Text>
      </Pressable>
    </View>
  );
}

function getEndOfFeedCopy(filtersActive: boolean) {
  return filtersActive
    ? "Try expanding your search — or be one of the first to add to this filter →"
    : "The feed is just getting started — be one of the first faces people see";
}

function FilterSheet({
  visible,
  selectedRoles,
  selectedGenres,
  selectedLocation,
  onClose,
  onApply,
}: {
  visible: boolean;
  selectedRoles: string[];
  selectedGenres: string[];
  selectedLocation: string;
  onClose: () => void;
  onApply: (roles: string[], genres: string[], location: string) => void;
}) {
  const [roles, setRoles] = useState(selectedRoles);
  const [genres, setGenres] = useState(selectedGenres);
  const [roleQuery, setRoleQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const [location, setLocation] = useState(selectedLocation);
  const [locationQuery, setLocationQuery] = useState(selectedLocation);
  const [mounted, setMounted] = useState(visible);
  const [translateY] = useState(() => new Animated.Value(-viewportHeight));
  const closingRef = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      closingRef.current = false;
      setMounted(true);
      setRoles(selectedRoles);
      setGenres(selectedGenres);
      setLocation(selectedLocation);
      setLocationQuery(selectedLocation);
      setRoleQuery("");
      setGenreQuery("");
      translateY.setValue(-viewportHeight);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedGenres, selectedLocation, selectedRoles, translateY, visible]);

  function closeWithAnimation(onComplete = onClose) {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateY, {
      toValue: -viewportHeight,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setMounted(false);
      closingRef.current = false;
      onComplete();
    });
  }

  const roleMatches = useSuggestions(creatorRoles, roleQuery, roles);
  const genreMatches = useSuggestions(musicGenres, genreQuery, genres);
  const locationMatches = useSuggestions(locationSuggestions, locationQuery, location ? [location] : []);

  if (!mounted) return null;

  return (
    <Modal animationType="none" visible={mounted} transparent onRequestClose={() => closeWithAnimation()}>
      <Pressable style={styles.modalShade} onPress={() => closeWithAnimation()} />
      <Animated.View
        style={[
          styles.topSheet,
          {
            paddingTop: Math.max(insets.top + 18, 34),
            maxHeight: viewportHeight - Math.max(insets.bottom + 12, 24),
            transform: [{ translateY }],
          },
        ]}
      >
        <ScrollView
          style={styles.topSheetScroll}
          contentContainerStyle={styles.topSheetScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel label="role" />
          <ChipRow items={roles} onRemove={(item) => setRoles((current) => current.filter((role) => role !== item))} />
          <TextInput value={roleQuery} onChangeText={setRoleQuery} placeholder="type to filter roles..." placeholderTextColor="#71717a" style={styles.input} />
          <SuggestionList items={roleMatches} maxVisibleItems={3} onPick={(role) => {
            setRoles((current) => [...current, role]);
            setRoleQuery("");
          }} />
          <Text style={styles.helper}>{roles.length === 0 ? "no role selection" : ""}</Text>
          <SectionLabel label="genre" />
          <ChipRow items={genres} onRemove={(item) => setGenres((current) => current.filter((genre) => genre !== item))} />
          <TextInput value={genreQuery} onChangeText={setGenreQuery} placeholder="type to filter genres..." placeholderTextColor="#71717a" style={styles.input} />
          <SuggestionList items={genreMatches} maxVisibleItems={3} onPick={(genre) => {
            setGenres((current) => [...current, genre]);
            setGenreQuery("");
          }} />
          <Text style={styles.helper}>{genres.length === 0 ? "no genre selection" : ""}</Text>
          <SectionLabel label="location" />
          <ChipRow items={location ? [location] : []} onRemove={() => {
            setLocation("");
            setLocationQuery("");
          }} />
          <TextInput value={locationQuery} onChangeText={(value) => {
            setLocationQuery(value);
            if (!value.trim()) setLocation("");
          }} placeholder="type city or country..." placeholderTextColor="#71717a" style={styles.input} />
          <SuggestionList items={locationMatches} maxVisibleItems={3} onPick={(item) => {
            setLocation(item);
            setLocationQuery(item);
          }} />
          <Text style={styles.helper}>{location ? "" : "no selection — anywhere"}</Text>
        </ScrollView>
        <PrimaryButton label="apply" onPress={() => closeWithAnimation(() => onApply(roles, genres, location))} />
      </Animated.View>
    </Modal>
  );
}

function UserProfileModal({
  currentUserId,
  userId,
  preloadedProfile,
  savedVideoController,
  onClose,
  onMessage,
  onUnjammed,
  inline,
}: {
  currentUserId: string;
  userId: string | null;
  preloadedProfile?: PreloadedUserProfile | null;
  savedVideoController: SavedVideoController;
  onClose: () => void;
  onMessage: (item: FeedVideo) => void;
  onUnjammed?: (userId: string) => void;
  inline?: boolean;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likedMe, setLikedMe] = useState(false);
  const [relationshipOverride, setRelationshipOverride] = useState<{
    userId: string;
    likedByMe: boolean;
    likedMe: boolean;
  } | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!userId) return;
    if (preloadedProfile?.userId === userId) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void Promise.all([
        fetchCreatorProfile(userId),
        fetchCreatorVideos(userId),
        fetchRelationshipState(currentUserId, userId),
      ])
        .then(([nextProfile, nextVideos, relationship]) => {
          if (!active) return;
          setProfile(nextProfile);
          setVideos(nextVideos);
          setLikedByMe(relationship.likedByMe);
          setLikedMe(relationship.likedMe);
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
  const visibleVideos = preloadedMatches ? preloadedProfile.videos : videos;
  const { savedVideoIds, setVideoSaved } = savedVideoController;
  const baseLikedByMe = preloadedMatches ? preloadedProfile.likedByMe : likedByMe;
  const baseLikedMe = preloadedMatches ? preloadedProfile.likedMe : likedMe;
  const activeRelationshipOverride =
    relationshipOverride?.userId === userId ? relationshipOverride : null;
  const visibleLikedByMe = activeRelationshipOverride?.likedByMe ?? baseLikedByMe;
  const visibleLikedMe = activeRelationshipOverride?.likedMe ?? baseLikedMe;
  const visibleLoading = preloadedMatches ? false : loading;
  const visibleError = preloadedMatches ? null : error;
  const displayName = visibleProfile?.display_name ?? "creator";
  const initials = getInitials(displayName, visibleProfile?.first_name, visibleProfile?.last_name);
  const canUnjam = visibleLikedByMe;
  const visibleFeedVideos = visibleProfile
    ? visibleVideos.map((video) =>
        profileToFeedVideo(
          visibleProfile,
          video,
          savedVideoIds.has(video.id),
          visibleLikedByMe,
          visibleLikedMe,
        ),
      )
    : [];
  const profileFeedItem = visibleProfile
    ? visibleFeedVideos[0] ??
      profileToFeedVideo(
        visibleProfile,
        undefined,
        false,
        visibleLikedByMe,
        visibleLikedMe,
      )
    : null;

  function confirmUnjam() {
    if (!userId) return;

    setMenuOpen(false);
    Alert.alert("Are you sure you want to unjam?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: "destructive",
        onPress: () => {
          void removeJamConnection(userId)
            .then(() => {
              setLikedByMe(false);
              setLikedMe(false);
              setRelationshipOverride({ userId, likedByMe: false, likedMe: false });
              onUnjammed?.(userId);
            })
            .catch((err) => {
              Alert.alert("could not unjam", err instanceof Error ? err.message : "try again");
            });
        },
      },
    ]);
  }

  const profileScreen = (
    <SwipeBackSurface resetKey={userId} onBack={onClose} style={styles.flex} enterFromRight>
      <View style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              { paddingTop: Math.max(insets.top + 18, 28) },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.logoSmall}>jam.</Text>
              <View>
                <Pressable
                  style={styles.iconCircle}
                  onPress={() => setMenuOpen((current) => !current)}
                  accessibilityLabel="profile options"
                >
                  <Text style={styles.iconText}>⋯</Text>
                </Pressable>
                {menuOpen && (
                  <View style={styles.profileMenu}>
                    {canUnjam ? (
                      <Pressable style={styles.profileMenuItem} onPress={confirmUnjam}>
                        <Text style={styles.profileMenuDangerText}>Unjam</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.profileMenuItem}>
                        <Text style={styles.profileMenuMutedText}>more options soon</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {visibleLoading ? (
              <ActivityIndicator color="#fff" style={styles.loader} />
            ) : visibleProfile ? (
              <>
                <View style={styles.profileCentered}>
                  <Avatar uri={visibleProfile.avatar_url} fallback={initials} size={78} />
                  <View style={styles.centerRow}>
                    <Text style={styles.h2}>{displayName}</Text>
                    {visibleProfile.early_adopter && <GoldBadge />}
                  </View>
                  <Text style={styles.subtitle}>
                    {(visibleProfile.creator_types ?? []).join(", ") || "creator"}
                    {visibleProfile.location ? ` - ${visibleProfile.location}` : ""}
                  </Text>
                  <Text style={styles.copyCentered}>{visibleProfile.bio || "no bio yet."}</Text>
                </View>
                <View>
                  <ProfileLikeButton
                    label="jam"
                    jamming={visibleLikedByMe && visibleLikedMe}
                    onPress={() => {
                      if (profileFeedItem) onMessage(profileFeedItem);
                    }}
                  />
                </View>
                <View style={styles.profileVideoDivider} />
                <VideoGrid
                  videos={visibleFeedVideos}
                  onVideoPress={(_video, index) => setFullscreenIndex(index)}
                />
              </>
            ) : (
              <EmptyCard text={visibleError ?? "profile unavailable."} />
            )}
          </ScrollView>
          {visibleProfile && (
            <ProfileVideoFullscreenModal
              visible={fullscreenIndex !== null}
              videos={visibleFeedVideos}
              initialIndex={fullscreenIndex ?? 0}
              owner={{
                creatorName: displayName,
                role: visibleProfile.creator_types?.[0] ?? "creator",
                location: visibleProfile.location ?? "unknown",
                avatarUrl: visibleProfile.avatar_url,
                avatarFallback: initials,
                earlyAdopter: Boolean(visibleProfile.early_adopter),
              }}
              liked={Boolean(visibleFeedVideos[fullscreenIndex ?? 0]?.likedByMe)}
              presentation="overlay"
              onClose={() => setFullscreenIndex(null)}
              getLikedForVideo={(video) => savedVideoIds.has(video.id)}
              onLike={(video, nextSaved) => {
                void setVideoSaved(video.id, nextSaved);
              }}
              onMessage={(video) => {
                const feedItem = profileVideoToFeedVideo(video) ?? profileFeedItem;
                if (feedItem) {
                  setFullscreenIndex(null);
                  onMessage(feedItem);
                }
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
    </>
  );
}

function ProfileVideoFullscreenModal({
  visible,
  videos,
  initialIndex,
  owner,
  liked,
  presentation = "modal",
  onClose,
  onLike,
  onMessage,
  getLikedForVideo,
  getOwnerForVideo,
  ownVideoActions,
}: {
  visible: boolean;
  videos: Array<ProfileVideo | FeedVideo>;
  initialIndex: number;
  owner: {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    avatarFallback: string;
    earlyAdopter: boolean;
  };
  liked: boolean;
  presentation?: "modal" | "overlay";
  onClose: () => void;
  onLike: (video: ProfileVideo | FeedVideo, nextSaved: boolean) => void;
  onMessage: (video: ProfileVideo | FeedVideo) => void;
  getLikedForVideo?: (video: ProfileVideo | FeedVideo) => boolean;
  ownVideoActions?: {
    onDelete: (video: ProfileVideo | FeedVideo) => void;
  };
  getOwnerForVideo?: (video: ProfileVideo | FeedVideo) => {
    creatorName: string;
    role: string;
    location: string;
    avatarUrl: string | null;
    avatarFallback: string;
    earlyAdopter: boolean;
  };
}) {
  const wasVisibleRef = useRef(false);
  const [index, setIndex] = useState(initialIndex);
  const [sessionVideos, setSessionVideos] = useState<Array<ProfileVideo | FeedVideo>>(videos);
  const [likedLocal, setLikedLocal] = useState(liked);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileBufferingState, setProfileBufferingState] = useState<{
    source: string | null;
    loading: boolean;
    buffering: boolean;
  }>({ source: null, loading: false, buffering: false });
  const [delayedProfileLoadingSource, setDelayedProfileLoadingSource] = useState<string | null>(null);
  const [translateX] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(0));
  const [translateYCorrection] = useState(() => new Animated.Value(0));
  const [heartScale] = useState(() => new Animated.Value(1));
  const [jamShake] = useState(() => new Animated.Value(0));
  const activeVideos = visible ? sessionVideos : videos;
  const video = activeVideos[index] ?? activeVideos[0];
  const previousVideo = index > 0 ? activeVideos[index - 1] : null;
  const nextVideo = index < activeVideos.length - 1 ? activeVideos[index + 1] : null;
  const source = video ? getGridVideoSource(video) : null;
  const fullscreenCells = [
    previousVideo ? { video: previousVideo, offset: -viewportHeight } : null,
    video ? { video, offset: 0 } : null,
    nextVideo ? { video: nextVideo, offset: viewportHeight } : null,
  ].filter((cell): cell is { video: ProfileVideo | FeedVideo; offset: number } => Boolean(cell));
  const currentOwner = video && getOwnerForVideo ? getOwnerForVideo(video) : owner;
  const currentFeedItem = video ? profileVideoToFeedVideo(video) : null;
  const connection = currentFeedItem?.mutual ? "jamming" : currentFeedItem?.jammedMe ? "jammed you" : null;
  const hasCurrentSentJam = Boolean(currentFeedItem && hasSentJam(currentFeedItem));
  const currentPendingSentJam = Boolean(currentFeedItem && isPendingSentJam(currentFeedItem));
  const animatedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, viewportWidth],
        outputRange: [0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );
  const animatedTranslateY = useMemo(
    () =>
      Animated.add(translateYCorrection, translateY.interpolate({
        inputRange: [-viewportHeight, viewportHeight],
        outputRange: [-viewportHeight, viewportHeight],
        extrapolate: "clamp",
      })),
    [translateY, translateYCorrection],
  );
  const handleGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: translateX, translationY: translateY } }], {
        useNativeDriver: true,
      }),
    [translateX, translateY],
  );

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) return;

    wasVisibleRef.current = true;
    const frame = requestAnimationFrame(() => {
      setSessionVideos(videos);
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(videos.length - 1, 0)));
      const initialVideo = videos[initialIndex];
      setLikedLocal(initialVideo ? getLikedForVideo?.(initialVideo) ?? liked : liked);
      setPaused(false);
      setMenuOpen(false);
      translateX.setValue(0);
      translateY.setValue(0);
      translateYCorrection.setValue(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [getLikedForVideo, initialIndex, liked, translateX, translateY, translateYCorrection, videos, visible]);

  useEffect(() => {
    if (!visible || !video) return;
    const frame = requestAnimationFrame(() => {
      setLikedLocal(getLikedForVideo?.(video) ?? liked);
      setMenuOpen(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [getLikedForVideo, index, liked, video, visible]);

  useEffect(() => {
    if (!visible || !source) return;
    const timer = setTimeout(() => {
      setDelayedProfileLoadingSource(source);
    }, 1000);
    return () => clearTimeout(timer);
  }, [source, visible]);

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;

    const { translationX, translationY, velocityY } = event.nativeEvent;
    if (state === State.CANCELLED || state === State.FAILED) {
      translateYCorrection.setValue(0);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const isHorizontalBackGesture = translationX > 0 && Math.abs(translationY) < 110;
    if (isHorizontalBackGesture) {
      if (translationX >= viewportWidth / 2) {
        Animated.timing(translateX, {
          toValue: viewportWidth,
          duration: 170,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(onClose);
        return;
      }

      translateYCorrection.setValue(0);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 230,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    translateX.setValue(0);

    const shouldMove = Math.abs(translationY) > 70 || Math.abs(velocityY) > 520;
    if (!shouldMove) {
      translateYCorrection.setValue(0);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        stiffness: 230,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }

    const nextIndex = translationY < 0 || velocityY < -520
      ? Math.min(index + 1, Math.max(activeVideos.length - 1, 0))
      : Math.max(index - 1, 0);

    if (nextIndex === index) {
      translateYCorrection.setValue(0);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        stiffness: 230,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }

    const finalOffset = nextIndex > index ? -viewportHeight : viewportHeight;

    Animated.timing(translateY, {
      toValue: finalOffset,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      translateYCorrection.setValue(-finalOffset);
      setIndex(nextIndex);
      requestAnimationFrame(() => {
        translateY.setValue(0);
        translateYCorrection.setValue(0);
      });
    });
  }

  function pressLike() {
    if (!video) return;
    const nextLiked = !likedLocal;
    setLikedLocal(nextLiked);
    setSessionVideos((current) =>
      current.map((entry) =>
        entry.id === video.id
          ? {
              ...entry,
              likedByMe: nextLiked,
            }
          : entry,
      ),
    );
    if (nextLiked) runLikeAnimation();
    onLike(video, nextLiked);
  }

  function togglePlayback() {
    if (!source) return;
    setPaused((current) => !current);
  }

  function updateProfilePlaybackStatus(status: JamVideoPlaybackStatus) {
    const nextState = status.isLoaded
      ? {
          source,
          loading: false,
          buffering: Boolean(status.isBuffering && (status.isPlaying || status.positionMillis > 0)),
        }
      : { source, loading: true, buffering: false };
    setProfileBufferingState((current) =>
      current.source === nextState.source &&
      current.loading === nextState.loading &&
      current.buffering === nextState.buffering
        ? current
        : nextState,
    );
  }

  function runLikeAnimation() {
    heartScale.setValue(1);
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.26,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        damping: 9,
        stiffness: 260,
        mass: 0.6,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function runJamShakeAnimation() {
    jamShake.stopAnimation();
    jamShake.setValue(0);
    Animated.sequence([
      Animated.timing(jamShake, {
        toValue: 1,
        duration: 55,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: -1,
        duration: 90,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jamShake, {
        toValue: 0.7,
        duration: 80,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(jamShake, {
        toValue: 0,
        damping: 8,
        stiffness: 260,
        mass: 0.45,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function pressJam() {
    if (!video) return;

    if (currentPendingSentJam) {
      runJamShakeAnimation();
      return;
    }

    onMessage(video);
  }

  if (!visible) return null;

  const content = (
      <PanGestureHandler
        minDist={20}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleGestureStateChange}
      >
        <Animated.View
          style={[
            styles.fullscreenVideoRoot,
            { transform: [{ translateX: animatedTranslateX }, { translateY: animatedTranslateY }] },
          ]}
        >
          {fullscreenCells.map((cell) => {
            const cellSource = getGridVideoSource(cell.video);
            const isCurrentCell = cell.offset === 0;
            return (
              <View
                key={cell.video.id}
                pointerEvents={isCurrentCell ? "auto" : "none"}
                style={[styles.fullscreenAdjacentVideo, { top: cell.offset }]}
              >
                {cellSource ? (
                  <JamVideoView
                    key={`${cell.video.id}-${isCurrentCell ? "current" : "adjacent"}`}
                    source={cellSource}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    shouldPlay={isCurrentCell && !paused}
                    isLooping
                    isMuted={!isCurrentCell}
                    volume={isCurrentCell ? 1 : 0}
                    onPlaybackStatusUpdate={isCurrentCell ? updateProfilePlaybackStatus : undefined}
                  />
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <Avatar uri={currentOwner.avatarUrl} fallback={currentOwner.avatarFallback} size={90} />
                    <Text style={styles.h2}>{currentOwner.creatorName}</Text>
                    <Text style={styles.helper}>video unavailable</Text>
                  </View>
                )}
              </View>
            );
          })}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => void togglePlayback()} />
          {source && (
            ((profileBufferingState.source !== source || profileBufferingState.loading) && delayedProfileLoadingSource === source) ||
            (profileBufferingState.source === source && profileBufferingState.buffering)
          ) && (
            <View pointerEvents="none" style={styles.videoBufferingIndicator}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <View style={styles.feedShade} pointerEvents="none" />
          <View style={styles.feedMeta}>
            <View style={styles.row}>
              <Avatar uri={currentOwner.avatarUrl} fallback={currentOwner.avatarFallback} size={52} />
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text style={styles.feedName}>{currentOwner.creatorName}</Text>
                  {currentOwner.earlyAdopter && <GoldBadge />}
                  {connection && <Text style={styles.badge}>{connection}</Text>}
                </View>
                <Text style={styles.feedRole}>{currentOwner.role} - {currentOwner.location}</Text>
              </View>
            </View>
            <Text style={styles.caption}>{video ? getVideoCaption(video) : "video"}</Text>
          </View>
          <View style={styles.actions}>
            {ownVideoActions ? (
              <View>
                <Pressable onPress={() => setMenuOpen((current) => !current)} style={styles.actionButton}>
                  <Text style={styles.actionText}>⋯</Text>
                </Pressable>
                {menuOpen && video && (
                  <View style={styles.videoMenu}>
                    <Pressable
                      style={styles.videoMenuItem}
                      onPress={() => {
                        setMenuOpen(false);
                        ownVideoActions.onDelete(video);
                      }}
                    >
                      <Text style={styles.videoMenuDangerText}>delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : (
              <>
                <Pressable
                  onPress={pressJam}
                  style={styles.actionButton}
                  accessibilityLabel={
                    currentFeedItem?.mutual
                      ? `Open DM with ${currentOwner.creatorName}`
                      : currentPendingSentJam
                        ? `Jam already sent to ${currentOwner.creatorName}`
                        : `Jam with ${currentOwner.creatorName}`
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: hasCurrentSentJam }}
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          translateX: jamShake.interpolate({
                            inputRange: [-1, 0, 1],
                            outputRange: [-5, 0, 5],
                          }),
                        },
                        {
                          rotate: jamShake.interpolate({
                            inputRange: [-1, 0, 1],
                            outputRange: ["-7deg", "0deg", "7deg"],
                          }),
                        },
                      ],
                    }}
                  >
                    <JamJarIcon filled={hasCurrentSentJam} />
                  </Animated.View>
                </Pressable>
                <Pressable onPress={pressLike} style={styles.actionButton}>
                  <Animated.Text
                    style={[
                      styles.actionText,
                      likedLocal && styles.actionTextActive,
                      { transform: [{ scale: heartScale }] },
                    ]}
                  >
                    {likedLocal ? "♥" : "♡"}
                  </Animated.Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </PanGestureHandler>
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

function DmModal({
  item,
  onClose,
  onOpenProfile,
  onSend,
}: {
  item: FeedVideo | null;
  onClose: () => void;
  onOpenProfile: (item: FeedVideo) => void;
  onSend: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBody(""), 0);
    return () => clearTimeout(timer);
  }, [item]);
  if (!item) return null;

  async function submit() {
    setSending(true);
    try {
      await onSend(body.trim());
    } catch (err) {
      Alert.alert("could not send", err instanceof Error ? err.message : "try again");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal animationType="fade" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.jamPromptOverlay}
      >
        <Pressable style={styles.jamPromptShade} onPress={onClose} />
        <View style={styles.jamPromptCard}>
          <View style={styles.row}>
            <Pressable onPress={() => onOpenProfile(item)} accessibilityLabel={`open ${item.creatorName}'s profile`}>
              <Avatar uri={item.avatarUrl} fallback={item.avatarFallback} size={44} />
            </Pressable>
            <View>
              <Text style={styles.cardTitle}>jam with {item.creatorName}</Text>
              <Text style={styles.helper}>{item.role} - {item.location}</Text>
            </View>
          </View>
          <TextInput
            value={body}
            onChangeText={(value) => setBody(value.slice(0, 200))}
            placeholder="introduce yourself and suggest a collab idea"
            placeholderTextColor="#71717a"
            multiline
            maxLength={200}
            style={[styles.input, styles.textArea]}
          />
          <Text style={styles.charCount}>{body.length}/200</Text>
          <View style={styles.twoCol}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>cancel</Text>
            </Pressable>
            <PrimaryButton label={sending ? "sending..." : "send"} disabled={sending} onPress={submit} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CreateScreen({
  userId,
  onClose,
  onPosted,
}: {
  userId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [asset, setAsset] = useState<NativeVideoAsset | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const maxDuration = profile?.early_adopter ? PRO_MAX_SECONDS : FREE_MAX_SECONDS;

  useEffect(() => {
    void fetchProfile(userId).then(setProfile);
  }, [userId]);

  async function pickVideo(source: "camera" | "library") {
    logVideoUploadStep("picker permission request start", { source });
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    logVideoUploadStep("picker permission result", {
      source,
      granted: permission.granted,
      status: permission.status,
      canAskAgain: permission.canAskAgain,
    });
    if (!permission.granted) {
      Alert.alert("permission needed", "camera and media permissions are needed to post.");
      return;
    }

    logVideoUploadStep("picker launch start", { source, maxDuration });
    let result: ImagePicker.ImagePickerResult;
    try {
      result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["videos"] as ImagePicker.MediaType[],
              videoMaxDuration: maxDuration,
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["videos"] as ImagePicker.MediaType[],
              videoMaxDuration: maxDuration,
              quality: 0.8,
            });
    } catch (err) {
      logVideoUploadStep("picker launch failed", {
        source,
        ...getVideoUploadErrorDetails(err),
      });
      throw err;
    }

    logVideoUploadStep("picker launch result", {
      source,
      canceled: result.canceled,
      assetCount: result.canceled ? 0 : result.assets.length,
    });
    if (result.canceled) {
      logVideoUploadStep("picker canceled", { source });
      return;
    }
    const picked = result.assets[0];
    if (!picked?.uri) {
      logVideoUploadStep("picker missing asset uri", { source });
      return;
    }

    const nextAsset = {
      uri: picked.uri,
      fileName: picked.fileName ?? picked.uri.split("/").pop() ?? "jam-video.mp4",
      mimeType: picked.mimeType ?? "video/mp4",
      fileSize: picked.fileSize ?? null,
    };
    logVideoUploadStep("picker asset selected", {
      source,
      fileName: nextAsset.fileName,
      fileSize: nextAsset.fileSize,
      mimeType: nextAsset.mimeType,
      uriScheme: nextAsset.uri.split(":")[0] || "unknown",
      duration: picked.duration ?? null,
      width: picked.width ?? null,
      height: picked.height ?? null,
    });
    setAsset(nextAsset);
    setStreamId(null);
    await upload(nextAsset);
  }

  async function upload(nextAsset: NativeVideoAsset) {
    logVideoUploadStep("upload flow start", {
      fileName: nextAsset.fileName,
      fileSize: nextAsset.fileSize ?? null,
      mimeType: nextAsset.mimeType,
      maxDuration,
    });
    setUploading(true);
    setProgress(0);
    try {
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          logVideoUploadStep("cloudflare upload attempt start", { attempt });
          const uploadRequest = await createStreamUpload(maxDuration);
          logVideoUploadStep("cloudflare upload request created", {
            attempt,
            cloudflareStreamId: uploadRequest.cloudflareStreamId,
            maxDurationSeconds: uploadRequest.maxDurationSeconds,
            uploadHost: (() => {
              try {
                return new URL(uploadRequest.uploadUrl).host;
              } catch {
                return "invalid-url";
              }
            })(),
          });
          await uploadToCloudflare(uploadRequest.uploadUrl, nextAsset, setProgress);
          setStreamId(uploadRequest.cloudflareStreamId);
          logVideoUploadStep("upload flow success", {
            attempt,
            cloudflareStreamId: uploadRequest.cloudflareStreamId,
          });
          return;
        } catch (err) {
          lastError = err;
          logVideoUploadStep("cloudflare upload attempt failed", {
            attempt,
            ...getVideoUploadErrorDetails(err),
          });
          if (attempt === 1) setProgress(0);
        }
      }
      throw lastError;
    } catch (err) {
      logVideoUploadStep("upload flow failed", getVideoUploadErrorDetails(err));
      Alert.alert("upload failed", err instanceof Error ? err.message : "try again");
    } finally {
      logVideoUploadStep("upload flow finished", { streamIdReady: Boolean(streamId) });
      setUploading(false);
    }
  }

  function toggleLimitedTag(tag: string, selected: string[], setSelected: Dispatch<SetStateAction<string[]>>, label: string) {
    if (selected.includes(tag)) {
      setSelected((current) => current.filter((item) => item !== tag));
      return;
    }

    if (selected.length >= MAX_VIDEO_TAGS_PER_GROUP) {
      Alert.alert(`maximum ${label}s`, `choose up to ${MAX_VIDEO_TAGS_PER_GROUP} ${label}s for this video.`);
      return;
    }

    setSelected((current) => [...current, tag]);
  }

  async function post() {
    logVideoUploadStep("post submission start", {
      hasStreamId: Boolean(streamId),
      captionLength: caption.trim().length,
      roleCount: selectedRoles.length,
      genreCount: selectedGenres.length,
    });
    if (!streamId) {
      logVideoUploadStep("post submission blocked", { reason: "missing-stream-id" });
      return;
    }
    if (selectedRoles.length === 0 && selectedGenres.length === 0) {
      logVideoUploadStep("post submission blocked", { reason: "missing-tags" });
      Alert.alert("choose tags", "select at least one role or genre for this video.");
      return;
    }
    setPosting(true);
    try {
      logVideoUploadStep("database video create start", {
        cloudflareStreamId: streamId,
        roleCount: selectedRoles.length,
        genreCount: selectedGenres.length,
      });
      await createVideo({
        userId,
        caption: caption.trim(),
        roles: selectedRoles,
        genres: selectedGenres,
        cloudflareStreamId: streamId,
      });
      logVideoUploadStep("database video create success", { cloudflareStreamId: streamId });
      setAsset(null);
      setStreamId(null);
      setCaption("");
      setSelectedRoles([]);
      setSelectedGenres([]);
      logVideoUploadStep("post submission success", { cloudflareStreamId: streamId });
      onPosted();
    } catch (err) {
      logVideoUploadStep("post submission failed", getVideoUploadErrorDetails(err));
      Alert.alert("could not post", err instanceof Error ? err.message : "try again");
    } finally {
      logVideoUploadStep("post submission finished", { wasPosting: true });
      setPosting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.logoSmall}>jam.</Text>
          <Pressable onPress={onClose} style={styles.iconCircle} accessibilityLabel="close create screen">
            <Text style={styles.closeIconText}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.h1}>create</Text>
        <Text style={styles.copy}>record something raw, or choose a video from your camera roll.</Text>
        <View style={styles.twoCol}>
          <PrimaryButton label="camera" onPress={() => void pickVideo("camera")} />
          <Pressable style={styles.secondaryButton} onPress={() => void pickVideo("library")}>
            <Text style={styles.secondaryButtonText}>camera roll</Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>{maxDuration}s max for this account</Text>
        {asset && !uploading && (
          <View style={styles.previewBox}>
            <JamVideoView
              source={asset.uri}
              style={styles.previewVideo}
              contentFit="contain"
              shouldPlay={false}
              nativeControls
            />
          </View>
        )}
        {uploading && (
          <View>
            <Text style={styles.copy}>uploading video</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.helper}>{progress}%</Text>
          </View>
        )}
        <TextInput value={caption} onChangeText={setCaption} placeholder="write a caption..." placeholderTextColor="#71717a" style={[styles.input, styles.textArea]} multiline maxLength={200} />
        <SectionLabel label={`roles (${selectedRoles.length}/${MAX_VIDEO_TAGS_PER_GROUP})`} />
        <Text style={styles.helper}>choose up to {MAX_VIDEO_TAGS_PER_GROUP} roles for this video.</Text>
        <TagPicker
          options={creatorRoles}
          selected={selectedRoles}
          onToggle={(role) => toggleLimitedTag(role, selectedRoles, setSelectedRoles, "role")}
        />
        <SectionLabel label={`genres (${selectedGenres.length}/${MAX_VIDEO_TAGS_PER_GROUP})`} />
        <Text style={styles.helper}>choose up to {MAX_VIDEO_TAGS_PER_GROUP} genres for this video.</Text>
        <TagPicker
          options={musicGenres}
          selected={selectedGenres}
          onToggle={(genre) => toggleLimitedTag(genre, selectedGenres, setSelectedGenres, "genre")}
        />
        <PrimaryButton label={posting ? "posting..." : "post"} disabled={posting || !streamId || (selectedRoles.length === 0 && selectedGenres.length === 0)} onPress={post} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InboxScreen({
  userId,
  refreshSignal,
  savedVideoController,
  onUnreadCountChanged,
}: {
  userId: string;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  onUnreadCountChanged: (count: number) => void;
}) {
  const [tab, setTab] = useState<InboxTab>("requests");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [jams, setJams] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [system, setSystem] = useState<InboxMessage[]>([]);
  const [removedInboxUserIds, setRemovedInboxUserIds] = useState<Set<string>>(() => new Set());
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [activeRequest, setActiveRequest] = useState<InboxRequest | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [preloadedProfile, setPreloadedProfile] = useState<PreloadedUserProfile | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const profilePreloadCacheRef = useRef(new Map<string, PreloadedUserProfile>());
  const profileNavigationRequestRef = useRef(0);

  const load = useCallback(async () => {
    const data = await fetchInbox(userId);
    const nextRequests = data.requests.filter((request) => !removedInboxUserIds.has(request.userId));
    const nextJams = data.conversations.filter((conversation) => !removedInboxUserIds.has(conversation.userId));
    const nextSent = data.sent.filter((conversation) => !removedInboxUserIds.has(conversation.userId));
    setRequests(nextRequests);
    setJams(nextJams);
    setSent(nextSent);
    setSystem(data.systemMessages);
    onUnreadCountChanged(getUnreadInboxCount({
      requests: nextRequests,
      conversations: nextJams,
      sent: nextSent,
      systemMessages: data.systemMessages,
    }));
  }, [onUnreadCountChanged, removedInboxUserIds, userId]);

  function removeUserFromInbox(removedUserId: string) {
    setRemovedInboxUserIds((current) => new Set(current).add(removedUserId));
    setRequests((current) => current.filter((request) => request.userId !== removedUserId));
    setJams((current) => current.filter((conversation) => conversation.userId !== removedUserId));
    setSent((current) => current.filter((conversation) => conversation.userId !== removedUserId));
    setActiveChat((current) =>
      current && !("sender_name" in current) && current.userId === removedUserId ? null : current,
    );
    setActiveDm((current) => (current?.userId === removedUserId ? null : current));
    setProfileUserId(null);
    setPreloadedProfile(null);
    profilePreloadCacheRef.current.delete(removedUserId);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load, refreshSignal]);

  const preloadProfile = useCallback(async (targetUserId: string) => {
    const cached = profilePreloadCacheRef.current.get(targetUserId);
    if (cached) return cached;

    const [profile, videos, relationship] = await Promise.all([
      fetchCreatorProfile(targetUserId),
      fetchCreatorVideos(targetUserId),
      fetchRelationshipState(userId, targetUserId),
    ]);
    const nextPreloadedProfile = {
      userId: targetUserId,
      profile,
      videos,
      likedByMe: relationship.likedByMe,
      likedMe: relationship.likedMe,
    };

    profilePreloadCacheRef.current.set(targetUserId, nextPreloadedProfile);
    return nextPreloadedProfile;
  }, [userId]);

  useEffect(() => {
    if (!activeChat || "sender_name" in activeChat) return;
    void preloadProfile(activeChat.userId).catch(() => undefined);
  }, [activeChat, preloadProfile]);

  async function openProfile(nextUserId: string | null | undefined) {
    try {
      const targetUserId = nextUserId?.trim();
      if (!targetUserId) {
        throw new Error("Profile is unavailable.");
      }

      const requestId = profileNavigationRequestRef.current + 1;
      profileNavigationRequestRef.current = requestId;

      setActiveRequest(null);
      setActiveDm(null);
      setPreloadedProfile(profilePreloadCacheRef.current.get(targetUserId) ?? null);
      setProfileUserId(targetUserId);

      const nextPreloadedProfile = await preloadProfile(targetUserId);
      if (profileNavigationRequestRef.current === requestId) {
        setPreloadedProfile(nextPreloadedProfile);
      }
    } catch (err) {
      Alert.alert("could not open profile", err instanceof Error ? err.message : "try again");
    }
  }

  function openJamFromProfile(profileFeedItem: FeedVideo) {
    setProfileUserId(null);
    setPreloadedProfile(null);

    const existingConversation =
      jams.find((conversation) => conversation.userId === profileFeedItem.userId) ??
      sent.find((conversation) => conversation.userId === profileFeedItem.userId);

    if (profileFeedItem.mutual || profileFeedItem.jammedByMe) {
      setActiveChat(
        existingConversation ??
          conversationFromFeedItem(profileFeedItem, Boolean(profileFeedItem.mutual)),
      );
      return;
    }

    setActiveDm(profileFeedItem);
  }

  function openConversation(conversation: Conversation) {
    const removedUnreadCount = conversation.unreadCount;
    const nextConversation = { ...conversation, unread: false, unreadCount: 0 };
    setActiveChat(nextConversation);
    setJams((current) =>
      current.map((item) =>
        item.userId === conversation.userId ? { ...item, unread: false, unreadCount: 0 } : item,
      ),
    );
    setSent((current) =>
      current.map((item) =>
        item.userId === conversation.userId ? { ...item, unread: false, unreadCount: 0 } : item,
      ),
    );
    onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - removedUnreadCount));
    void markConversationRead(userId, conversation.userId).catch(() => undefined);
  }

  function openSystemMessage(message: InboxMessage) {
    const removedUnreadCount = message.read ? 0 : 1;
    const nextMessage = { ...message, read: true };
    setActiveChat(nextMessage);
    setSystem((current) =>
      current.map((item) => (item.id === message.id ? { ...item, read: true } : item)),
    );
    onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - removedUnreadCount));
    void markInboxMessageRead(message.id).catch(() => undefined);
  }

  return (
    <SafeAreaView style={styles.safeWithNav}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Text style={styles.logoSmall}>jam.</Text>
        <SegmentedTabs tabs={["requests", "jams", "sent"]} active={tab} onChange={(value) => setTab(value as InboxTab)} />
        {loading ? (
          <ActivityIndicator color="#fff" style={styles.loader} />
        ) : tab === "requests" ? (
          <View style={styles.list}>
            {requests.map((request) => (
              <Pressable key={request.id} style={styles.listCard} onPress={() => setActiveRequest(request)}>
                <Pressable onPress={() => openProfile(request.userId)} accessibilityLabel={`open ${request.creatorName}'s profile`}>
                  <Avatar uri={request.avatarUrl} fallback={request.avatarFallback} size={52} />
                </Pressable>
                <View style={styles.flex}>
                  <View style={styles.row}>
                    <Text style={styles.listTitle}>{request.creatorName}</Text>
                    {request.earlyAdopter && <GoldBadge />}
                  </View>
                  <Text style={styles.helper}>{request.role} - {request.location}</Text>
                  <Text style={styles.copy}>{request.preview}</Text>
                </View>
                <Text style={styles.helper}>{request.sentAt}</Text>
              </Pressable>
            ))}
            {requests.length === 0 && <EmptyCard text="no requests right now." />}
          </View>
        ) : tab === "jams" ? (
          <View style={styles.list}>
            {jams.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onPress={() => openConversation(conversation)}
                onOpenProfile={() => openProfile(conversation.userId)}
              />
            ))}
            {system.map((message) => (
              <SystemRow key={message.id} message={message} onPress={() => openSystemMessage(message)} />
            ))}
            {jams.length === 0 && system.length === 0 && <EmptyCard text="no jams yet. mutual likes will appear here." />}
          </View>
        ) : (
          <View style={styles.list}>
            {sent.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onPress={() => openConversation(conversation)}
                onOpenProfile={() => openProfile(conversation.userId)}
                subdued
              />
            ))}
            {sent.length === 0 && <EmptyCard text="no sent jams waiting right now." />}
          </View>
        )}
      </ScrollView>
      <RequestModal
        request={activeRequest}
        onClose={() => setActiveRequest(null)}
        onOpenProfile={(request) => openProfile(request.userId)}
        onMessage={(request) => {
          setActiveRequest(null);
          const conversation = conversationFromRequest(request);
          setActiveChat(conversation);
          setRequests((current) =>
            current.map((item) =>
              item.userId === request.userId ? { ...item, unreadCount: 0 } : item,
            ),
          );
          onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - request.unreadCount));
          void markConversationRead(userId, request.userId).catch(() => undefined);
        }}
      />
      <ChatModal
        active={activeChat}
        onClose={() => setActiveChat(null)}
        onOpenProfile={openProfile}
        onSend={async (conversation, body) => {
          const optimisticId = `local-${conversation.userId}-${Date.now()}`;
          const optimisticMessage: ChatMessage = {
            id: optimisticId,
            body,
            incoming: false,
            createdAt: new Date().toISOString(),
          };

          setActiveChat((current) => {
            if (!current || "sender_name" in current || current.userId !== conversation.userId) {
              return current;
            }

            return {
              ...current,
              lastMessage: body,
              timestamp: "now",
              unread: false,
              messages: [...current.messages, optimisticMessage],
            };
          });

          try {
            const savedMessage = conversation.unlocked
              ? await sendMessage(conversation.userId, body)
              : await sendJamRequest(conversation.userId, body);
            const unlocksFromReply = !conversation.unlocked && conversation.messages.some((message) => message.incoming);

            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              return {
                ...current,
                unlocked: current.unlocked || unlocksFromReply,
                lastMessage: savedMessage.body,
                messages: current.messages.map((message) =>
                  message.id === optimisticId
                    ? {
                        id: message.id,
                        serverId: savedMessage.id,
                        body: savedMessage.body,
                        incoming: false,
                        createdAt: savedMessage.created_at,
                      }
                    : message,
                ),
              };
            });

            await load();
            if (unlocksFromReply) setTab("jams");
          } catch (err) {
            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              const nextMessages = current.messages.filter((message) => message.id !== optimisticId);
              return {
                ...current,
                messages: nextMessages,
                lastMessage: nextMessages.at(-1)?.body ?? conversation.lastMessage,
              };
            });
            Alert.alert("could not send", err instanceof Error ? err.message : "try again");
          }
        }}
        onEditMessage={async (messageId, body) => {
          const updated = await editMessage(messageId, body);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, body: updated.body } : message,
              ),
              lastMessage: current.lastMessage === current.messages.find((message) => message.id === messageId)?.body
                ? updated.body
                : current.lastMessage,
            };
          });
          await load();
        }}
        onDeleteMessage={async (messageId) => {
          await deleteMessage(messageId);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            const nextMessages = current.messages.filter((message) => message.id !== messageId);
            return {
              ...current,
              messages: nextMessages,
              lastMessage: nextMessages.at(-1)?.body ?? "",
            };
          });
          await load();
        }}
        profileOverlay={
          activeChat && !("sender_name" in activeChat) && profileUserId ? (
            <UserProfileModal
              currentUserId={userId}
              userId={profileUserId}
              preloadedProfile={preloadedProfile}
              savedVideoController={savedVideoController}
              inline
              onClose={() => {
                setProfileUserId(null);
                setPreloadedProfile(null);
              }}
              onMessage={(profileFeedItem) => {
                openJamFromProfile(profileFeedItem);
              }}
            />
          ) : null
        }
      />
      <UserProfileModal
        currentUserId={userId}
        userId={activeChat && !("sender_name" in activeChat) ? null : profileUserId}
        preloadedProfile={preloadedProfile}
        savedVideoController={savedVideoController}
        onClose={() => {
          setProfileUserId(null);
          setPreloadedProfile(null);
        }}
        onMessage={(profileFeedItem) => {
          openJamFromProfile(profileFeedItem);
        }}
        onUnjammed={(removedUserId) => {
          removeUserFromInbox(removedUserId);
        }}
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          openProfile(item.userId);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          await sendJamRequest(activeDm.userId, body);
          setActiveDm(null);
          await load();
        }}
      />
    </SafeAreaView>
  );
}

function MyProfileScreen({
  userId,
  refreshSignal,
  savedVideoController,
  onInboxChanged,
  onProfileChanged,
  onLoggedOut,
}: {
  userId: string;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  onInboxChanged: () => void;
  onProfileChanged: (profile: Profile) => void;
  onLoggedOut: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [saved, setSaved] = useState<ProfileVideo[]>([]);
  const [activeTab, setActiveTab] = useState<"videos" | "saved">("videos");
  const [tabSlide] = useState(() => new Animated.Value(0));
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [ownFullscreenIndex, setOwnFullscreenIndex] = useState<number | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { savedVideoIds, setVideoSaved, refreshSavedVideos } = savedVideoController;

  const load = useCallback(async () => {
    const [nextProfile, ownVideos, savedVideos] = await Promise.all([
      fetchProfile(userId),
      fetchMyVideos(userId),
      fetchSavedVideos(userId),
      refreshSavedVideos(),
    ]);
    setProfile(nextProfile);
    if (nextProfile) onProfileChanged(nextProfile);
    setVideos(ownVideos);
    setSaved(savedVideos);
  }, [onProfileChanged, refreshSavedVideos, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load, refreshSignal]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const timer = setTimeout(() => {
        void load().finally(() => {
          if (active) setLoading(false);
        });
      }, 0);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [load]),
  );

  function openJamFromProfile(profileFeedItem: FeedVideo) {
    setProfileUserId(null);

    if (!profileFeedItem.jammedByMe && !profileFeedItem.mutual) {
      setActiveDm(profileFeedItem);
      return;
    }

    const fallbackConversation = conversationFromFeedItem(profileFeedItem, Boolean(profileFeedItem.mutual));
    setActiveChat(fallbackConversation);

    void (async () => {
      try {
        const inbox = await fetchInbox(userId);
        const existingConversation =
          inbox.conversations.find((conversation) => conversation.userId === profileFeedItem.userId) ??
          inbox.sent.find((conversation) => conversation.userId === profileFeedItem.userId);

        if (existingConversation) {
          setActiveChat((current) =>
            current && !("sender_name" in current) && current.userId === profileFeedItem.userId
              ? existingConversation
              : current,
          );
        }
      } catch {
        // Keep the optimistic chat open; sending will still surface any real network errors.
      }
    })();
  }

  function changeProfileTab(nextTab: "videos" | "saved") {
    if (nextTab === activeTab) return;

    const direction = nextTab === "saved" ? 1 : -1;
    tabSlide.stopAnimation();
    tabSlide.setValue(direction * viewportWidth);
    setActiveTab(nextTab);
    Animated.timing(tabSlide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  if (loading) return <LoadingScreen label="loading profile..." />;

  return (
    <View style={styles.safeWithNav}>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingTop: Math.max(insets.top + 18, 28) },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.logoSmall}>jam.</Text>
          <Pressable style={styles.iconCircle} onPress={() => setSettingsOpen(true)}>
            <Text style={styles.iconText}>≡</Text>
          </Pressable>
        </View>
        {profile ? (
          <>
            <View style={styles.profileCentered}>
              <Avatar uri={profile.avatar_url} fallback={getInitials(profile.display_name ?? "you", profile.first_name, profile.last_name)} size={78} />
              <View style={styles.centerRow}>
                <Text style={styles.h2}>{profile.display_name ?? "your profile"}</Text>
                {profile.early_adopter && <GoldBadge />}
              </View>
              <Text style={styles.subtitle}>{profile.creator_types?.join(", ") || "creator"}</Text>
              {profile.location && <Text style={styles.subtitle}>{profile.location}</Text>}
              <Text style={styles.copyCentered}>{profile.bio || "no bio yet."}</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => setEditing(true)}>
              <Text style={styles.secondaryButtonText}>edit profile</Text>
            </Pressable>
          </>
        ) : (
          <EmptyCard text="no profile found." />
        )}
        <View style={styles.profileVideoDivider} />
        <SegmentedTabs tabs={["videos", "saved"]} active={activeTab} onChange={(value) => changeProfileTab(value as "videos" | "saved")} />
        <Animated.View style={[styles.profileTabSlider, { transform: [{ translateX: tabSlide }] }]}>
          <VideoGrid
            videos={activeTab === "videos" ? videos : saved}
            privateCopy={activeTab === "saved"}
            onVideoPress={(_video, index) => {
              if (activeTab === "saved") {
                setFullscreenIndex(index);
                return;
              }
              setOwnFullscreenIndex(index);
            }}
          />
        </Animated.View>
      </ScrollView>
      {profile && (
        <ProfileVideoFullscreenModal
          visible={ownFullscreenIndex !== null}
          videos={videos}
          initialIndex={ownFullscreenIndex ?? 0}
          owner={{
            creatorName: profile.display_name ?? "you",
            role: profile.creator_types?.[0] ?? "creator",
            location: profile.location ?? "unknown",
            avatarUrl: profile.avatar_url,
            avatarFallback: getInitials(profile.display_name ?? "you", profile.first_name, profile.last_name),
            earlyAdopter: Boolean(profile.early_adopter),
          }}
          liked={false}
          onClose={() => setOwnFullscreenIndex(null)}
          onLike={() => undefined}
          onMessage={() => undefined}
          ownVideoActions={{
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
          avatarFallback: "S",
          earlyAdopter: false,
        }}
        liked
        getOwnerForVideo={getProfileVideoOwner}
        getLikedForVideo={(video) => savedVideoIds.has(video.id)}
        onClose={() => setFullscreenIndex(null)}
        onLike={(video, nextSaved) => {
          void toggleSavedProfileVideo(video, nextSaved, setSaved, setVideoSaved);
        }}
        onMessage={(video) => {
          const feedItem = profileVideoToFeedVideo(video);
          if (!feedItem) return;
          setFullscreenIndex(null);
          void openJamFromProfile(feedItem);
        }}
      />
      <ChatModal
        active={activeChat}
        onClose={() => setActiveChat(null)}
        onOpenProfile={(nextUserId) => {
          setProfileUserId(nextUserId);
        }}
        onSend={async (conversation, body) => {
          const optimisticId = `local-${conversation.userId}-${Date.now()}`;
          const optimisticMessage: ChatMessage = {
            id: optimisticId,
            body,
            incoming: false,
            createdAt: new Date().toISOString(),
          };

          setActiveChat((current) => {
            if (!current || "sender_name" in current || current.userId !== conversation.userId) {
              return current;
            }

            return {
              ...current,
              lastMessage: body,
              timestamp: "now",
              unread: false,
              messages: [...current.messages, optimisticMessage],
            };
          });

          try {
            const savedMessage = conversation.unlocked
              ? await sendMessage(conversation.userId, body)
              : await sendJamRequest(conversation.userId, body);
            const unlocksFromReply = !conversation.unlocked && conversation.messages.some((message) => message.incoming);

            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              return {
                ...current,
                unlocked: current.unlocked || unlocksFromReply,
                lastMessage: savedMessage.body,
                messages: current.messages.map((message) =>
                  message.id === optimisticId
                    ? {
                        id: message.id,
                        serverId: savedMessage.id,
                        body: savedMessage.body,
                        incoming: false,
                        createdAt: savedMessage.created_at,
                      }
                    : message,
                ),
              };
            });
            if (unlocksFromReply || !conversation.unlocked) onInboxChanged();
          } catch (err) {
            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              const nextMessages = current.messages.filter((message) => message.id !== optimisticId);
              return {
                ...current,
                messages: nextMessages,
                lastMessage: nextMessages.at(-1)?.body ?? conversation.lastMessage,
              };
            });
            Alert.alert("could not send", err instanceof Error ? err.message : "try again");
          }
        }}
        onEditMessage={async (messageId, body) => {
          const updated = await editMessage(messageId, body);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, body: updated.body } : message,
              ),
              lastMessage: current.lastMessage === current.messages.find((message) => message.id === messageId)?.body
                ? updated.body
                : current.lastMessage,
            };
          });
        }}
        onDeleteMessage={async (messageId) => {
          await deleteMessage(messageId);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            const nextMessages = current.messages.filter((message) => message.id !== messageId);
            return {
              ...current,
              messages: nextMessages,
              lastMessage: nextMessages.at(-1)?.body ?? "",
            };
          });
        }}
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
          await sendJamRequest(activeDm.userId, body);
          setActiveDm(null);
          onInboxChanged();
        }}
      />
      <UserProfileModal
        currentUserId={userId}
        userId={profileUserId}
        savedVideoController={savedVideoController}
        onClose={() => setProfileUserId(null)}
        onMessage={(profileFeedItem) => {
          void openJamFromProfile(profileFeedItem);
        }}
        onUnjammed={(removedUserId) => {
          setActiveChat((current) =>
            current && !("sender_name" in current) && current.userId === removedUserId ? null : current,
          );
          setActiveDm((current) => (current?.userId === removedUserId ? null : current));
          setProfileUserId(null);
        }}
      />
      <EditProfileModal
        visible={editing}
        profile={profile}
        onClose={() => setEditing(false)}
        onSaved={(nextProfile) => {
          setProfile(nextProfile);
          onProfileChanged(nextProfile);
          setEditing(false);
        }}
      />
      <SettingsDrawerModal
        visible={settingsOpen}
        profile={profile}
        notifications={notifications}
        onNotificationsChange={setNotifications}
        onClose={() => setSettingsOpen(false)}
        onEditProfile={() => {
          setSettingsOpen(false);
          setEditing(true);
        }}
        onLoggedOut={onLoggedOut}
      />
    </View>
  );
}

function EditProfileModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !profile) return;
    const frame = requestAnimationFrame(() => {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setCreatorTypes(profile.creator_types ?? []);
      setLocation(profile.location ?? "");
      setLocationQuery(profile.location ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    });
    return () => cancelAnimationFrame(frame);
  }, [profile, visible]);

  const roleMatches = useSuggestions(creatorRoles, creatorQuery, creatorTypes);
  const locationMatches = useSuggestions(locationSuggestions, locationQuery, location ? [location] : []);

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset?.base64) setAvatarUrl(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
      else if (asset?.uri) setAvatarUrl(asset.uri);
    }
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const nextProfile = await saveProfile(profile.id, {
        display_name: displayName.trim(),
        bio: bio.trim(),
        creator_types: creatorTypes,
        location: location.trim() || null,
        avatar_url: avatarUrl,
      });
      onSaved(nextProfile);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible} onBack={onClose} style={styles.flex}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>edit profile</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>cancel</Text>
              </Pressable>
            </View>
            <Pressable style={styles.secondaryButton} onPress={chooseAvatar}>
              <Text style={styles.secondaryButtonText}>{avatarUrl ? "change photo" : "add photo"}</Text>
            </Pressable>
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="display name" placeholderTextColor="#71717a" style={styles.input} />
            <ChipRow items={creatorTypes} onRemove={(item) => setCreatorTypes((current) => current.filter((role) => role !== item))} />
            <TextInput value={creatorQuery} onChangeText={setCreatorQuery} placeholder="search creator type" placeholderTextColor="#71717a" style={styles.input} />
            <SuggestionList items={roleMatches} onPick={(role) => {
              setCreatorTypes((current) => [...current, role]);
              setCreatorQuery("");
            }} />
            <TextInput value={bio} onChangeText={setBio} placeholder="bio" placeholderTextColor="#71717a" style={[styles.input, styles.textArea]} multiline maxLength={150} />
            <ChipRow items={location ? [location] : []} onRemove={() => {
              setLocation("");
              setLocationQuery("");
            }} />
            <TextInput value={locationQuery} onChangeText={(value) => {
              setLocationQuery(value);
              if (!value.trim()) setLocation("");
            }} placeholder="city or country" placeholderTextColor="#71717a" style={styles.input} />
            <SuggestionList items={locationMatches} onPick={(item) => {
              setLocation(item);
              setLocationQuery(item);
            }} />
            <PrimaryButton label={saving ? "saving..." : "save profile"} disabled={saving} onPress={save} />
          </ScrollView>
        </SafeAreaView>
      </SwipeBackSurface>
    </Modal>
  );
}

function SettingsDrawerModal({
  visible,
  profile,
  notifications,
  onNotificationsChange,
  onClose,
  onEditProfile,
  onLoggedOut,
}: {
  visible: boolean;
  profile: Profile | null;
  notifications: boolean;
  onNotificationsChange: (value: boolean) => void;
  onClose: () => void;
  onEditProfile: () => void;
  onLoggedOut: () => void;
}) {
  const drawerWidth = viewportWidth * 0.8;
  const [mounted, setMounted] = useState(visible);
  const [translateX] = useState(() => new Animated.Value(drawerWidth));
  const closingRef = useRef(false);
  const handleGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: translateX } }], {
        useNativeDriver: true,
      }),
    [translateX],
  );

  useEffect(() => {
    if (!visible) return;

    const frame = requestAnimationFrame(() => {
      closingRef.current = false;
      setMounted(true);
      translateX.setValue(drawerWidth);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => cancelAnimationFrame(frame);
  }, [drawerWidth, translateX, visible]);

  function closeWithAnimation() {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateX, {
      toValue: drawerWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setMounted(false);
      closingRef.current = false;
      onClose();
    });
  }

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (
      state !== State.END &&
      state !== State.CANCELLED &&
      state !== State.FAILED
    ) {
      return;
    }

    const { translationX, translationY, velocityX } = event.nativeEvent;
    const shouldClose =
      translationX > drawerWidth * 0.24 ||
      (translationX > 36 && Math.abs(translationY) < 90 && velocityX > 420);

    if (shouldClose) {
      closeWithAnimation();
      return;
    }

    Animated.spring(translateX, {
      toValue: 0,
      damping: 24,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }

  if (!mounted) return null;

  return (
    <Modal animationType="none" transparent visible={mounted} onRequestClose={closeWithAnimation}>
      <View style={styles.settingsOverlay}>
        <Pressable style={styles.settingsBackdrop} onPress={closeWithAnimation} />
        <PanGestureHandler
          activeOffsetX={24}
          failOffsetY={[-26, 26]}
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={handleGestureStateChange}
        >
          <Animated.View
            style={[
              styles.settingsDrawer,
              {
                width: drawerWidth,
                transform: [
                  {
                    translateX: translateX.interpolate({
                      inputRange: [0, drawerWidth],
                      outputRange: [0, drawerWidth],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
            <SafeAreaView style={styles.settingsPanel}>
              <Text style={styles.cardTitle}>{profile?.display_name ?? "you"}</Text>
              <Text style={styles.helper}>{profile?.creator_types?.join(", ") || "creator"}</Text>
              <SettingsButton label="edit profile" onPress={onEditProfile} />
              <View style={styles.settingsRow}>
                <Text style={styles.settingsText}>notifications</Text>
                <Switch value={notifications} onValueChange={onNotificationsChange} />
              </View>
              <SettingsButton label="privacy" />
              <SettingsButton label="download my data" />
              <SettingsButton label="delete account" />
              <SettingsButton label="report a problem" />
              <SettingsButton label="terms of service" />
              <SettingsButton label="privacy policy" />
              <Pressable style={styles.logoutButton} onPress={onLoggedOut}>
                <Text style={styles.logoutText}>log out</Text>
              </Pressable>
            </SafeAreaView>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

function ChatModal({
  active,
  onClose,
  onOpenProfile,
  onSend,
  onEditMessage,
  onDeleteMessage,
  profileOverlay,
}: {
  active: Conversation | InboxMessage | null;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onSend: (conversation: Conversation, body: string) => Promise<void>;
  onEditMessage: (messageId: string, body: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  profileOverlay?: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const [contextMessageId, setContextMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const insets = useSafeAreaInsets();
  if (!active) return null;

  const isSystem = "sender_name" in active;
  const title = isSystem ? active.sender_name : active.creatorName;
  const avatarFallback = isSystem ? active.sender_avatar ?? "jam." : active.avatarFallback;
  const avatarUri = isSystem ? null : active.avatarUrl;
  const profileUserId = isSystem ? null : active.userId;
  const messages = isSystem
    ? [{ id: active.id, body: active.body, incoming: true, createdAt: active.created_at }]
    : active.messages.length
      ? active.messages
      : [{ id: "empty", body: active.lastMessage, incoming: active.unlocked, createdAt: new Date().toISOString() }];
  const canSend = !isSystem && (active.unlocked || !active.messages.some((message) => !message.incoming));

  async function submit() {
    if (!draft.trim() || isSystem) return;
    const body = draft.trim();
    setDraft("");
    await onSend(active as Conversation, body);
  }

  function openMessageMenu(message: ChatMessage) {
    if (message.incoming) return;
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

  return (
    <Modal animationType="none" transparent visible={Boolean(active)} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={isSystem ? active.id : active.userId} onBack={onClose} style={styles.flex}>
        <View style={styles.safe}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
            <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top + 10, 18) }]}>
              <Pressable onPress={onClose} style={styles.iconCircle}>
                <Text style={styles.iconText}>‹</Text>
              </Pressable>
              {!isSystem ? (
                <Pressable
                  onPress={openActiveProfile}
                  accessibilityLabel={`open ${title}'s profile`}
                  hitSlop={10}
                  style={styles.chatProfileTarget}
                >
                  <Avatar uri={avatarUri} fallback={avatarFallback} size={44} />
                  <View>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.helper}>{canSend ? "messages unlocked" : "waiting for a jam"}</Text>
                  </View>
                </Pressable>
              ) : (
                <>
                  <Avatar fallback={avatarFallback} size={44} />
                  <View>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.helper}>system message</Text>
                  </View>
                </>
              )}
            </View>
            <ScrollView contentContainerStyle={styles.chatContent}>
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
                    <Pressable
                      disabled={message.incoming}
                      onLongPress={() => openMessageMenu(message)}
                      style={[
                        styles.bubble,
                        message.incoming ? styles.bubbleIn : styles.bubbleOut,
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
            {!isSystem && (
              <View style={styles.composer}>
                <TextInput value={draft} onChangeText={setDraft} editable={canSend} placeholder={canSend ? "message..." : "waiting for a mutual like"} placeholderTextColor="#71717a" style={[styles.input, styles.flex]} />
                <Pressable onPress={() => void submit()} disabled={!canSend} style={styles.sendButton}>
                  <Text style={styles.sendButtonText}>send</Text>
                </Pressable>
              </View>
            )}
          </KeyboardAvoidingView>
          {profileOverlay}
        </View>
      </SwipeBackSurface>
    </Modal>
  );
}

function AnimatedChatMessage({
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

function RequestModal({
  request,
  onClose,
  onOpenProfile,
  onMessage,
}: {
  request: InboxRequest | null;
  onClose: () => void;
  onOpenProfile: (request: InboxRequest) => void;
  onMessage: (request: InboxRequest) => void;
}) {
  if (!request) return null;
  return (
    <Modal animationType="none" transparent visible={Boolean(request)} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={request.id} onBack={onClose} style={styles.flex}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.screenContent}>
            <Pressable onPress={onClose} style={styles.iconCircle}>
              <Text style={styles.iconText}>‹</Text>
            </Pressable>
            <View style={styles.profileCentered}>
            <Pressable onPress={() => onOpenProfile(request)} accessibilityLabel={`open ${request.creatorName}'s profile`}>
              <Avatar uri={request.avatarUrl} fallback={request.avatarFallback} size={78} />
            </Pressable>
              <View style={styles.centerRow}>
                <Text style={styles.h2}>{request.creatorName}</Text>
                {request.earlyAdopter && <GoldBadge />}
              </View>
              <Text style={styles.subtitle}>{request.role} - {request.location}</Text>
              <Text style={styles.copyCentered}>{request.preview}</Text>
            </View>
            <PrimaryButton label="reply to jam" onPress={() => onMessage(request)} />
          </ScrollView>
        </SafeAreaView>
      </SwipeBackSurface>
    </Modal>
  );
}

function JamTabBar({
  state,
  navigation,
  currentUserProfile,
  unreadInboxCount,
  onShuffleDiscover,
}: BottomTabBarProps & {
  currentUserProfile: Profile | null;
  unreadInboxCount: number;
  onShuffleDiscover: () => void;
}) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name as Tab;
  const navBarHeight = getNavBarHeight(insets.bottom);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  if (activeRoute === "create") return null;

  function pressTab(tab: Tab) {
    const route = state.routes.find((item) => item.name === tab);
    if (!route) return;

    const isFocused = activeRoute === tab;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (event.defaultPrevented) return;

    if (tab === "discover" && isFocused) {
      onShuffleDiscover();
      return;
    }

    if (!isFocused) {
      LayoutAnimation.configureNext(TAB_SWITCH_ANIMATION);
      navigation.navigate(route.name);
    }
  }

  return (
    <View style={[styles.nav, { height: navBarHeight, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <NavItem tab="discover" label="discover" active={activeRoute === "discover"} onPress={pressTab} Icon={GridNavIcon} />
      <Pressable style={styles.createNav} onPress={() => pressTab("create")}>
        <Text style={styles.createNavText}>+</Text>
      </Pressable>
      <NavItem
        tab="inbox"
        label="inbox"
        active={activeRoute === "inbox"}
        onPress={pressTab}
        iconElement={<MailNavIcon unreadCount={unreadInboxCount} />}
      />
      <NavItem
        tab="you"
        label="you"
        active={activeRoute === "you"}
        onPress={pressTab}
        iconElement={<ProfileNavIcon profile={currentUserProfile} />}
      />
    </View>
  );
}

function NavItem({
  tab,
  label,
  icon,
  Icon,
  iconElement,
  active,
  onPress,
}: {
  tab: Tab;
  label: string;
  icon?: string;
  Icon?: () => React.ReactNode;
  iconElement?: React.ReactNode;
  active: boolean;
  onPress: (tab: Tab) => void;
}) {
  return (
    <Pressable onPress={() => onPress(tab)} style={[styles.navItem, active && styles.navItemActive]}>
      {iconElement ?? (Icon ? <Icon /> : <Text style={styles.navIcon}>{icon}</Text>)}
      {active && <Text style={styles.navLabel}>{label}</Text>}
    </Pressable>
  );
}

function ProfileNavIcon({ profile }: { profile: Profile | null }) {
  const displayName = profile?.display_name?.trim() || "you";
  return (
    <Avatar
      uri={profile?.avatar_url}
      fallback={getInitials(displayName, profile?.first_name, profile?.last_name)}
      size={30}
    />
  );
}

function MailNavIcon({ unreadCount = 0 }: { unreadCount?: number }) {
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);
  return (
    <View style={styles.mailIconWrap}>
      <View style={styles.mailIcon}>
        <View style={styles.mailFlapLeft} />
        <View style={styles.mailFlapRight} />
      </View>
      {unreadCount > 0 && (
        <View style={styles.mailBadge}>
          <Text style={styles.mailBadgeText}>{badgeText}</Text>
        </View>
      )}
    </View>
  );
}

function GridNavIcon() {
  return (
    <View style={styles.gridNavIcon}>
      <View style={styles.gridNavCell} />
      <View style={styles.gridNavCell} />
      <View style={styles.gridNavCell} />
      <View style={styles.gridNavCell} />
    </View>
  );
}

function JamJarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <View style={styles.jamJarIcon}>
      <View style={styles.jamJarLid} />
      <View style={styles.jamJarBody}>
        <View style={[styles.jamJarFill, filled && styles.jamJarFillSent]}>
          <View style={styles.jamJarWaveLeft} />
          <View style={styles.jamJarWaveRight} />
        </View>
      </View>
    </View>
  );
}

function SwipeBackSurface({
  children,
  onBack,
  style,
  resetKey,
  enterFromRight = false,
}: {
  children: React.ReactNode;
  onBack: () => void;
  style?: StyleProp<ViewStyle>;
  resetKey?: string | boolean | null;
  enterFromRight?: boolean;
}) {
  const [translateX] = useState(() => new Animated.Value(enterFromRight ? viewportWidth : 0));
  const closingRef = useRef(false);
  const animatedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, viewportWidth],
        outputRange: [0, viewportWidth],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  useEffect(() => {
    if (!resetKey) return;
    closingRef.current = false;
    if (!enterFromRight) {
      translateX.setValue(0);
      return;
    }

    translateX.setValue(viewportWidth);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterFromRight, resetKey, translateX]);
  const handleGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: translateX } }], {
        useNativeDriver: true,
      }),
    [translateX],
  );

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    const state = event.nativeEvent.state;
    if (
      state !== State.END &&
      state !== State.CANCELLED &&
      state !== State.FAILED
    ) {
      return;
    }

    const { x, translationX, translationY, velocityX } = event.nativeEvent;
    const gestureStartedAtEdge = x - translationX < SWIPE_BACK_HIT_WIDTH;
    const movedLikeBackGesture =
      translationX > 42 && Math.abs(translationY) < 90;
    const shouldComplete =
      gestureStartedAtEdge &&
      movedLikeBackGesture &&
      (translationX > viewportWidth * 0.34 || velocityX > 520);

    if (shouldComplete) {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.timing(translateX, {
        toValue: viewportWidth,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        onBack();
      });
      return;
    }

    Animated.spring(translateX, {
      toValue: 0,
      damping: 24,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }

  return (
    <PanGestureHandler
      activeOffsetX={24}
      failOffsetY={[-26, 26]}
      hitSlop={{ left: 0, width: SWIPE_BACK_HIT_WIDTH }}
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleGestureStateChange}
    >
      <Animated.View
        style={[
          styles.swipeBackSurface,
          style,
          { transform: [{ translateX: animatedTranslateX }] },
        ]}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && styles.disabled]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function ProfileLikeButton({
  label,
  jamming,
  disabled,
  onPress,
}: {
  label: string;
  jamming: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.profileLikeButton,
        jamming && styles.profileLikeButtonJamming,
        disabled && !jamming && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.profileLikeButtonText,
          jamming && styles.profileLikeButtonTextJamming,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Avatar({ uri, fallback, size }: { uri?: string | null; fallback: string; size: number }) {
  const avatarStyle = { width: size, height: size, borderRadius: size / 2 };
  const cachedSource = useMemo(
    () => (uri ? { uri, cache: "force-cache" as const } : null),
    [uri],
  );
  if (cachedSource) {
    return <Image source={cachedSource} style={[styles.avatarImage, avatarStyle]} alt="profile photo" />;
  }
  return (
    <View style={[styles.avatarFallback, avatarStyle]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(12, size / 4) }]}>{fallback}</Text>
    </View>
  );
}

function GoldBadge() {
  const scallops = Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2;
    const radius = 5.7;
    return {
      left: 6.6 + Math.cos(angle) * radius,
      top: 6.6 + Math.sin(angle) * radius,
    };
  });

  return (
    <View style={styles.goldBadge}>
      {scallops.map((scallop, index) => (
        <View key={index} style={[styles.goldBadgeScallop, scallop]} />
      ))}
      <LinearGradient
        colors={["#8b5b10", "#d7a435", "#fff36f", "#c98d21", "#7b4e0b"]}
        locations={[0, 0.25, 0.52, 0.78, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.goldBadgeBase}
      >
        <View style={styles.goldBadgeInnerRing} />
        <View style={styles.checkMark}>
          <View style={styles.checkStroke} />
        </View>
      </LinearGradient>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function ChipRow({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.chips}>
      {items.map((item) => (
        <Pressable key={item} style={styles.chip} onPress={() => onRemove(item)}>
          <Text style={styles.chipText}>{item} ×</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TagPicker({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <View style={styles.categoryGrid}>
      {options.map((tag) => {
        const active = selected.includes(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => onToggle(tag)}
            style={[styles.categoryOption, active && styles.categoryOptionActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.categoryOptionText, active && styles.categoryOptionTextActive]}>
              {tag}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SuggestionList({
  items,
  onPick,
  maxVisibleItems,
}: {
  items: readonly string[];
  onPick: (item: string) => void;
  maxVisibleItems?: number;
}) {
  if (items.length === 0) return null;
  const visibleCount = maxVisibleItems
    ? Math.min(items.length, maxVisibleItems)
    : Math.min(items.length, 7);
  const listMaxHeight = visibleCount * 45;

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={[styles.suggestionList, { maxHeight: listMaxHeight }]}
    >
      {items.map((item) => (
        <Pressable key={item} style={styles.suggestionItem} onPress={() => onPick(item)}>
          <Text style={styles.suggestionText}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {tabs.map((tab) => (
        <Pressable key={tab} style={[styles.segment, active === tab && styles.segmentActive]} onPress={() => onChange(tab)}>
          <Text style={[styles.segmentText, active === tab && styles.segmentTextActive]}>{tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function VideoGrid({
  videos,
  locked,
  privateCopy,
  onVideoPress,
}: {
  videos: Array<ProfileVideo | FeedVideo>;
  locked?: boolean;
  privateCopy?: boolean;
  onVideoPress?: (video: ProfileVideo | FeedVideo, index: number) => void;
}) {
  if (videos.length === 0) return <EmptyCard text="no videos yet" />;
  return (
    <View>
      <View style={styles.grid}>
        {videos.map((video, index) => {
          const isLocked = locked && index >= 3;
          const thumbnailSource = getGridThumbnailSource(video);
          const content = (
            <>
              {thumbnailSource ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Image
                    alt={getVideoCaption(video)}
                    source={{ uri: thumbnailSource }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <Text style={styles.gridCaption}>{getVideoCaption(video)}</Text>
              )}
              {isLocked && (
                <View style={styles.lockedOverlay}>
                  <Text style={styles.lockedText}>like to unlock full profile</Text>
                </View>
              )}
            </>
          );

          if (onVideoPress && !isLocked) {
            return (
              <Pressable
                key={video.id}
                style={styles.gridItem}
                onPress={() => onVideoPress(video, index)}
              >
                {content}
              </Pressable>
            );
          }

          return (
            <View key={video.id} style={styles.gridItem}>
              {content}
            </View>
          );
        })}
      </View>
      {privateCopy && <Text style={styles.helper}>only visible to you.</Text>}
    </View>
  );
}

function ConversationRow({
  conversation,
  onPress,
  onOpenProfile,
  subdued,
}: {
  conversation: Conversation;
  onPress: () => void;
  onOpenProfile: () => void;
  subdued?: boolean;
}) {
  return (
    <Pressable style={[styles.conversationRow, subdued && styles.subdued]} onPress={onPress}>
      <Pressable onPress={onOpenProfile} accessibilityLabel={`open ${conversation.creatorName}'s profile`}>
        <Avatar uri={conversation.avatarUrl} fallback={conversation.avatarFallback} size={52} />
      </Pressable>
      <View style={styles.flex}>
        <View style={styles.row}>
          <Text style={styles.listTitle}>{conversation.creatorName}</Text>
          {conversation.earlyAdopter && <GoldBadge />}
        </View>
        <Text numberOfLines={1} style={styles.helper}>{conversation.lastMessage}</Text>
      </View>
      <View style={styles.alignEnd}>
        <Text style={styles.helper}>{conversation.timestamp}</Text>
        {conversation.unread && <View style={styles.unreadDot} />}
      </View>
    </Pressable>
  );
}

function SystemRow({ message, onPress }: { message: InboxMessage; onPress: () => void }) {
  return (
    <Pressable style={styles.conversationRow} onPress={onPress}>
      <Avatar fallback={message.sender_avatar ?? "jam."} size={52} />
      <View style={styles.flex}>
        <View style={styles.row}>
          <Text style={styles.listTitle}>{message.sender_name}</Text>
          <GoldBadge />
        </View>
        <Text numberOfLines={1} style={styles.helper}>{message.body}</Text>
      </View>
      {!message.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

function SettingsButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.settingsButton} onPress={onPress}>
      <Text style={styles.settingsText}>{label}</Text>
    </Pressable>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.helper}>{text}</Text>
    </View>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.helper}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{text}</Text>
    </View>
  );
}

function useSuggestions<T extends string>(items: readonly T[], query: string, selected: string[]) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !selected.includes(item) && (!q || item.toLowerCase().includes(q)));
  }, [items, query, selected]);
}

function shuffleVideosWithSpacing(videos: FeedVideo[]) {
  const pool = [...videos];
  const result: FeedVideo[] = [];

  while (pool.length) {
    const recentCreators = result.slice(-10).map((item) => item.userId);
    const candidates = pool.filter((item) => !recentCreators.includes(item.userId));
    const source = candidates.length ? candidates : pool;
    const pick = source[Math.floor(Math.random() * source.length)];
    result.push(pick);
    pool.splice(pool.findIndex((item) => item.id === pick.id), 1);
  }

  return result;
}

function getVideoSource(item: FeedVideo) {
  if (item.cloudflareStreamId) return getCloudflarePlaybackUrl(item.cloudflareStreamId);
  return item.mediaUrl;
}

function getExpoVideoSource(source: string | null): VideoSource {
  if (!source) return null;
  return {
    uri: source,
    contentType: source.includes(".m3u8") ? "hls" : "auto",
  };
}

function getGridVideoSource(video: ProfileVideo | FeedVideo) {
  if ("cloudflareStreamId" in video && video.cloudflareStreamId) {
    return getCloudflarePlaybackUrl(video.cloudflareStreamId);
  }
  if ("cloudflare_stream_id" in video && video.cloudflare_stream_id) {
    return getCloudflarePlaybackUrl(video.cloudflare_stream_id);
  }
  if ("mediaUrl" in video && video.mediaUrl) return video.mediaUrl;
  if ("media_url" in video && video.media_url) return video.media_url;
  return null;
}

function getGridThumbnailSource(video: ProfileVideo | FeedVideo) {
  const cloudflareStreamId =
    "cloudflareStreamId" in video && video.cloudflareStreamId
      ? video.cloudflareStreamId
      : "cloudflare_stream_id" in video
        ? video.cloudflare_stream_id
        : null;

  if (!cloudflareStreamId) return null;
  return `https://videodelivery.net/${cloudflareStreamId}/thumbnails/thumbnail.jpg?time=1s&height=640`;
}

function getVideoCaption(video: ProfileVideo | FeedVideo) {
  return "caption" in video ? video.caption ?? "video" : "video";
}

function profileToFeedVideo(
  profile: Profile,
  video: ProfileVideo | undefined,
  savedByMe: boolean,
  jammedByMe: boolean,
  jammedMe: boolean,
): FeedVideo {
  const displayName = profile.display_name?.trim() || "creator";
  const role = profile.creator_types?.[0] ?? "creator";
  return {
    id: video?.id ?? `${profile.id}-profile`,
    userId: profile.id,
    creatorName: displayName,
    role,
    location: profile.location ?? "unknown",
    avatarUrl: profile.avatar_url,
    avatarFallback: getInitials(displayName, profile.first_name, profile.last_name),
    bio: profile.bio,
    caption: video?.caption ?? "",
    hashtags: video?.hashtags ?? [],
    categories: video?.categories ?? video?.hashtags ?? [],
    roles: video?.roles ?? video?.categories ?? video?.hashtags ?? [],
    genres: video?.genres ?? [],
    mediaUrl: video?.mediaUrl ?? video?.media_url ?? null,
    cloudflareStreamId: video?.cloudflareStreamId ?? video?.cloudflare_stream_id ?? null,
    earlyAdopter: Boolean(profile.early_adopter),
    createdAt: video?.created_at ?? new Date().toISOString(),
    likedByMe: savedByMe,
    likedMe: jammedMe,
    mutual: jammedByMe && jammedMe,
    jammedByMe,
    jammedMe,
  };
}

function getUnreadInboxCount(inbox: InboxData) {
  return getUnreadLocalInboxCount(
    inbox.requests,
    inbox.conversations,
    inbox.sent,
    inbox.systemMessages,
  );
}

function getUnreadLocalInboxCount(
  requests: InboxRequest[],
  conversations: Conversation[],
  sent: Conversation[],
  systemMessages: InboxMessage[],
) {
  return (
    requests.reduce((total, request) => total + request.unreadCount, 0) +
    conversations.reduce((total, conversation) => total + conversation.unreadCount, 0) +
    sent.reduce((total, conversation) => total + conversation.unreadCount, 0) +
    systemMessages.filter((message) => !message.read).length
  );
}

function feedItemToPreloadedProfile(item: FeedVideo, feedItems: FeedVideo[]): PreloadedUserProfile {
  const videos = feedItems
    .filter((video) => video.userId === item.userId)
    .map((video): ProfileVideo => ({
      id: video.id,
      userId: video.userId,
      caption: video.caption,
      hashtags: video.hashtags,
      categories: video.categories,
      roles: video.roles,
      genres: video.genres,
      mediaUrl: video.mediaUrl,
      cloudflareStreamId: video.cloudflareStreamId,
      created_at: video.createdAt,
      creatorName: video.creatorName,
      role: video.role,
      location: video.location,
      avatarUrl: video.avatarUrl,
      avatarFallback: video.avatarFallback,
      earlyAdopter: video.earlyAdopter,
      likedByMe: video.likedByMe,
      likedMe: video.likedMe,
      mutual: video.mutual,
      jammedByMe: video.jammedByMe,
      jammedMe: video.jammedMe,
    }));

  return {
    userId: item.userId,
    profile: {
      id: item.userId,
      display_name: item.creatorName,
      first_name: null,
      last_name: null,
      bio: item.bio,
      creator_types: [item.role],
      location: item.location,
      avatar_url: item.avatarUrl,
      onboarding_complete: true,
      welcome_seen: true,
      early_adopter: item.earlyAdopter,
    },
    videos,
    likedByMe: item.jammedByMe || item.mutual,
    likedMe: item.jammedMe || item.mutual,
  };
}

function profileVideoToFeedVideo(video: ProfileVideo | FeedVideo): FeedVideo | null {
  if ("userId" in video && video.userId) {
    const mediaUrl = "mediaUrl" in video && video.mediaUrl
      ? video.mediaUrl
      : "media_url" in video
        ? video.media_url ?? null
        : null;
    const cloudflareStreamId = "cloudflareStreamId" in video && video.cloudflareStreamId
      ? video.cloudflareStreamId
      : "cloudflare_stream_id" in video
        ? video.cloudflare_stream_id ?? null
        : null;
    const createdAt = "createdAt" in video
      ? video.createdAt
      : "created_at" in video
        ? video.created_at ?? new Date().toISOString()
        : new Date().toISOString();

    return {
      id: video.id,
      userId: video.userId,
      creatorName: video.creatorName ?? "creator",
      role: video.role ?? "creator",
      location: video.location ?? "unknown",
      avatarUrl: video.avatarUrl ?? null,
      avatarFallback: video.avatarFallback ?? getInitials(video.creatorName ?? "creator"),
      bio: null,
      caption: video.caption ?? "",
      hashtags: video.hashtags ?? [],
      categories: video.categories ?? video.hashtags ?? [],
      roles: video.roles ?? video.categories ?? video.hashtags ?? [],
      genres: video.genres ?? [],
      mediaUrl,
      cloudflareStreamId,
      earlyAdopter: Boolean(video.earlyAdopter),
      createdAt,
      likedByMe: video.likedByMe ?? true,
      likedMe: video.likedMe ?? false,
      mutual: video.mutual ?? false,
      jammedByMe: video.jammedByMe ?? false,
      jammedMe: video.jammedMe ?? false,
    };
  }

  return null;
}

function getProfileVideoOwner(video: ProfileVideo | FeedVideo) {
  const feedItem = profileVideoToFeedVideo(video);
  return {
    creatorName: feedItem?.creatorName ?? "creator",
    role: feedItem?.role ?? "creator",
    location: feedItem?.location ?? "unknown",
    avatarUrl: feedItem?.avatarUrl ?? null,
    avatarFallback: feedItem?.avatarFallback ?? "C",
    earlyAdopter: Boolean(feedItem?.earlyAdopter),
  };
}

function hasSentJam(video: ProfileVideo | FeedVideo) {
  return Boolean(video.mutual || video.jammedByMe);
}

function isPendingSentJam(video: ProfileVideo | FeedVideo) {
  return Boolean(video.jammedByMe && !video.mutual);
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

async function deleteOwnProfileVideo(
  videoId: string,
  setVideos: (updater: (current: ProfileVideo[]) => ProfileVideo[]) => void,
  setFullscreenIndex: (value: number | null) => void,
) {
  const previousVideosPromise = new Promise<ProfileVideo[]>((resolve) => {
    setVideos((current) => {
      resolve(current);
      return current.filter((video) => video.id !== videoId);
    });
  });

  setFullscreenIndex(null);

  try {
    await deleteVideo(videoId);
  } catch (err) {
    const previousVideos = await previousVideosPromise;
    setVideos(() => previousVideos);
    Alert.alert("could not delete", err instanceof Error ? err.message : "try again");
  }
}

function conversationFromRequest(request: InboxRequest): Conversation {
  return {
    id: request.userId,
    userId: request.userId,
    creatorName: request.creatorName,
    avatarUrl: request.avatarUrl,
    avatarFallback: request.avatarFallback,
    role: request.role,
    location: request.location,
    lastMessage: "reply to start jamming.",
    timestamp: "now",
    unread: false,
    unreadCount: 0,
    earlyAdopter: request.earlyAdopter,
    unlocked: false,
    messages: [
      {
        id: request.id,
        body: request.preview,
        incoming: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function conversationFromFeedItem(item: FeedVideo, unlocked: boolean): Conversation {
  return {
    id: item.userId,
    userId: item.userId,
    creatorName: item.creatorName,
    avatarUrl: item.avatarUrl,
    avatarFallback: item.avatarFallback,
    role: item.role,
    location: item.location,
    lastMessage: unlocked ? "you are jamming. chat is open." : "jam sent. waiting for a reply.",
    timestamp: "now",
    unread: false,
    unreadCount: 0,
    earlyAdopter: item.earlyAdopter,
    unlocked,
    messages: [],
  };
}

function getInitials(displayName: string, firstName?: string | null, lastName?: string | null) {
  if (firstName || lastName) return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ordinal(value: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = value % 100;
  const suffix = suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
  return `${value}${suffix}`;
}

function stringParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1, backgroundColor: dark },
  swipeBackSurface: { flex: 1, backgroundColor: dark },
  profileStackOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: dark, zIndex: 20 },
  fullscreenOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 60, elevation: 60 },
  app: { flex: 1, backgroundColor: dark },
  tabScene: { backgroundColor: dark },
  safe: { flex: 1, backgroundColor: dark },
  safeWithNav: { flex: 1, paddingBottom: NAV_BAR_HEIGHT, backgroundColor: dark },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  authCard: { width: "100%", gap: 14 },
  logo: { color: "#fff", fontSize: 58, fontWeight: "800", letterSpacing: -3, textAlign: "center" },
  logoSmall: { color: "#fff", fontSize: 42, fontWeight: "800", letterSpacing: -2 },
  h1: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -1.2, lineHeight: 40 },
  h2: { color: "#fff", fontSize: 27, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { color: muted, fontSize: 15, lineHeight: 22 },
  copy: { color: "#d4d4d8", fontSize: 15, lineHeight: 22 },
  copyCentered: { color: "#d4d4d8", fontSize: 15, lineHeight: 23, textAlign: "center" },
  longCopy: { color: "#d4d4d8", fontSize: 17, lineHeight: 30 },
  callout: { color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 28, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  eyebrow: { color: muted, fontSize: 14, textTransform: "lowercase", letterSpacing: 0.4 },
  screenContent: { padding: SCREEN_CONTENT_PADDING, gap: 16 },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: border, color: "#fff", backgroundColor: panel, paddingHorizontal: 16, fontSize: 16 },
  textArea: { minHeight: 112, paddingTop: 14, textAlignVertical: "top" },
  primaryButton: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#fff", paddingHorizontal: 16 },
  primaryButtonText: { color: "#000", fontSize: 16, fontWeight: "800", textTransform: "lowercase" },
  profileLikeButton: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: panel, paddingHorizontal: 16 },
  profileLikeButtonJamming: { borderColor: "#fff", backgroundColor: "#fff" },
  profileLikeButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  profileLikeButtonTextJamming: { color: "#000" },
  secondaryButton: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: panel, paddingHorizontal: 16 },
  secondaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700", textTransform: "lowercase" },
  disabled: { opacity: 0.45 },
  switchText: { color: muted, textAlign: "center", marginTop: 6, textTransform: "lowercase" },
  notice: { color: "#bbf7d0", textAlign: "center", padding: 12, borderRadius: 14, backgroundColor: "rgba(22,101,52,0.18)" },
  error: { color: "#fca5a5", textAlign: "center" },
  helper: { color: "#71717a", fontSize: 13, lineHeight: 18 },
  charCount: { alignSelf: "flex-end", color: "#71717a", fontSize: 12 },
  loader: { marginTop: 28 },
  sectionLabel: { color: "#8b8b95", fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: panel },
  chipText: { color: "#e4e4e7", fontSize: 14 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryOption: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  categoryOptionActive: { borderColor: "#fff", backgroundColor: "#fff" },
  categoryOptionText: { color: "#e4e4e7", fontSize: 14, fontWeight: "700" },
  categoryOptionTextActive: { color: "#000" },
  suggestionList: { overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: panel },
  suggestionItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
  suggestionText: { color: "#e4e4e7", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSpacer: { width: 42, height: 42 },
  profileMenu: { position: "absolute", right: 0, top: 48, zIndex: 30, minWidth: 170, overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.98)" },
  profileMenuItem: { paddingHorizontal: 16, paddingVertical: 13 },
  profileMenuDangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "800", textTransform: "lowercase" },
  profileMenuMutedText: { color: "#71717a", fontSize: 14, fontWeight: "700", textTransform: "lowercase" },
  twoCol: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  profileCentered: { alignItems: "center", gap: 7, paddingVertical: 8 },
  profileVideoDivider: { height: StyleSheet.hairlineWidth, backgroundColor: border, marginTop: 4 },
  avatarImage: { backgroundColor: panel },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#27272a" },
  avatarText: { color: "#fff", fontWeight: "800" },
  goldBadge: { width: 19, height: 19, alignItems: "center", justifyContent: "center" },
  goldBadgeScallop: { position: "absolute", width: 5.7, height: 5.7, borderRadius: 2.85, backgroundColor: "#d5a231" },
  goldBadgeBase: { width: 15, height: 15, borderRadius: 7.5, alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#f8d363", shadowOpacity: 0.32, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  goldBadgeInnerRing: { position: "absolute", width: 13.2, height: 13.2, borderRadius: 6.6, borderWidth: 1, borderColor: "#050505" },
  checkMark: { width: 9, height: 7.2, marginLeft: 0.6, marginTop: -0.6, alignItems: "center", justifyContent: "center" },
  checkStroke: { width: 7.5, height: 4.2, borderLeftWidth: 2.4, borderBottomWidth: 2.4, borderColor: "#020202", transform: [{ rotate: "-45deg" }] },
  feedRoot: { flex: 1, backgroundColor: "#000" },
  fullscreenVideoRoot: { flex: 1, backgroundColor: "#000", justifyContent: "flex-end" },
  fullscreenAdjacentVideo: { position: "absolute", left: 0, right: 0, height: viewportHeight, backgroundColor: "#000" },
  filterButton: { position: "absolute", right: 18, zIndex: 20, width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: border, backgroundColor: "rgba(24,24,27,0.82)", alignItems: "center", justifyContent: "center" },
  iconText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  closeIconText: { color: "#fff", fontSize: 28, fontWeight: "500", lineHeight: 30 },
  feedItem: { width: "100%", backgroundColor: "#000", justifyContent: "flex-end" },
  feedVideoLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  feedBufferingIndicator: { position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", justifyContent: "center" },
  videoBufferingIndicator: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  feedShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.28)" },
  feedMeta: { position: "absolute", left: 18, right: 76, bottom: 122, gap: 11 },
  feedName: { color: "#fff", fontSize: 25, fontWeight: "800", letterSpacing: -0.4 },
  feedRole: { color: "#d4d4d8", fontSize: 14 },
  caption: { color: "#fff", fontSize: 20, lineHeight: 27 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { color: "#e4e4e7", fontSize: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)" },
  badge: { color: "#fff", fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.20)", overflow: "hidden" },
  actions: { position: "absolute", right: 18, bottom: 132, gap: 12 },
  actionButton: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#fff", fontSize: 31, lineHeight: 33 },
  actionTextActive: { color: "#fff" },
  videoMenu: { position: "absolute", right: 52, top: 4, minWidth: 132, borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.94)", overflow: "hidden" },
  videoMenuItem: { paddingHorizontal: 16, paddingVertical: 13 },
  videoMenuDangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "800", textTransform: "lowercase" },
  jamJarIcon: { width: 31, height: 36, alignItems: "center", justifyContent: "flex-end" },
  jamJarLid: { width: 23, height: 7, borderRadius: 3, borderWidth: 2, borderColor: "#fff", marginBottom: -1 },
  jamJarBody: { width: 27, height: 27, borderRadius: 9, borderWidth: 2, borderColor: "#fff", overflow: "hidden", justifyContent: "flex-end" },
  jamJarFill: { height: 7, backgroundColor: "#fff" },
  jamJarFillSent: { height: 21 },
  jamJarWaveLeft: { position: "absolute", left: -3, top: -4, width: 15, height: 8, borderRadius: 8, backgroundColor: "#fff" },
  jamJarWaveRight: { position: "absolute", right: -4, top: -2, width: 18, height: 7, borderRadius: 9, backgroundColor: "#fff" },
  videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, backgroundColor: "#09090b" },
  emptyFeed: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 28 },
  endOfFeed: { alignItems: "center", justifyContent: "center", gap: 18, padding: 28, backgroundColor: dark },
  emptyText: { color: "#e4e4e7", fontSize: 22, lineHeight: 31, textAlign: "center", fontWeight: "700" },
  modalShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)" },
  topSheet: { position: "absolute", left: 0, right: 0, top: 0, gap: 10, padding: 22, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#09090b" },
  topSheetScroll: { flexShrink: 1 },
  topSheetScrollContent: { gap: 10, paddingBottom: 2 },
  bottomModalWrap: { flex: 1, justifyContent: "flex-end" },
  bottomCard: { gap: 14, padding: 18, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#09090b" },
  jamPromptOverlay: { flex: 1, justifyContent: "center", padding: 22 },
  jamPromptShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.42)" },
  jamPromptCard: { gap: 14, padding: 18, borderRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.92)" },
  cardTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  smallPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: border, backgroundColor: panel },
  smallPillText: { color: "#e4e4e7", fontWeight: "700" },
  iconCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: border, backgroundColor: panelSoft, alignItems: "center", justifyContent: "center" },
  previewBox: { overflow: "hidden", borderRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#000" },
  previewVideo: { width: "100%", aspectRatio: 9 / 16 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff" },
  segmented: { alignSelf: "flex-start", flexDirection: "row", borderRadius: 14, padding: 4, borderWidth: 1, borderColor: border, backgroundColor: panel },
  segment: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  segmentActive: { backgroundColor: "#fff" },
  segmentText: { color: "#d4d4d8", fontSize: 15, textTransform: "lowercase" },
  segmentTextActive: { color: "#000", fontWeight: "800" },
  list: { gap: 10 },
  listCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  listTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  conversationRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: border },
  subdued: { opacity: 0.7 },
  alignEnd: { alignItems: "flex-end", gap: 5 },
  unreadDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#ec4899" },
  emptyCard: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: panelSoft },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: border },
  chatProfileTarget: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  chatContent: { flexGrow: 1, gap: 10, padding: 16 },
  messageWrap: { maxWidth: "82%", gap: 6 },
  messageWrapIn: { alignSelf: "flex-start" },
  messageWrapOut: { alignSelf: "flex-end" },
  bubble: { maxWidth: "100%", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  bubbleIn: { alignSelf: "flex-start", backgroundColor: panel },
  bubbleOut: { alignSelf: "flex-end", backgroundColor: "#fff" },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 22 },
  bubbleTextOut: { color: "#000" },
  messageContextMenu: { alignSelf: "flex-end", minWidth: 128, borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: "rgba(9,9,11,0.96)", overflow: "hidden" },
  messageContextItem: { paddingHorizontal: 16, paddingVertical: 12 },
  messageContextText: { color: "#fff", fontSize: 15, fontWeight: "700", textTransform: "lowercase" },
  messageContextDangerText: { color: "#fca5a5", fontSize: 15, fontWeight: "800", textTransform: "lowercase" },
  editMessageBox: { gap: 8, minWidth: 180 },
  editMessageInput: { color: "#000", fontSize: 15, lineHeight: 22, padding: 0, minHeight: 28 },
  editMessageActions: { flexDirection: "row", justifyContent: "flex-end", gap: 14 },
  editMessageCancel: { color: "#52525b", fontSize: 13, fontWeight: "700", textTransform: "lowercase" },
  editMessageSave: { color: "#000", fontSize: 13, fontWeight: "900", textTransform: "lowercase" },
  composer: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: border },
  sendButton: { paddingHorizontal: 16, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  sendButtonText: { color: "#000", fontWeight: "800" },
  profileTabSlider: { overflow: "visible" },
  grid: { width: viewportWidth, flexDirection: "row", flexWrap: "wrap", gap: PROFILE_GRID_GAP, marginTop: 8, marginHorizontal: -SCREEN_CONTENT_PADDING },
  gridItem: { width: PROFILE_GRID_ITEM_WIDTH, aspectRatio: 9 / 16, overflow: "hidden", alignItems: "flex-end", justifyContent: "flex-end", padding: 8, backgroundColor: panel },
  gridCaption: { color: "#fff", fontSize: 11, lineHeight: 15 },
  lockedOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.58)", padding: 8 },
  lockedText: { color: "#fff", textAlign: "center", fontSize: 11, fontWeight: "800" },
  settingsOverlay: { flex: 1, alignItems: "flex-end" },
  settingsBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.42)" },
  settingsDrawer: { position: "absolute", right: 0, top: 0, bottom: 0, borderLeftWidth: 1, borderLeftColor: border, backgroundColor: "#09090b", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: -8, height: 0 }, elevation: 16 },
  settingsPanel: { flex: 1, gap: 8, padding: 20, backgroundColor: "#09090b" },
  settingsButton: { paddingVertical: 14, paddingHorizontal: 10, borderRadius: 16 },
  settingsRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  settingsText: { color: "#e4e4e7", fontSize: 15, textTransform: "lowercase" },
  logoutButton: { marginTop: "auto", paddingVertical: 15, paddingHorizontal: 10 },
  logoutText: { color: "#fca5a5", fontSize: 15, textTransform: "lowercase" },
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: NAV_BAR_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: border, backgroundColor: "rgba(10,10,10,0.96)" },
  navItem: { height: 58, minWidth: 58, borderRadius: 18, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  navItemActive: { minWidth: 132, borderColor: "#93c5fd", backgroundColor: panel },
  navIcon: { color: "#fff", fontSize: 23 },
  navLabel: { color: "#fff", fontSize: 16, textTransform: "lowercase" },
  gridNavIcon: { width: 23, height: 23, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  gridNavCell: { width: 9, height: 9, borderWidth: 1.8, borderColor: "#fff", borderRadius: 3 },
  mailIconWrap: { width: 33, height: 30, alignItems: "center", justifyContent: "center" },
  mailIcon: { width: 26, height: 19, borderWidth: 1.8, borderColor: "#fff", borderRadius: 4, overflow: "hidden" },
  mailFlapLeft: { position: "absolute", left: 0.75, top: 4, width: 13, height: 1.8, borderRadius: 1, backgroundColor: "#fff", transform: [{ rotate: "34deg" }] },
  mailFlapRight: { position: "absolute", right: 0.75, top: 4, width: 13, height: 1.8, borderRadius: 1, backgroundColor: "#fff", transform: [{ rotate: "-34deg" }] },
  mailBadge: { position: "absolute", right: -3, top: -4, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 8.5, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(10,10,10,0.96)", backgroundColor: "#ef4444" },
  mailBadgeText: { color: "#fff", fontSize: 10, lineHeight: 12, fontWeight: "900" },
  createNav: { width: 66, height: 66, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  createNavText: { color: "#000", fontSize: 38, lineHeight: 41, fontWeight: "600" },
  toast: { position: "absolute", top: 76, left: 18, right: 18, zIndex: 30, alignItems: "center" },
  toastText: { color: "#fecaca", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(127,29,29,0.82)" },
});
