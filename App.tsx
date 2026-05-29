import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { creatorRoles, locationSuggestions } from "@/lib/options";
import {
  createEarlyAdopterWelcome,
  createVideo,
  fetchCreatorProfile,
  fetchCreatorVideos,
  fetchFeedVideos,
  fetchInbox,
  fetchLikedVideos,
  fetchMyVideos,
  fetchProfile,
  fetchRelationshipState,
  getSignupPosition,
  likeCreator,
  markWelcomeSeen,
  saveProfile,
  saveVideo,
  sendJamRequest,
  sendMessage,
  unsaveVideo,
  type Conversation,
  type FeedVideo,
  type InboxMessage,
  type InboxRequest,
  type Profile,
  type ProfileVideo,
} from "@/lib/native-social-data";
import {
  createStreamUpload,
  getCloudflarePlaybackUrl,
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

const { width: viewportWidth, height: viewportHeight } = Dimensions.get("window");
const dark = "#0a0a0a";
const panel = "#18181b";
const panelSoft = "#111113";
const border = "rgba(255,255,255,0.12)";
const muted = "#a1a1aa";
const FREE_MAX_SECONDS = 45;
const PRO_MAX_SECONDS = 90;
const SWIPE_BACK_HIT_WIDTH = 112;
const MainTab = createBottomTabNavigator<MainTabParamList>();
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
          <JamTabBar {...props} onShuffleDiscover={onShuffleDiscover} />
        )}
      >
        <MainTab.Screen name="discover">
          {({ navigation }) => (
            <DiscoverScreen
              userId={userId}
              shuffleSignal={shuffleSignal}
              onCreate={() => navigation.navigate("create")}
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
              onPosted={() => navigation.navigate("discover")}
            />
          )}
        </MainTab.Screen>
        <MainTab.Screen name="inbox">
          {() => <InboxScreen userId={userId} />}
        </MainTab.Screen>
        <MainTab.Screen name="you">
          {() => <MyProfileScreen userId={userId} onLoggedOut={onLoggedOut} />}
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
  onCreate,
}: {
  userId: string;
  shuffleSignal: number;
  onCreate: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<FeedVideo | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const listRef = useRef<FlatList<FeedVideo>>(null);

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

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const roleMatch = roles.length === 0 || roles.includes(item.role.toLowerCase());
      const locationMatch =
        !location ||
        item.location.toLowerCase().includes(location.toLowerCase()) ||
        location.toLowerCase().includes(item.location.toLowerCase());
      return roleMatch && locationMatch;
    });
  }, [items, location, roles]);

  async function refresh() {
    setRefreshing(true);
    await load().catch((err) => setError(err instanceof Error ? err.message : "could not refresh"));
    setRefreshing(false);
  }

  async function toggleSave(item: FeedVideo, nextSaved: boolean) {
    const previousSaved = item.likedByMe;

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              likedByMe: nextSaved,
            }
          : entry,
      ),
    );

    try {
      if (nextSaved) {
        await saveVideo(userId, item.id);
      } else {
        await unsaveVideo(userId, item.id);
      }
      return true;
    } catch (err) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                likedByMe: previousSaved,
              }
            : entry,
        ),
      );
      Alert.alert(
        nextSaved ? "could not save" : "could not remove",
        err instanceof Error ? err.message : "try again",
      );
      return false;
    }
  }

  const filtersActive = roles.length > 0 || Boolean(location);

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
              onOpenProfile={() => setActiveProfile(item)}
              onLike={(nextSaved) => toggleSave(item, nextSaved)}
              onMessage={() => setActiveDm(item)}
            />
          )}
        />
      )}
      <FilterSheet
        visible={filtersOpen}
        selectedRoles={roles}
        selectedLocation={location}
        onClose={() => setFiltersOpen(false)}
        onApply={(nextRoles, nextLocation) => {
          setRoles(nextRoles);
          setLocation(nextLocation);
          setFiltersOpen(false);
        }}
      />
      <CreatorProfileModal
        item={activeProfile}
        allVideos={items.filter((entry) => entry.userId === activeProfile?.userId)}
        onClose={() => setActiveProfile(null)}
        onLike={(item) => void likeCreator(userId, item.userId)}
        onMessage={(item) => setActiveDm(item)}
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
        }}
      />
    </View>
  );
}

