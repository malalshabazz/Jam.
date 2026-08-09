import { Alert, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  PRO_UNLOCK_VIDEO_COUNT,
  type ProBadgeKind,
} from "@/lib/pro-entitlements";
import { styles } from "@/theme/styles";

export function GoldBadge() {
  return <VerificationBadge tone="gold" />;
}

export function BlueBadge() {
  return <VerificationBadge tone="blue" />;
}

export function ProBadge({ kind }: { kind: ProBadgeKind }) {
  return kind === "blue" ? <BlueBadge /> : <GoldBadge />;
}

export function VerificationBadge({ tone }: { tone: ProBadgeKind }) {
  const colors =
    tone === "blue"
      ? (["#0b3a7a", "#2f7de1", "#9fd0ff", "#2a6fd0", "#0a2f66"] as const)
      : (["#8b5b10", "#d7a435", "#fff36f", "#c98d21", "#7b4e0b"] as const);

  return (
    <View style={styles.goldBadge}>
      <LinearGradient
        colors={[...colors]}
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

export function ProProgressBar({ posted }: { posted: number }) {
  const clamped = Math.max(0, Math.min(posted, PRO_UNLOCK_VIDEO_COUNT));
  const progress = clamped / PRO_UNLOCK_VIDEO_COUNT;
  const remaining = Math.max(0, PRO_UNLOCK_VIDEO_COUNT - clamped);

  function handlePress() {
    if (remaining <= 0) return;
    const videoWord = remaining === 1 ? "video" : "videos";
    Alert.alert(
      "pro membership",
      `post ${remaining} more ${videoWord} to unlock pro membership.`,
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.proProgressWrap}
      accessibilityRole="button"
      accessibilityLabel={`${clamped} of ${PRO_UNLOCK_VIDEO_COUNT} videos to pro. post ${remaining} more ${remaining === 1 ? "video" : "videos"} to unlock pro membership.`}
      accessibilityValue={{ min: 0, max: PRO_UNLOCK_VIDEO_COUNT, now: clamped }}
      hitSlop={8}
    >
      <Text style={styles.proProgressLabel}>
        {clamped}/{PRO_UNLOCK_VIDEO_COUNT}
      </Text>
      <View style={styles.proProgressTrack}>
        <View style={[styles.proProgressFill, { flex: progress }]} />
        <View style={{ flex: Math.max(0.0001, 1 - progress) }} />
      </View>
    </Pressable>
  );
}
