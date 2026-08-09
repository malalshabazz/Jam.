import { Image, Text, View, type ImageStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { styles } from "@/theme/styles";

export function AvatarSilhouette({ size }: { size: number }) {
  const iconSize = size * 0.52;
  return (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="3.5" fill="#71717a" />
      <Path d="M5 20a7 7 0 0 1 14 0" fill="#71717a" />
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

  // Prefer a real avatar_url whenever one exists — never fall back to label/silhouette.
  if (resolvedUri) {
    return (
      <Image
        key={resolvedUri}
        source={{ uri: resolvedUri }}
        style={[styles.avatarImage as ImageStyle, avatarStyle]}
        accessibilityLabel="profile photo"
      />
    );
  }

  return (
    <View style={[styles.avatarFallback, avatarStyle]}>
      {label ? (
        <Text style={[styles.avatarText, { fontSize: Math.max(12, size / 4) }]}>{label}</Text>
      ) : (
        <AvatarSilhouette size={size} />
      )}
    </View>
  );
}