function FeedItem({
  item,
  height,
  onOpenProfile,
  onLike,
  onMessage,
}: {
  item: FeedVideo;
  height: number;
  onOpenProfile: () => void;
  onLike: (nextSaved: boolean) => Promise<boolean>;
  onMessage: () => void;
}) {
  const videoRef = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(item.likedByMe);
  const [heartScale] = useState(() => new Animated.Value(1));
  const source = getVideoSource(item);
  const connection = item.mutual ? "jamming" : item.jammedMe ? "jammed you" : null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLiked(item.likedByMe));
    return () => cancelAnimationFrame(frame);
  }, [item.likedByMe]);

  async function togglePlayback() {
    if (!videoRef.current) return;
    if (paused) {
      await videoRef.current.playAsync();
      setPaused(false);
    } else {
      await videoRef.current.pauseAsync();
      setPaused(true);
    }
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
        <Video
          ref={videoRef}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          isMuted
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Avatar fallback={item.avatarFallback} size={90} />
          <Text style={styles.h2}>{item.creatorName}</Text>
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
              {connection && <Text style={styles.badge}>{connection}</Text>}
              {item.earlyAdopter && <GoldBadge />}
            </View>
            <Text style={styles.feedRole}>{item.role} - {item.location}</Text>
          </View>
        </View>
        <Text style={styles.caption}>{item.caption}</Text>
        <View style={styles.tags}>
          {item.hashtags.map((tag) => (
            <Text key={tag} style={styles.tag}>#{tag}</Text>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
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
        <Pressable onPress={onMessage} style={styles.actionButton}>
          <JamJarIcon />
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
  selectedLocation,
  onClose,
  onApply,
}: {
  visible: boolean;
  selectedRoles: string[];
  selectedLocation: string;
  onClose: () => void;
  onApply: (roles: string[], location: string) => void;
}) {
  const [roles, setRoles] = useState(selectedRoles);
  const [roleQuery, setRoleQuery] = useState("");
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
      setLocation(selectedLocation);
      setLocationQuery(selectedLocation);
      setRoleQuery("");
      translateY.setValue(-viewportHeight);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedLocation, selectedRoles, translateY, visible]);

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
            transform: [{ translateY }],
          },
        ]}
      >
        <SectionLabel label="creator type" />
        <ChipRow items={roles} onRemove={(item) => setRoles((current) => current.filter((role) => role !== item))} />
        <TextInput value={roleQuery} onChangeText={setRoleQuery} placeholder="type to filter roles..." placeholderTextColor="#71717a" style={styles.input} />
        <SuggestionList items={roleMatches} maxVisibleItems={3} onPick={(role) => {
          setRoles((current) => [...current, role]);
          setRoleQuery("");
        }} />
        <Text style={styles.helper}>{roles.length === 0 ? "no selection — showing everyone" : ""}</Text>
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
        <PrimaryButton label="apply" onPress={() => closeWithAnimation(() => onApply(roles, location))} />
      </Animated.View>
    </Modal>
  );
}

