import * as Linking from "expo-linking";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  disableLiveLocationSharing,
  enableLiveLocationSharing,
  isLiveLocationSharingEnabled,
} from "@/lib/live-location-sharing";
import {
  NEAR_ME_RADIUS_OPTIONS,
  normalizeNearMeRadius,
  type NearMeRadiusMiles,
} from "@/lib/location-distance";
import { saveProfile, type Profile } from "@/lib/native-social-data";
import type { ThemeMode } from "@/types/app";
import { viewportWidth } from "@/theme/tokens";
import { styles } from "@/theme/styles";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import { BlockedUsersModal } from "@/components/profile/blocked-users-modal";
import { NotificationsSettingsModal } from "@/components/profile/notifications-settings-modal";
import { TermsAndPoliciesModal } from "@/components/profile/terms-and-policies-modal";

function SettingsButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.settingsButton} onPress={onPress}>
      <Text style={styles.settingsText}>{label}</Text>
    </Pressable>
  );
}

export function SettingsDrawerModal({
  visible,
  currentUserId,
  themeMode,
  onThemeModeChange,
  profile,
  onClose,
  onProfileUpdated,
  onLoggedOut,
}: {
  visible: boolean;
  currentUserId: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  profile: Profile | null;
  onClose: () => void;
  onProfileUpdated: (profile: Profile) => void;
  onLoggedOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const drawerWidth = viewportWidth * 0.8;
  const [mounted, setMounted] = useState(visible);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [termsAndPoliciesOpen, setTermsAndPoliciesOpen] = useState(false);
  const [savingNearMeRadius, setSavingNearMeRadius] = useState(false);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [savingShareLiveLocation, setSavingShareLiveLocation] = useState(false);
  const selectedNearMeRadius = normalizeNearMeRadius(profile?.near_me_radius_miles);
  const [translateX] = useState(() => new Animated.Value(drawerWidth));
  const closingRef = useRef(false);
  /** Bumps on each open/close so late animation callbacks can't stomp a new open. */
  const animGenerationRef = useRef(0);
  const openAnimFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const backdropOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, drawerWidth],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [drawerWidth, translateX],
  );
  const handleGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: translateX } }], {
        useNativeDriver: true,
      }),
    [translateX],
  );

  useLayoutEffect(() => {
    if (!visible) return;

    const generation = ++animGenerationRef.current;
    closingRef.current = false;
    // Mount immediately so the Modal is on-screen for the slide-in.
    setMounted(true);
    translateX.stopAnimation();
    translateX.setValue(drawerWidth);

    if (openAnimFrameRef.current != null) {
      cancelAnimationFrame(openAnimFrameRef.current);
      openAnimFrameRef.current = null;
    }

    let cancelled = false;
    // Two frames: commit mount, then let the Modal present before animating.
    openAnimFrameRef.current = requestAnimationFrame(() => {
      openAnimFrameRef.current = requestAnimationFrame(() => {
        openAnimFrameRef.current = null;
        if (cancelled || generation !== animGenerationRef.current || closingRef.current) return;
        Animated.timing(translateX, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    });

    return () => {
      cancelled = true;
      if (openAnimFrameRef.current != null) {
        cancelAnimationFrame(openAnimFrameRef.current);
        openAnimFrameRef.current = null;
      }
    };
  }, [drawerWidth, translateX, visible]);

  useEffect(() => {
    if (!visible || !profile) return;

    let active = true;
    void isLiveLocationSharingEnabled(profile.id).then((enabled) => {
      if (!active) return;
      setShareLiveLocation(enabled);
    });

    return () => {
      active = false;
    };
  }, [profile?.id, visible]);

  useEffect(() => {
    if (visible) return;
    setAccountOpen(false);
    setBlockedUsersOpen(false);
    setNotificationsOpen(false);
    setTermsAndPoliciesOpen(false);
    setLogoutConfirmOpen(false);
  }, [visible]);

  function animateNearMeRadiusReveal(show: boolean) {
    LayoutAnimation.configureNext({
      duration: 280,
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
    });
    setShareLiveLocation(show);
  }

  function animateClosed(afterClose?: () => void) {
    if (closingRef.current) return;
    closingRef.current = true;
    const generation = ++animGenerationRef.current;
    if (openAnimFrameRef.current != null) {
      cancelAnimationFrame(openAnimFrameRef.current);
      openAnimFrameRef.current = null;
    }
    translateX.stopAnimation();
    Animated.timing(translateX, {
      toValue: drawerWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // A newer open superseded this close — leave the drawer alone.
      if (generation !== animGenerationRef.current) return;
      closingRef.current = false;
      if (!finished) return;
      setMounted(false);
      onClose();
      afterClose?.();
    });
  }

  function closeWithAnimation() {
    animateClosed();
  }

  function openAccount() {
    // Push account as a stack screen over the open drawer — do not close the drawer.
    setAccountOpen(true);
  }

  async function updateNearMeRadius(nextRadius: NearMeRadiusMiles) {
    if (!profile || savingNearMeRadius || nextRadius === selectedNearMeRadius) return;

    setSavingNearMeRadius(true);
    try {
      const updatedProfile = await saveProfile(profile.id, { near_me_radius_miles: nextRadius });
      onProfileUpdated(updatedProfile);
    } catch (err) {
      Alert.alert(
        "could not save radius",
        err instanceof Error ? err.message : "try again in a moment.",
      );
    } finally {
      setSavingNearMeRadius(false);
    }
  }

  async function toggleShareLiveLocation(enabled: boolean) {
    if (!profile || savingShareLiveLocation) return;

    // Reveal/hide immediately so the pills track the switch, then persist.
    animateNearMeRadiusReveal(enabled);
    setSavingShareLiveLocation(true);
    try {
      if (enabled) {
        const result = await enableLiveLocationSharing(profile.id);
        if ("error" in result) {
          animateNearMeRadiusReveal(false);
          Alert.alert("location needed", result.error, [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ]);
          return;
        }

        onProfileUpdated(result.profile);
        return;
      }

      const updatedProfile = await disableLiveLocationSharing(profile.id);
      onProfileUpdated(updatedProfile);
    } catch (err) {
      Alert.alert(
        "could not update live location",
        err instanceof Error ? err.message : "try again in a moment.",
      );
      const current = profile ? await isLiveLocationSharingEnabled(profile.id) : false;
      animateNearMeRadiusReveal(current);
    } finally {
      setSavingShareLiveLocation(false);
    }
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
        <Animated.View style={[styles.settingsBackdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation} />
        </Animated.View>
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
            <View
              style={[
                styles.settingsPanel,
                {
                  paddingTop: insets.top + 20,
                  paddingBottom: insets.bottom + 20,
                },
              ]}
            >
              <ScrollView
                style={styles.settingsPanelScroll}
                contentContainerStyle={styles.settingsPanelScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.cardTitle}>{profile?.display_name ?? "you"}</Text>
                <Text style={styles.helper}>{profile?.creator_types?.join(", ") || "creator"}</Text>
                <View style={styles.settingsToggleGroup}>
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>light mode</Text>
                    <Switch
                      value={themeMode === "light"}
                      onValueChange={(enabled) => onThemeModeChange(enabled ? "light" : "dark")}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <View style={styles.settingsLocationGroup}>
                    <View style={styles.settingsRow}>
                      <Text style={[styles.settingsText, styles.settingsRowLabel]}>share live location</Text>
                      <Switch
                        value={shareLiveLocation}
                        onValueChange={(enabled) => void toggleShareLiveLocation(enabled)}
                        disabled={savingShareLiveLocation}
                        style={styles.settingsSwitch}
                      />
                    </View>
                    <Text style={styles.settingsLiveLocationCopy}>
                      near me uses this to find creators around you. turning on near me also turns this on.
                    </Text>
                    {shareLiveLocation ? (
                      <View style={styles.settingsNearMeSection}>
                        <Text style={styles.settingsText}>near me radius</Text>
                        <View style={styles.nearMeRadiusRow}>
                          {NEAR_ME_RADIUS_OPTIONS.map((miles) => {
                            const isSelected = selectedNearMeRadius === miles;
                            return (
                              <Pressable
                                key={miles}
                                style={[
                                  styles.nearMeRadiusOption,
                                  isSelected && styles.nearMeRadiusOptionActive,
                                ]}
                                disabled={savingNearMeRadius}
                                onPress={() => void updateNearMeRadius(miles)}
                              >
                                <Text
                                  style={[
                                    styles.nearMeRadiusOptionText,
                                    isSelected && styles.nearMeRadiusOptionTextActive,
                                  ]}
                                >
                                  {miles} mi
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
                <SettingsButton label="account" onPress={openAccount} />
                <SettingsButton label="notifications" onPress={() => setNotificationsOpen(true)} />
                <SettingsButton label="blocked accounts" onPress={() => setBlockedUsersOpen(true)} />
                <SettingsButton label="help centre" />
                <SettingsButton label="terms and policies" onPress={() => setTermsAndPoliciesOpen(true)} />
              </ScrollView>
              <Pressable
                style={styles.logoutButton}
                onPress={() => setLogoutConfirmOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="log out"
              >
                <Text style={styles.logoutText}>log out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </PanGestureHandler>
        <ConfirmModal
          visible={logoutConfirmOpen}
          title="log out?"
          confirmLabel="log out"
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={() => {
            setLogoutConfirmOpen(false);
            void (async () => {
              try {
                await Promise.resolve(onLoggedOut());
              } catch (err) {
                Alert.alert(
                  "could not log out",
                  err instanceof Error ? err.message : "try again",
                );
              }
            })();
          }}
        />
        <AccountSettingsModal
          visible={accountOpen}
          themeMode={themeMode}
          onClose={() => setAccountOpen(false)}
          onDeleted={() => {
            setAccountOpen(false);
            void onLoggedOut();
          }}
        />
        <BlockedUsersModal
          visible={blockedUsersOpen}
          currentUserId={currentUserId}
          onClose={() => setBlockedUsersOpen(false)}
        />
        <NotificationsSettingsModal
          visible={notificationsOpen}
          currentUserId={currentUserId}
          onClose={() => setNotificationsOpen(false)}
        />
        <TermsAndPoliciesModal
          visible={termsAndPoliciesOpen}
          onClose={() => setTermsAndPoliciesOpen(false)}
        />
      </View>
    </Modal>
  );
}
