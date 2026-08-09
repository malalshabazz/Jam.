import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
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
  createEarlyAdopterWelcome,
  fetchProfile,
  markWelcomeSeen,
  saveProfile,
} from "@/lib/native-social-data";
import {
  uploadNativeProfileAvatar,
  type NativeAvatarAsset,
} from "@/lib/native-avatar-storage";
import { fadeAnimatedValue } from "@/lib/animation";
import { getUniqueStrings } from "@/lib/format";
import {
  formatProfileLocation,
  getProfileLocationParts,
} from "@/lib/location-filter";
import { useSuggestions } from "@/lib/use-suggestions";
import {
  MAX_ACCOUNT_CREATOR_TYPES,
  viewportWidth,
} from "@/theme/tokens";
import { styles } from "@/theme/styles";
import { ProfileLocationPicker } from "@/components/ui/profile-location-picker";
import { Avatar } from "@/components/ui/avatar";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ChipRow } from "@/components/ui/chip-row";
import { SectionLabel } from "@/components/ui/section-label";
import { SuggestionList } from "@/components/ui/suggestion-list";

export function OnboardingScreen({
  userId,
  onFinished,
  initialStep = 1,
}: {
  userId: string;
  onFinished: (isEarlyAdopter: boolean) => void;
  initialStep?: 1 | 2 | 3;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const onboardingSlideX = useRef(new Animated.Value(-(initialStep - 1) * viewportWidth)).current;
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<NativeAvatarAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboardingExitOpacity = useRef(new Animated.Value(initialStep > 1 ? 0 : 1)).current;
  const skipNextSlideAnimationRef = useRef(initialStep > 1);

  const creatorSuggestions = useSuggestions(creatorRoles, creatorQuery, creatorTypes);

  useEffect(() => {
    let active = true;
    void fetchProfile(userId).then((profile) => {
      if (!active || !profile) return;
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setCreatorTypes(getUniqueStrings(profile.creator_types ?? []).slice(0, MAX_ACCOUNT_CREATOR_TYPES));
      const nextLocation = getProfileLocationParts(profile);
      setCountry(nextLocation.country);
      setCity(nextLocation.city);
      setLocationQuery("");
      setAvatarUrl(profile.avatar_url ?? null);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (initialStep > 1) {
      void fadeAnimatedValue(onboardingExitOpacity, 1, 320);
    }
  }, [initialStep, onboardingExitOpacity]);

  useEffect(() => {
    const toValue = -(step - 1) * viewportWidth;
    if (skipNextSlideAnimationRef.current) {
      onboardingSlideX.setValue(toValue);
      skipNextSlideAnimationRef.current = false;
      return;
    }

    Animated.timing(onboardingSlideX, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [onboardingSlideX, step]);

  async function applyAvatarAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.uri) return;

    setAvatarUrl(asset.uri);
    setAvatarAsset({
      uri: asset.uri,
      fileName: asset.fileName ?? asset.uri.split("/").pop() ?? "avatar.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }

  async function pickAvatarFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("permission needed", "photo library access is needed to choose a profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await applyAvatarAsset(result.assets[0]);
    }
  }

  async function pickAvatarFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("permission needed", "camera access is needed to take a profile photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await applyAvatarAsset(result.assets[0]);
    }
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

  function goBack() {
    if (step === 1) return;
    setError(null);
    setStep((current) => (current - 1) as 1 | 2 | 3);
  }

  function continueStep() {
    setError(null);

    if (step === 1) {
      if (!displayName.trim()) {
        setError("add a name to continue");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (creatorTypes.length === 0) {
        setError("choose at least one creator type");
        return;
      }
      setStep(3);
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
      const nextCreatorTypes = getUniqueStrings(creatorTypes).slice(0, MAX_ACCOUNT_CREATOR_TYPES);
      const nextAvatarUrl = avatarAsset
        ? await uploadNativeProfileAvatar(userId, avatarAsset)
        : avatarUrl;
      const profile = await saveProfile(userId, {
        display_name: displayName.trim(),
        bio: bio.trim(),
        creator_types: nextCreatorTypes,
        country: country.trim() || null,
        city: city.trim() || null,
        location: formatProfileLocation(country, city),
        avatar_url: nextAvatarUrl,
        onboarding_complete: true,
        welcome_seen: false,
      });
      setAvatarUrl(nextAvatarUrl);
      setAvatarAsset(null);

      if (profile.early_adopter) {
        await createEarlyAdopterWelcome();
        await fadeAnimatedValue(onboardingExitOpacity, 0, 450);
        onFinished(true);
        return;
      }

      await markWelcomeSeen(userId);
      await fadeAnimatedValue(onboardingExitOpacity, 0, 450);
      onFinished(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Animated.View style={[styles.flex, { opacity: onboardingExitOpacity }]}>
      <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.onboardingHeader}>
          <Pressable
            onPress={goBack}
            disabled={step === 1}
            style={[styles.onboardingBackButton, step === 1 && styles.onboardingBackButtonHidden]}
            accessibilityLabel="go back"
          >
            <Text style={styles.onboardingBackText}>‹</Text>
          </Pressable>
          <Text style={styles.helper}>{step} of 3</Text>
          <View style={styles.onboardingHeaderSpacer} />
        </View>
        <View style={styles.onboardingProgressRow}>
          {[1, 2, 3].map((item) => (
            <View
              key={item}
              style={[styles.onboardingProgressSegment, item <= step && styles.onboardingProgressSegmentActive]}
            />
          ))}
        </View>

        <View style={styles.onboardingStepsViewport}>
          <Animated.View
            style={[
              styles.onboardingStepsTrack,
              { width: viewportWidth * 3, transform: [{ translateX: onboardingSlideX }] },
            ]}
          >
            <ScrollView
              style={styles.onboardingStepPanel}
              contentContainerStyle={styles.onboardingContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.logoSmall}>jam.</Text>
              <Text style={styles.h1}>whats your name?</Text>
              <Text style={styles.copy}>tell us what you want to go by.</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="display name"
                placeholderTextColor="#71717a"
                style={styles.input}
              />
            </ScrollView>

            <ScrollView
              style={styles.onboardingStepPanel}
              contentContainerStyle={styles.onboardingContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.h1}>who are you?</Text>
              <Text style={styles.copy}>pick your creator type, add a bio, and set your location.</Text>

              <SectionLabel label={`creator types (${creatorTypes.length}/${MAX_ACCOUNT_CREATOR_TYPES})`} />
              <Text style={styles.helper}>choose up to {MAX_ACCOUNT_CREATOR_TYPES} creator types for your account.</Text>
              <ChipRow
                items={creatorTypes}
                onRemove={(item) => setCreatorTypes((current) => current.filter((role) => role !== item))}
              />
              <TextInput
                value={creatorQuery}
                onChangeText={setCreatorQuery}
                placeholder="search creator type"
                placeholderTextColor="#71717a"
                style={styles.input}
              />
              <SuggestionList
                items={creatorSuggestions}
                maxVisibleItems={3}
                onPick={(role) => {
                  addCreatorType(role);
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
              <ProfileLocationPicker
                country={country}
                city={city}
                query={locationQuery}
                onQueryChange={setLocationQuery}
                onChange={(nextCountry, nextCity) => {
                  setCountry(nextCountry);
                  setCity(nextCity);
                }}
              />
            </ScrollView>

            <ScrollView
              style={styles.onboardingStepPanel}
              contentContainerStyle={styles.onboardingPhotoContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.onboardingPhotoIntro}>
                <Text style={[styles.h1, styles.onboardingPhotoTitle]}>profile pic</Text>
                <Text style={[styles.copy, styles.onboardingPhotoCopy]}>
                  optional. add a photo so collaborators can recognize you.
                </Text>
              </View>
              <View style={styles.onboardingAvatarPicker}>
                <Avatar uri={avatarUrl} size={200} />
                <View style={styles.onboardingAvatarActions}>
                  <Pressable style={styles.onboardingAvatarActionButton} onPress={() => void pickAvatarFromCamera()}>
                    <Text style={styles.onboardingAvatarActionText}>take photo</Text>
                  </Pressable>
                  <Pressable style={styles.onboardingAvatarActionButton} onPress={() => void pickAvatarFromLibrary()}>
                    <Text style={styles.onboardingAvatarActionText}>choose photo</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <View style={[styles.onboardingFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {step < 3 ? (
            <PrimaryButton label="next" onPress={continueStep} style={styles.onboardingFooterButton} />
          ) : (
            <>
              <PrimaryButton
                label={saving ? "saving..." : "next"}
                disabled={saving}
                onPress={finish}
                style={styles.onboardingFooterButton}
              />
              {!avatarUrl && (
                <Pressable disabled={saving} onPress={finish} style={styles.onboardingSkipButton}>
                  <Text style={styles.onboardingSkipText}>skip for now</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </Animated.View>
  );
}