function CreatorProfileModal({
  item,
  allVideos,
  onClose,
  onLike,
  onMessage,
}: {
  item: FeedVideo | null;
  allVideos: FeedVideo[];
  onClose: () => void;
  onLike: (item: FeedVideo) => void;
  onMessage: (item: FeedVideo) => void;
}) {
  const insets = useSafeAreaInsets();
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  if (!item) return null;
  const hasLiked = item.jammedByMe || item.mutual;
  const likeLabel = item.mutual ? "jamming" : item.jammedByMe ? "jammed" : "jam";
  const videos = allVideos.length ? allVideos : [item];

  return (
    <Modal animationType="none" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={item.id} onBack={onClose} style={styles.flex}>
        <View style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              { paddingTop: Math.max(insets.top + 18, 28) },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.logoSmall}>jam.</Text>
              <View style={styles.headerSpacer} />
            </View>
            <View style={styles.profileCentered}>
              <Avatar uri={item.avatarUrl} fallback={item.avatarFallback} size={78} />
              <View style={styles.centerRow}>
                <Text style={styles.h2}>{item.creatorName}</Text>
                {item.earlyAdopter && <GoldBadge />}
              </View>
              <Text style={styles.subtitle}>{item.role} - {item.location}</Text>
              <Text style={styles.copyCentered}>{item.bio ?? "no bio yet."}</Text>
            </View>
            <View style={styles.twoCol}>
              <ProfileLikeButton
                label={likeLabel}
                jamming={item.mutual}
                disabled={hasLiked}
                onPress={() => onLike(item)}
              />
              <Pressable style={styles.secondaryButton} onPress={() => onMessage(item)}>
                <Text style={styles.secondaryButtonText}>message</Text>
              </Pressable>
            </View>
            <VideoGrid
              videos={videos}
              locked={!hasLiked}
              onVideoPress={(_video, index) => setFullscreenIndex(index)}
            />
          </ScrollView>
        </View>
      </SwipeBackSurface>
      <ProfileVideoFullscreenModal
        visible={fullscreenIndex !== null}
        videos={videos}
        initialIndex={fullscreenIndex ?? 0}
        owner={{
          creatorName: item.creatorName,
          role: item.role,
          location: item.location,
          avatarUrl: item.avatarUrl,
          avatarFallback: item.avatarFallback,
          earlyAdopter: item.earlyAdopter,
        }}
        liked={item.likedByMe}
        onClose={() => setFullscreenIndex(null)}
        onLike={() => onLike(item)}
        onMessage={() => onMessage(item)}
      />
    </Modal>
  );
}

function UserProfileModal({
  currentUserId,
  userId,
  onClose,
  onMessage,
}: {
  currentUserId: string;
  userId: string | null;
  onClose: () => void;
  onMessage: (item: FeedVideo) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likedMe, setLikedMe] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!userId) return;

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
  }, [currentUserId, userId]);

  if (!userId) return null;

  const displayName = profile?.display_name ?? "creator";
  const initials = getInitials(displayName, profile?.first_name, profile?.last_name);
  const hasLiked = likedByMe;
  const likeLabel = likedByMe && likedMe ? "jamming" : likedByMe ? "jammed" : "jam";
  const profileFeedItem = profile
    ? profileToFeedVideo(profile, videos[0], likedByMe, likedMe)
    : null;

  async function likeProfile() {
    if (!userId || likedByMe) return;
    setLikedByMe(true);
    try {
      await likeCreator(currentUserId, userId);
    } catch (err) {
      setLikedByMe(false);
      Alert.alert("could not like", err instanceof Error ? err.message : "try again");
    }
  }

  return (
    <Modal animationType="none" transparent visible={Boolean(userId)} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={userId} onBack={onClose} style={styles.flex}>
        <View style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              { paddingTop: Math.max(insets.top + 18, 28) },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.logoSmall}>jam.</Text>
              <View style={styles.headerSpacer} />
            </View>

            {loading ? (
              <ActivityIndicator color="#fff" style={styles.loader} />
            ) : profile ? (
              <>
                <View style={styles.profileCentered}>
                  <Avatar uri={profile.avatar_url} fallback={initials} size={78} />
                  <View style={styles.centerRow}>
                    <Text style={styles.h2}>{displayName}</Text>
                    {profile.early_adopter && <GoldBadge />}
                  </View>
                  <Text style={styles.subtitle}>
                    {(profile.creator_types ?? []).join(", ") || "creator"}
                    {profile.location ? ` - ${profile.location}` : ""}
                  </Text>
                  <Text style={styles.copyCentered}>{profile.bio || "no bio yet."}</Text>
                </View>
                <View style={styles.twoCol}>
                  <ProfileLikeButton
                    label={likeLabel}
                    jamming={likedByMe && likedMe}
                    disabled={hasLiked}
                    onPress={() => void likeProfile()}
                  />
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      if (profileFeedItem) onMessage(profileFeedItem);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>message</Text>
                  </Pressable>
                </View>
                <VideoGrid
                  videos={videos}
                  locked
                  onVideoPress={(_video, index) => setFullscreenIndex(index)}
                />
              </>
            ) : (
              <EmptyCard text={error ?? "profile unavailable."} />
            )}
          </ScrollView>
        </View>
      </SwipeBackSurface>
      {profile && (
        <ProfileVideoFullscreenModal
          visible={fullscreenIndex !== null}
          videos={videos}
          initialIndex={fullscreenIndex ?? 0}
          owner={{
            creatorName: displayName,
            role: profile.creator_types?.[0] ?? "creator",
            location: profile.location ?? "unknown",
            avatarUrl: profile.avatar_url,
            avatarFallback: initials,
            earlyAdopter: Boolean(profile.early_adopter),
          }}
          liked={likedByMe}
          onClose={() => setFullscreenIndex(null)}
          onLike={() => void likeProfile()}
          onMessage={() => {
            if (profileFeedItem) {
              setFullscreenIndex(null);
              onMessage(profileFeedItem);
            }
          }}
        />
      )}
    </Modal>
  );
}

