import { Image, View, type ImageStyle } from "react-native";
import { styles } from "@/theme/styles";

/** Circular app-logo mark used for Jam system messages. */
export function JamSystemAvatar({ size }: { size: number }) {
  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: "#000",
        },
      ]}
      accessibilityLabel="jam"
    >
      <Image
        source={require("../../assets/mock-jam-jar-logo.png")}
        style={{ width: size, height: size } as ImageStyle}
        resizeMode="cover"
      />
    </View>
  );
}
