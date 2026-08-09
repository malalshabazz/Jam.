import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { creatorRoles, musicGenres } from "@/lib/options";
import {
  categoryAlertKey,
  formatCategoryAlertLabel,
  loadNotificationPreferences,
  saveNotificationPreferences,
  type CategoryAlertSubscription,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import {
  LOCATION_PICKER_VISIBLE_HEIGHT,
  TAB_SCREEN_MIN_TOP_PADDING,
  TAB_SCREEN_TOP_PADDING,
} from "@/theme/tokens";
import { getActivityIndicatorColor, styles } from "@/theme/styles";
import { SectionLabel } from "@/components/ui/section-label";
import { SwipeBackSurface } from "@/components/ui/swipe-back-surface";

export function NotificationsSettingsModal({
  visible,
  currentUserId,
  onClose,
}: {
  visible: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleQuery, setRoleQuery] = useState("");
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [draftGenres, setDraftGenres] = useState<string[]>([]);

  const roleMatches = useMemo(() => {
    const query = roleQuery.trim().toLowerCase();
    return creatorRoles.filter((role) => !query || role.toLowerCase().includes(query));
  }, [roleQuery]);

  function getSavedGenresForRole(role: string) {
    return (
      preferences?.categoryAlerts
        .filter((alert) => alert.role === role && alert.genre)
        .map((alert) => alert.genre) ?? []
    );
  }

  function hasRoleOnlyAlert(role: string) {
    return preferences?.categoryAlerts.some((alert) => alert.role === role && !alert.genre) ?? false;
  }

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setLoading(true);
    void loadNotificationPreferences(currentUserId)
      .then((nextPreferences) => {
        if (active) setPreferences(nextPreferences);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, visible]);

  useEffect(() => {
    if (!visible) {
      setRoleQuery("");
      setActiveRole(null);
      setDraftGenres([]);
    }
  }, [visible]);

  async function updatePreferences(nextPreferences: NotificationPreferences) {
    setPreferences(nextPreferences);
    await saveNotificationPreferences(currentUserId, nextPreferences);
  }

  function togglePreference(
    key: "inAppNotifications" | "jamRequests" | "jamAccepts" | "messages",
    value: boolean,
  ) {
    if (!preferences) return;
    void updatePreferences({ ...preferences, [key]: value });
  }

  function toggleRole(role: string) {
    if (activeRole === role) {
      setActiveRole(null);
      setDraftGenres([]);
      return;
    }

    setActiveRole(role);
    setDraftGenres(getSavedGenresForRole(role));
  }

  function toggleGenre(genre: string) {
    if (!activeRole) return;
    setDraftGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );
  }

  function confirmCategoryAlerts() {
    if (!preferences || !activeRole) return;

    const nextAlerts = preferences.categoryAlerts.filter((alert) => alert.role !== activeRole);
    if (draftGenres.length === 0) {
      nextAlerts.push({ role: activeRole, genre: "" });
    } else {
      for (const genre of draftGenres) {
        nextAlerts.push({ role: activeRole, genre });
      }
    }

    void updatePreferences({
      ...preferences,
      categoryAlerts: nextAlerts,
    });
    setActiveRole(null);
    setDraftGenres([]);
    setRoleQuery("");
  }

  function removeCategoryAlert(subscription: CategoryAlertSubscription) {
    if (!preferences) return;
    const key = categoryAlertKey(subscription);
    void updatePreferences({
      ...preferences,
      categoryAlerts: preferences.categoryAlerts.filter((item) => categoryAlertKey(item) !== key),
    });
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible ? "notifications-settings" : null} onBack={onClose} style={styles.flex} enterFromRight>
        <View style={styles.safe}>
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              {
                paddingTop: Math.max(insets.top + TAB_SCREEN_TOP_PADDING, TAB_SCREEN_MIN_TOP_PADDING),
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>notifications</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>done</Text>
              </Pressable>
            </View>

            {loading || !preferences ? (
              <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
            ) : (
              <>
                <View style={styles.notificationSettingsSection}>
                  <SectionLabel label="in app" />
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>in-app notifications</Text>
                    <Switch
                      value={preferences.inAppNotifications}
                      onValueChange={(value) => togglePreference("inAppNotifications", value)}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <Text style={styles.notificationSettingsCopy}>
                    show banners when you get jam requests, accepts, and messages.
                  </Text>
                </View>

                <View
                  style={[
                    styles.notificationSettingsSection,
                    !preferences.inAppNotifications && styles.subdued,
                  ]}
                  pointerEvents={preferences.inAppNotifications ? "auto" : "none"}
                >
                  <SectionLabel label="activity" />
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>jam requests</Text>
                    <Switch
                      value={preferences.jamRequests}
                      onValueChange={(value) => togglePreference("jamRequests", value)}
                      disabled={!preferences.inAppNotifications}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>jam accepts</Text>
                    <Switch
                      value={preferences.jamAccepts}
                      onValueChange={(value) => togglePreference("jamAccepts", value)}
                      disabled={!preferences.inAppNotifications}
                      style={styles.settingsSwitch}
                    />
                  </View>
                  <View style={styles.settingsRow}>
                    <Text style={[styles.settingsText, styles.settingsRowLabel]}>messages</Text>
                    <Switch
                      value={preferences.messages}
                      onValueChange={(value) => togglePreference("messages", value)}
                      disabled={!preferences.inAppNotifications}
                      style={styles.settingsSwitch}
                    />
                  </View>
                </View>

                <View style={styles.notificationSettingsSection}>
                  <SectionLabel label="new in your area" />
                  <Text style={styles.notificationSettingsCopy}>
                    get notified when new videos are posted in a category you care about.
                  </Text>

                  {preferences.categoryAlerts.length > 0 ? (
                    <View style={styles.chips}>
                      {preferences.categoryAlerts.map((subscription) => (
                        <Pressable
                          key={categoryAlertKey(subscription)}
                          style={styles.chip}
                          onPress={() => removeCategoryAlert(subscription)}
                        >
                          <Text style={styles.chipText}>{formatCategoryAlertLabel(subscription)} ×</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.notificationCategoryPicker}>
                    <TextInput
                      value={roleQuery}
                      onChangeText={setRoleQuery}
                      placeholder="search roles..."
                      placeholderTextColor="#71717a"
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <View style={styles.notificationCategoryPickerHeader}>
                      <Text style={styles.helper}>
                        {!activeRole
                          ? "no category selection"
                          : draftGenres.length === 0
                            ? "any genre"
                            : `${draftGenres.length} genre ${draftGenres.length === 1 ? "selection" : "selections"}`}
                      </Text>
                      <Pressable
                        style={[
                          styles.notificationConfirmButton,
                          !activeRole && styles.disabled,
                        ]}
                        disabled={!activeRole}
                        onPress={confirmCategoryAlerts}
                        accessibilityLabel="confirm categories"
                      >
                        <Text style={styles.notificationConfirmText}>✓</Text>
                      </Pressable>
                    </View>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={[
                        styles.locationFilterList,
                        { maxHeight: LOCATION_PICKER_VISIBLE_HEIGHT },
                      ]}
                    >
                      {roleMatches.map((role) => {
                        const isActive = activeRole === role;
                        const savedGenres = getSavedGenresForRole(role);
                        const isRoleOnlySaved = hasRoleOnlyAlert(role);
                        const isRoleOnlySelected = isRoleOnlySaved && savedGenres.length === 0;
                        const isPartiallySelected = savedGenres.length > 0;

                        return (
                          <View key={role} style={styles.locationCountryGroup}>
                            <Pressable style={styles.locationOptionRow} onPress={() => toggleRole(role)}>
                              <View
                                style={[
                                  styles.locationCircle,
                                  (isActive || isRoleOnlySelected) && styles.locationCircleSelected,
                                  !isActive && isPartiallySelected && styles.locationCirclePartial,
                                ]}
                              >
                                {!isActive && isPartiallySelected ? (
                                  <View style={styles.locationCirclePartialFill} />
                                ) : null}
                              </View>
                              <Text style={styles.locationCountryText}>{role}</Text>
                            </Pressable>
                            {isActive ? (
                              <View style={styles.locationCityList}>
                                {musicGenres.map((genre) => {
                                  const isGenreSelected = draftGenres.includes(genre);
                                  return (
                                    <Pressable
                                      key={genre}
                                      style={styles.locationCityRow}
                                      onPress={() => toggleGenre(genre)}
                                    >
                                      <View
                                        style={[
                                          styles.locationCityCircle,
                                          isGenreSelected && styles.locationCircleSelected,
                                        ]}
                                      />
                                      <Text style={styles.locationCityText}>{genre}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </SwipeBackSurface>
    </Modal>
  );
}