function ProfileVideoFullscreenModal({
  visible,
  videos,
  initialIndex,
  owner,
  liked,
  onClose,
  onLike,
  onMessage,
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
  onClose: () => void;
  onLike: () => void;
  onMessage: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [likedLocal, setLikedLocal] = useState(liked);
  const video = videos[index] ?? videos[0];
  const source = video ? getGridVideoSource(video) : null;

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(videos.length - 1, 0)));
      setLikedLocal(liked);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialIndex, liked, videos.length, visible]);

  function handleGestureStateChange(event: PanGestureHandlerStateChangeEvent) {
    if (event.nativeEvent.state !== State.END) return;

    const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
    if (translationX > 78 && Math.abs(translationY) < 90 && velocityX > 120) {
      onClose();
      return;
    }

    const shouldMove = Math.abs(translationY) > 70 || Math.abs(velocityY) > 520;
    if (!shouldMove) return;

    if (translationY < 0 || velocityY < -520) {
      setIndex((current) => Math.min(current + 1, videos.length - 1));
      return;
    }

    setIndex((current) => Math.max(current - 1, 0));
  }

  function pressLike() {
    if (!likedLocal) {
      setLikedLocal(true);
      onLike();
    }
  }

  if (!visible) return null;

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <PanGestureHandler
        minDist={20}
        onHandlerStateChange={handleGestureStateChange}
      >
        <View style={styles.fullscreenVideoRoot}>
          {source ? (
            <Video
              key={`${video?.id ?? "video"}-${index}`}
              source={{ uri: source }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Avatar uri={owner.avatarUrl} fallback={owner.avatarFallback} size={90} />
              <Text style={styles.h2}>{owner.creatorName}</Text>
              <Text style={styles.helper}>video unavailable</Text>
            </View>
          )}
          <View style={styles.feedShade} />
          <View style={styles.feedMeta}>
            <View style={styles.row}>
              <Avatar uri={owner.avatarUrl} fallback={owner.avatarFallback} size={52} />
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text style={styles.feedName}>{owner.creatorName}</Text>
                  {owner.earlyAdopter && <GoldBadge />}
                </View>
                <Text style={styles.feedRole}>{owner.role} - {owner.location}</Text>
              </View>
            </View>
            <Text style={styles.caption}>{getVideoCaption(video)}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={pressLike} style={styles.actionButton}>
              <Text style={[styles.actionText, likedLocal && styles.actionTextActive]}>
                {likedLocal ? "♥" : "♡"}
              </Text>
            </Pressable>
            <Pressable onPress={onMessage} style={styles.actionButton}>
              <JamJarIcon />
            </Pressable>
          </View>
        </View>
      </PanGestureHandler>
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
    <Modal animationType="none" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={item.id} onBack={onClose} style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.bottomModalWrap}>
          <Pressable style={styles.modalShade} onPress={onClose} />
          <View style={styles.bottomCard}>
            <View style={styles.row}>
              <Pressable onPress={() => onOpenProfile(item)} accessibilityLabel={`open ${item.creatorName}'s profile`}>
                <Avatar uri={item.avatarUrl} fallback={item.avatarFallback} size={44} />
              </Pressable>
              <View>
                <Text style={styles.cardTitle}>{item.creatorName}</Text>
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
              <PrimaryButton label={sending ? "sending..." : "send jam"} disabled={sending} onPress={submit} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SwipeBackSurface>
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
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const maxDuration = profile?.early_adopter ? PRO_MAX_SECONDS : FREE_MAX_SECONDS;

  useEffect(() => {
    void fetchProfile(userId).then(setProfile);
  }, [userId]);

  async function pickVideo(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("permission needed", "camera and media permissions are needed to post.");
      return;
    }

    const result =
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

    if (result.canceled) return;
    const picked = result.assets[0];
    if (!picked?.uri) return;

    const nextAsset = {
      uri: picked.uri,
      fileName: picked.fileName ?? picked.uri.split("/").pop() ?? "jam-video.mp4",
      mimeType: picked.mimeType ?? "video/mp4",
    };
    setAsset(nextAsset);
    setStreamId(null);
    await upload(nextAsset);
  }

  async function upload(nextAsset: NativeVideoAsset) {
    setUploading(true);
    setProgress(0);
    try {
      const uploadRequest = await createStreamUpload(maxDuration);
      await uploadToCloudflare(uploadRequest.uploadUrl, nextAsset, setProgress);
      setStreamId(uploadRequest.cloudflareStreamId);
    } catch (err) {
      Alert.alert("upload failed", err instanceof Error ? err.message : "try again");
    } finally {
      setUploading(false);
    }
  }

  function addTag() {
    const tag = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!tag || tags.includes(tag)) return;
    setTags((current) => [...current, tag]);
    setTagInput("");
  }

  async function post() {
    if (!streamId) return;
    setPosting(true);
    try {
      await createVideo({
        userId,
        caption: caption.trim(),
        hashtags: tags,
        cloudflareStreamId: streamId,
      });
      setAsset(null);
      setStreamId(null);
      setCaption("");
      setTags([]);
      onPosted();
    } catch (err) {
      Alert.alert("could not post", err instanceof Error ? err.message : "try again");
    } finally {
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
        {asset && (
          <View style={styles.previewBox}>
            <Video source={{ uri: asset.uri }} style={styles.previewVideo} resizeMode={ResizeMode.CONTAIN} useNativeControls />
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
        <TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} onBlur={addTag} placeholder="add hashtags" placeholderTextColor="#71717a" style={styles.input} />
        <ChipRow items={tags.map((tag) => `#${tag}`)} onRemove={(item) => setTags((current) => current.filter((tag) => `#${tag}` !== item))} />
        <PrimaryButton label={posting ? "posting..." : "post"} disabled={posting || !streamId} onPress={post} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InboxScreen({ userId }: { userId: string }) {
  const [tab, setTab] = useState<InboxTab>("requests");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [jams, setJams] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [system, setSystem] = useState<InboxMessage[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [activeRequest, setActiveRequest] = useState<InboxRequest | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);

  const load = useCallback(async () => {
    const data = await fetchInbox(userId);
    setRequests(data.requests);
    setJams(data.conversations);
    setSent(data.sent);
    setSystem(data.systemMessages);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

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
                <Pressable onPress={() => setProfileUserId(request.userId)} accessibilityLabel={`open ${request.creatorName}'s profile`}>
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
                onPress={() => setActiveChat(conversation)}
                onOpenProfile={() => setProfileUserId(conversation.userId)}
              />
            ))}
            {system.map((message) => (
              <SystemRow key={message.id} message={message} onPress={() => setActiveChat(message)} />
            ))}
            {jams.length === 0 && system.length === 0 && <EmptyCard text="no jams yet. mutual likes will appear here." />}
          </View>
        ) : (
          <View style={styles.list}>
            {sent.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onPress={() => setActiveChat(conversation)}
                onOpenProfile={() => setProfileUserId(conversation.userId)}
                subdued
              />
            ))}
            {sent.length === 0 && <EmptyCard text="no sent likes or openers waiting right now." />}
          </View>
        )}
      </ScrollView>
      <RequestModal
        request={activeRequest}
        onClose={() => setActiveRequest(null)}
        onOpenProfile={(request) => setProfileUserId(request.userId)}
        onMessage={(request) => {
          setActiveRequest(null);
          setActiveChat(conversationFromRequest(request));
        }}
      />
      <ChatModal
        active={activeChat}
        onClose={() => setActiveChat(null)}
        onOpenProfile={(nextUserId) => setProfileUserId(nextUserId)}
        onSend={async (conversation, body) => {
          if (conversation.unlocked) {
            await sendMessage(conversation.userId, body);
          } else {
            await sendJamRequest(conversation.userId, body);
          }
          await load();
        }}
      />
      <UserProfileModal
        currentUserId={userId}
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
        onMessage={(profileFeedItem) => {
          setProfileUserId(null);
          setActiveDm(profileFeedItem);
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
          await load();
        }}
      />
    </SafeAreaView>
  );
}

