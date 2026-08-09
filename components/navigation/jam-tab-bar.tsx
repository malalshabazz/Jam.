import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import type { Profile } from "@/lib/native-social-data";
import { usePendingUploadFeedProgress } from "@/lib/pending-video-uploads";
import { getNavBarHeight } from "@/lib/nav-bar";
import type { Tab } from "@/types/app";
import { darkStyles, styles, type AppStyleSet } from "@/theme/styles";
import { Avatar } from "@/components/ui/avatar";

export function JamTabBar({
  state,
  navigation,
  userId,
  currentUserProfile,
  unreadInboxCount,
  onShuffleDiscover,
  feedReady = true,
  chromeOpacity,
  chromeClear = false,
}: BottomTabBarProps & {
  userId: string;
  currentUserProfile: Profile | null;
  unreadInboxCount: number;
  onShuffleDiscover: () => void;
  feedReady?: boolean;
  chromeOpacity?: Animated.Value;
  chromeClear?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name as Tab;
  const navBarHeight = getNavBarHeight(insets.bottom);
  const navStyles = activeRoute === "discover" ? darkStyles : styles;
  const postingStatus = usePendingUploadFeedProgress(userId);
  const hideChromeOnDiscover = activeRoute === "discover" && Boolean(chromeOpacity);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Full-screen jam. boot — nav only appears once the discover feed is ready.
  if (!feedReady) return null;
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
      // Instant tab switch — LayoutAnimation here made every change feel laggy.
      navigation.navigate(route.name);
    }
  }

  // Height 0 so React Navigation doesn't reserve a second bottom inset — screens already
  // pad with safeWithNav. Nav + progress line overlay absolutely on top.
  return (
    <View pointerEvents="box-none" style={styles.uploadProgressNavWrap}>
      {postingStatus && activeRoute === "discover" ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.uploadProgressLine,
            { bottom: navBarHeight },
            hideChromeOnDiscover ? { opacity: chromeOpacity } : null,
          ]}
          accessibilityLabel={
            postingStatus.phase === "uploading"
              ? "Uploading video"
              : postingStatus.phase === "processing"
                ? postingStatus.progress < 32
                  ? "Rendering video edits"
                  : "Processing video"
                : "Finishing post"
          }
        >
          <View style={[styles.uploadProgressLineFill, { width: `${postingStatus.progress}%` }]} />
        </Animated.View>
      ) : null}
      <Animated.View
        pointerEvents={hideChromeOnDiscover && chromeClear ? "none" : "box-none"}
        style={[
          navStyles.nav,
          { height: navBarHeight, paddingBottom: Math.max(insets.bottom, 12) },
          hideChromeOnDiscover ? { opacity: chromeOpacity } : null,
        ]}
      >
        <NavItem
          tab="discover"
          label="discover"
          active={activeRoute === "discover"}
          onPress={pressTab}
          iconElement={<GridNavIcon styleSet={navStyles} />}
          styleSet={navStyles}
        />
        <Pressable style={navStyles.createNav} onPress={() => pressTab("create")}>
          <Text style={navStyles.createNavText}>+</Text>
        </Pressable>
        <NavItem
          tab="inbox"
          label="inbox"
          active={activeRoute === "inbox"}
          onPress={pressTab}
          iconElement={<MailNavIcon unreadCount={unreadInboxCount} styleSet={navStyles} />}
          styleSet={navStyles}
        />
        <NavItem
          tab="you"
          label="you"
          active={activeRoute === "you"}
          onPress={pressTab}
          iconElement={<ProfileNavIcon profile={currentUserProfile} />}
          styleSet={navStyles}
        />
      </Animated.View>
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
  styleSet = styles,
}: {
  tab: Tab;
  label: string;
  icon?: string;
  Icon?: () => React.ReactNode;
  iconElement?: React.ReactNode;
  active: boolean;
  onPress: (tab: Tab) => void;
  styleSet?: AppStyleSet;
}) {
  return (
    <Pressable onPress={() => onPress(tab)} style={[styleSet.navItem, active && styleSet.navItemActive]}>
      {iconElement ?? (Icon ? <Icon /> : <Text style={styleSet.navIcon}>{icon}</Text>)}
      {active && <Text style={styleSet.navLabel}>{label}</Text>}
    </Pressable>
  );
}

function ProfileNavIcon({ profile }: { profile: Profile | null }) {
  return (
    <Avatar
      uri={profile?.avatar_url}
      size={30}
    />
  );
}

function MailNavIcon({
  unreadCount = 0,
  styleSet = styles,
}: {
  unreadCount?: number;
  styleSet?: AppStyleSet;
}) {
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);
  const iconColor =
    (StyleSheet.flatten(styleSet.mailIcon)?.borderColor as string | undefined) ?? "#fff";

  return (
    <View style={styleSet.mailIconWrap}>
      <Svg width={26} height={19} viewBox="0 0 26 19" fill="none">
        <Rect
          x={1.4}
          y={1.4}
          width={23.2}
          height={16.2}
          rx={3.2}
          stroke={iconColor}
          strokeWidth={1.8}
        />
        <Path
          d="M 2.8 5.3 L 11.6 10.7 Q 13 11.7 14.4 10.7 L 23.2 5.3"
          stroke={iconColor}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {unreadCount > 0 && (
        <View style={styleSet.mailBadge}>
          <View style={styleSet.mailBadgeInner}>
            <Text style={styleSet.mailBadgeText}>{badgeText}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function GridNavIcon({ styleSet = styles }: { styleSet?: AppStyleSet }) {
  return (
    <View style={styleSet.gridNavIcon}>
      <View style={styleSet.gridNavCell} />
      <View style={styleSet.gridNavCell} />
      <View style={styleSet.gridNavCell} />
      <View style={styleSet.gridNavCell} />
    </View>
  );
}
