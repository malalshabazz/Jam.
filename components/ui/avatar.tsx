import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle } from "react-native-svg";
import { styles } from "@/theme/styles";

const AVATAR_PLACEHOLDER_BG = "#E8E8E8";
const AVATAR_PLACEHOLDER_FG = "#A3A3A3";

export function AvatarSilhouette({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="50" fill={AVATAR_PLACEHOLDER_BG} />
      <Circle cx="50" cy="36" r="18" fill={AVATAR_PLACEHOLDER_FG} />
      <Circle cx="50" cy="104" r="44" fill={AVATAR_PLACEHOLDER_FG} />
    </Svg>
  );
}

function resolveAvatarUri(uri?: string | null) {
  if (typeof uri !== "string") return null;
  const trimmed = uri.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function Avatar({ uri, size, label }: { uri?: string | null; size: number; label?: string }) {
  const avatarStyle = { width: size, height: size, borderRadius: size / 2 };
  const resolvedUri = resolveAvatarUri(uri);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedUri]);

  return (
    <View
      style={[
        styles.avatarFallback,
        avatarStyle,
        { backgroundColor: AVATAR_PLACEHOLDER_BG, overflow: "hidden" },
      ]}
    >
      {label ? (
        <Text style={[styles.avatarText, { color: "#52525b", fontSize: Math.max(12, size / 4) }]}>
          {label}
        </Text>
      ) : (
        <AvatarSilhouette size={size} />
      )}
      {resolvedUri && !failed ? (
        <Image
          source={{ uri: resolvedUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={resolvedUri}
          transition={0}
          priority="high"
          accessibilityLabel="profile photo"
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}