function MyProfileScreen({ userId, onLoggedOut }: { userId: string; onLoggedOut: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [saved, setSaved] = useState<ProfileVideo[]>([]);
  const [activeTab, setActiveTab] = useState<"videos" | "saved">("videos");
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [nextProfile, ownVideos, savedVideos] = await Promise.all([
      fetchProfile(userId),
      fetchMyVideos(userId),
      fetchLikedVideos(userId),
    ]);
    setProfile(nextProfile);
    setVideos(ownVideos);
    setSaved(savedVideos);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

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
        <SegmentedTabs tabs={["videos", "saved"]} active={activeTab} onChange={(value) => setActiveTab(value as "videos" | "saved")} />
        <VideoGrid videos={activeTab === "videos" ? videos : saved} privateCopy={activeTab === "saved"} />
      </ScrollView>
      <EditProfileModal
        visible={editing}
        profile={profile}
        onClose={() => setEditing(false)}
        onSaved={(nextProfile) => {
          setProfile(nextProfile);
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
}: {
  active: Conversation | InboxMessage | null;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onSend: (conversation: Conversation, body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const insets = useSafeAreaInsets();
  if (!active) return null;

  const isSystem = "sender_name" in active;
  const title = isSystem ? active.sender_name : active.creatorName;
  const avatar = isSystem ? active.sender_avatar ?? "jam." : active.avatarFallback;
  const messages = isSystem
    ? [{ id: active.id, body: active.body, incoming: true }]
    : active.messages.length
      ? active.messages
      : [{ id: "empty", body: active.lastMessage, incoming: true }];
  const canSend = !isSystem && (active.unlocked || !active.messages.some((message) => !message.incoming));

  async function submit() {
    if (!draft.trim() || isSystem) return;
    await onSend(active as Conversation, draft.trim());
    setDraft("");
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
                <Pressable onPress={() => onOpenProfile(active.userId)} accessibilityLabel={`open ${title}'s profile`}>
                  <Avatar fallback={avatar} size={44} />
                </Pressable>
              ) : (
                <Avatar fallback={avatar} size={44} />
              )}
              <View>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.helper}>{isSystem ? "system message" : canSend ? "messages unlocked" : "waiting for a jam"}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.chatContent}>
              {messages.map((message) => (
                <View key={message.id} style={[styles.bubble, message.incoming ? styles.bubbleIn : styles.bubbleOut]}>
                  <Text style={[styles.bubbleText, !message.incoming && styles.bubbleTextOut]}>{message.body}</Text>
                </View>
              ))}
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
        </View>
      </SwipeBackSurface>
    </Modal>
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
  onShuffleDiscover,
}: BottomTabBarProps & {
  onShuffleDiscover: () => void;
}) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name as Tab;

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
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <NavItem tab="discover" label="discover" active={activeRoute === "discover"} onPress={pressTab} Icon={GridNavIcon} />
      <Pressable style={styles.createNav} onPress={() => pressTab("create")}>
        <Text style={styles.createNavText}>+</Text>
      </Pressable>
      <NavItem tab="inbox" label="inbox" active={activeRoute === "inbox"} onPress={pressTab} Icon={MailNavIcon} />
      <NavItem tab="you" label="you" icon="♙" active={activeRoute === "you"} onPress={pressTab} />
    </View>
  );
}

