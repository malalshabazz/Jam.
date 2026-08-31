import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { creatorRoles } from "@/lib/options";
import {
  saveProfile,
  type Profile,
} from "@/lib/native-social-data";
import {
  uploadNativeProfileAvatar,
  type NativeAvatarAsset,
} from "@/lib/native-avatar-storage";
import { getUniqueStrings } from "@/lib/format";
import {
  formatProfileLocation,
  getProfileLocationParts,
  locationPartsToPlace,
} from "@/lib/location-filter";
import type { LocationPlace } from "@/types/app";
import { MAX_ACCOUNT_CREATOR_TYPES } from "@/theme/tokens";
import { styles } from "@/theme/styles";
import { Avatar } from "@/components/ui/avatar";
import { ChipRow } from "@/components/ui/chip-row";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ProfileLocationPicker } from "@/components/ui/profile-location-picker";
import { SectionLabel } from "@/components/ui/section-label";
import { SuggestionList } from "@/components/ui/suggestion-list";
import { SwipeBackSurface } from "@/components/ui/swipe-back-surface";
import { useSuggestions } from "@/lib/use-suggestions";

export function EditProfileModal({
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
  const [locationPlace, setLocationPlace] = useState<LocationPlace | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<NativeAvatarAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const initializedProfileIdRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  function ensureFieldVisible() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  useEffect(() => {
    if (!visible) {
      initializedProfileIdRef.current = null;
      return;
    }
    if (!profile || initializedProfileIdRef.current === profile.id) return;
    initializedProfileIdRef.current = profile.id;
    const frame = requestAnimationFrame(() => {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setCreatorTypes(getUniqueStrings(profile.creator_types ?? []).slice(0, MAX_ACCOUNT_CREATOR_TYPES));
      setLocationPlace(locationPartsToPlace(getProfileLocationParts(profile)));
      setLocationQuery("");
      setAvatarUrl(profile.avatar_url ?? null);
      setAvatarAsset(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [profile, visible]);

  const roleMatches = useSuggestions(creatorRoles, creatorQuery, creatorTypes);

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset?.uri) {
        setAvatarUrl(asset.uri);
        setAvatarAsset({
          uri: asset.uri,
          fileName: asset.fileName ?? asset.uri.split("/").pop() ?? "avatar.jpg",
          mimeType: asset.mimeType ?? "image/jpeg",
        });
      }
    }
  }

  function deleteAvatar() {
    setAvatarUrl(null);
    setAvatarAsset(null);
  }

  function openAvatarOptions() {
    Alert.alert("profile photo", "", [
      { text: "change", onPress: () => void chooseAvatar() },
      { text: "delete", style: "destructive", onPress: deleteAvatar },
      { text: "cancel", style: "cancel" },
    ]);
  }

  function addCreatorType(role: string) {
    setCreatorTypes((current) => {
      const uniqueCurrent = getUniqueStrings(current);
      if (uniqueCurrent.includes(role)) return uniqueCurrent;
      if (uniqueCurrent.length >= MAX_ACCOUNT_CREATOR_TYPES) {
        Alert.alert("maximum creator types", `choose up to ${MAX_ACCOUNT_CREATOR_TYPES} creator types for your account.`);
        return uniqueCurrent;
      }
      return [...uniqueCurrent, role];
    });
    setCreatorQuery("");
  }

  function removeCreatorType(roleToRemove: string) {
    setCreatorTypes((current) =>
      getUniqueStrings(current).filter((role) => role !== roleToRemove),
    );
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const nextCreatorTypes = getUniqueStrings(creatorTypes).slice(0, MAX_ACCOUNT_CREATOR_TYPES);
      const nextAvatarUrl = avatarAsset
        ? await uploadNativeProfileAvatar(profile.id, avatarAsset)
        : avatarUrl;
      const nextProfile = await saveProfile(profile.id, {
        display_name: displayName.trim(),
        bio: bio.trim(),
        creator_types: nextCreatorTypes,
        country: locationPlace?.country.trim() || null,
        city: locationPlace?.city?.trim() || null,
        region: locationPlace?.region?.trim() || null,
        country_code: locationPlace?.country_code?.trim() || null,
        location_granularity: locationPlace?.granularity ?? null,
        location: formatProfileLocation(
          locationPlace?.country ?? "",
          locationPlace?.city ?? "",
          locationPlace?.region,
        ),
        location_coordinates:
          locationPlace?.granularity === "city" &&
          locationPlace.latitude != null &&
          locationPlace.longitude != null
            ? { latitude: locationPlace.latitude, longitude: locationPlace.longitude }
            : null,
        avatar_url: nextAvatarUrl,
      });
      setAvatarUrl(nextAvatarUrl);
      setAvatarAsset(null);
      onSaved(nextProfile);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <SwipeBackSurface resetKey={visible} onBack={onClose} style={styles.flex} enterFromRight>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.flex}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={[
                styles.screenContent,
                { paddingBottom: Math.max(insets.bottom, 16) + keyboardInset + 24 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
            >
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>edit profile</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.helper}>cancel</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.editAvatarButton}
              onPress={openAvatarOptions}
              accessibilityLabel="profile photo options"
              accessibilityRole="button"
            >
              <Avatar uri={avatarUrl} size={92} />
              <Text style={styles.helper}>tap to change or delete</Text>
            </Pressable>
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="display name" placeholderTextColor="#71717a" style={styles.input} />
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="bio"
              placeholderTextColor="#71717a"
              style={[styles.input, styles.textArea]}
              multiline
              maxLength={150}
            />
            <SectionLabel label={`creator types (${creatorTypes.length}/${MAX_ACCOUNT_CREATOR_TYPES})`} />
            <Text style={styles.helper}>choose up to {MAX_ACCOUNT_CREATOR_TYPES} creator types for your account.</Text>
            <ChipRow items={creatorTypes} onRemove={removeCreatorType} />
            <TextInput
              value={creatorQuery}
              onChangeText={setCreatorQuery}
              onFocus={ensureFieldVisible}
              placeholder="search creator type"
              placeholderTextColor="#71717a"
              style={styles.input}
            />
            <SuggestionList items={roleMatches} maxVisibleItems={3} onPick={(role) => {
              addCreatorType(role);
            }} />
            <SectionLabel label="location" />
            <ProfileLocationPicker
              place={locationPlace}
              query={locationQuery}
              onQueryChange={setLocationQuery}
              onSearchFocus={ensureFieldVisible}
              onChange={setLocationPlace}
            />
            <PrimaryButton label={saving ? "saving..." : "save profile"} disabled={saving} onPress={save} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SwipeBackSurface>
    </Modal>
  );
}