function NavItem({
  tab,
  label,
  icon,
  Icon,
  active,
  onPress,
}: {
  tab: Tab;
  label: string;
  icon?: string;
  Icon?: () => React.ReactNode;
  active: boolean;
  onPress: (tab: Tab) => void;
}) {
  return (
    <Pressable onPress={() => onPress(tab)} style={[styles.navItem, active && styles.navItemActive]}>
      {Icon ? <Icon /> : <Text style={styles.navIcon}>{icon}</Text>}
      {active && <Text style={styles.navLabel}>{label}</Text>}
    </Pressable>
  );
}

function MailNavIcon() {
  return (
    <View style={styles.mailIcon}>
      <View style={styles.mailLineLeft} />
      <View style={styles.mailLineRight} />
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

function JamJarIcon() {
  return (
    <View style={styles.jamJarIcon}>
      <View style={styles.jamJarLid} />
      <View style={styles.jamJarBody}>
        <View style={styles.jamJarLabel} />
        <View style={styles.jamJarShine} />
      </View>
    </View>
  );
}

function SwipeBackSurface({
  children,
  onBack,
  style,
  resetKey,
}: {
  children: React.ReactNode;
  onBack: () => void;
  style?: StyleProp<ViewStyle>;
  resetKey?: string | boolean | null;
}) {
  const [translateX] = useState(() => new Animated.Value(0));
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
    translateX.setValue(0);
    closingRef.current = false;
  }, [resetKey, translateX]);
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
  if (uri) {
    return <Image source={{ uri }} style={[styles.avatarImage, avatarStyle]} alt="profile photo" />;
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
    const radius = 9.5;
    return {
      left: 11 + Math.cos(angle) * radius,
      top: 11 + Math.sin(angle) * radius,
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
          const source = getGridVideoSource(video);
          const content = (
            <>
              {source ? (
                <Video source={{ uri: source }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} isMuted />
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

function getVideoCaption(video: ProfileVideo | FeedVideo) {
  return "caption" in video ? video.caption ?? "video" : "video";
}

function profileToFeedVideo(
  profile: Profile,
  video: ProfileVideo | undefined,
  likedByMe: boolean,
  likedMe: boolean,
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
    mediaUrl: video?.mediaUrl ?? video?.media_url ?? null,
    cloudflareStreamId: video?.cloudflareStreamId ?? video?.cloudflare_stream_id ?? null,
    earlyAdopter: Boolean(profile.early_adopter),
    createdAt: video?.created_at ?? new Date().toISOString(),
    likedByMe,
    likedMe,
    mutual: likedByMe && likedMe,
    jammedByMe: likedByMe,
    jammedMe: likedMe,
  };
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
  app: { flex: 1, backgroundColor: dark },
  tabScene: { backgroundColor: dark },
  safe: { flex: 1, backgroundColor: dark },
  safeWithNav: { flex: 1, paddingBottom: 92, backgroundColor: dark },
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
  screenContent: { padding: 22, gap: 16 },
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
  chipText: { color: "#e4e4e7", fontSize: 14, textTransform: "lowercase" },
  suggestionList: { overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: panel },
  suggestionItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
  suggestionText: { color: "#e4e4e7", fontSize: 15, textTransform: "lowercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSpacer: { width: 42, height: 42 },
  twoCol: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  profileCentered: { alignItems: "center", gap: 7, paddingVertical: 8 },
  avatarImage: { backgroundColor: panel },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#27272a" },
  avatarText: { color: "#fff", fontWeight: "800" },
  goldBadge: { width: 31, height: 31, alignItems: "center", justifyContent: "center" },
  goldBadgeScallop: { position: "absolute", width: 9.5, height: 9.5, borderRadius: 4.75, backgroundColor: "#d5a231" },
  goldBadgeBase: { width: 25, height: 25, borderRadius: 12.5, alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#f8d363", shadowOpacity: 0.38, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 4 },
  goldBadgeInnerRing: { position: "absolute", width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#050505" },
  checkMark: { width: 15, height: 12, marginLeft: 1, marginTop: -1, alignItems: "center", justifyContent: "center" },
  checkStroke: { width: 12.5, height: 7, borderLeftWidth: 4, borderBottomWidth: 4, borderColor: "#020202", transform: [{ rotate: "-45deg" }] },
  feedRoot: { flex: 1, backgroundColor: "#000" },
  fullscreenVideoRoot: { flex: 1, backgroundColor: "#000", justifyContent: "flex-end" },
  filterButton: { position: "absolute", right: 18, zIndex: 20, width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: border, backgroundColor: "rgba(24,24,27,0.82)", alignItems: "center", justifyContent: "center" },
  iconText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  closeIconText: { color: "#fff", fontSize: 28, fontWeight: "500", lineHeight: 30 },
  feedItem: { width: "100%", backgroundColor: "#000", justifyContent: "flex-end" },
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
  jamJarIcon: { width: 31, height: 36, alignItems: "center", justifyContent: "flex-end" },
  jamJarLid: { width: 23, height: 7, borderRadius: 3, borderWidth: 2, borderColor: "#fff", marginBottom: -1 },
  jamJarBody: { width: 27, height: 27, borderRadius: 9, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  jamJarLabel: { width: 13, height: 10, borderRadius: 4, backgroundColor: "#fff" },
  jamJarShine: { position: "absolute", top: 5, left: 6, width: 4, height: 10, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.65)" },
  videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, backgroundColor: "#09090b" },
  emptyFeed: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 28 },
  endOfFeed: { alignItems: "center", justifyContent: "center", gap: 18, padding: 28, backgroundColor: dark },
  emptyText: { color: "#e4e4e7", fontSize: 22, lineHeight: 31, textAlign: "center", fontWeight: "700" },
  modalShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)" },
  topSheet: { position: "absolute", left: 0, right: 0, top: 0, gap: 10, padding: 22, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#09090b" },
  bottomModalWrap: { flex: 1, justifyContent: "flex-end" },
  bottomCard: { gap: 14, padding: 18, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: border, backgroundColor: "#09090b" },
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
  chatContent: { flexGrow: 1, gap: 10, padding: 16 },
  bubble: { maxWidth: "82%", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  bubbleIn: { alignSelf: "flex-start", backgroundColor: panel },
  bubbleOut: { alignSelf: "flex-end", backgroundColor: "#fff" },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 22 },
  bubbleTextOut: { color: "#000" },
  composer: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: border },
  sendButton: { paddingHorizontal: 16, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  sendButtonText: { color: "#000", fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  gridItem: { width: "32.5%", aspectRatio: 9 / 16, overflow: "hidden", alignItems: "flex-end", justifyContent: "flex-end", padding: 8, backgroundColor: panel },
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
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 92, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: border, backgroundColor: "rgba(10,10,10,0.96)" },
  navItem: { height: 58, minWidth: 58, borderRadius: 18, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  navItemActive: { minWidth: 132, borderColor: "#93c5fd", backgroundColor: panel },
  navIcon: { color: "#fff", fontSize: 23 },
  navLabel: { color: "#fff", fontSize: 16, textTransform: "lowercase" },
  gridNavIcon: { width: 23, height: 23, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  gridNavCell: { width: 9, height: 9, borderWidth: 1.8, borderColor: "#fff", borderRadius: 3 },
  mailIcon: { width: 24, height: 18, borderWidth: 1.8, borderColor: "#fff", borderRadius: 4, overflow: "hidden" },
  mailLineLeft: { position: "absolute", left: 0, top: 4, width: 15, height: 1.8, borderRadius: 1, backgroundColor: "#fff", transform: [{ rotate: "32deg" }] },
  mailLineRight: { position: "absolute", right: 0, top: 4, width: 15, height: 1.8, borderRadius: 1, backgroundColor: "#fff", transform: [{ rotate: "-32deg" }] },
  createNav: { width: 66, height: 66, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  createNavText: { color: "#000", fontSize: 38, lineHeight: 41, fontWeight: "600" },
  toast: { position: "absolute", top: 76, left: 18, right: 18, zIndex: 30, alignItems: "center" },
  toastText: { color: "#fecaca", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(127,29,29,0.82)" },
});
