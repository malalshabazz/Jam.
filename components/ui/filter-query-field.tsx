import { useRef } from "react";
import { Animated, Easing, Pressable, Text, TextInput, View } from "react-native";
import { darkStyles, styles } from "@/theme/styles";

function FilterResetButton({ onReset }: { onReset: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const spinRotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-360deg"],
  });

  function handlePress() {
    spin.setValue(0);
    Animated.parallel([
      Animated.timing(spin, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.86,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    onReset();
  }

  return (
    <Pressable
      style={styles.filterResetButton}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="reset"
    >
      <Animated.View style={{ transform: [{ rotate: spinRotation }, { scale }] }}>
        <Text style={styles.filterResetIcon}>↺</Text>
      </Animated.View>
    </Pressable>
  );
}

export function FilterQueryField({
  value,
  onChangeText,
  placeholder,
  onReset,
  onFocus,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onReset: () => void;
  onFocus?: () => void;
}) {
  return (
    <View style={styles.filterQueryRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor="#71717a"
        style={[darkStyles.input, styles.filterQueryInput]}
      />
      <FilterResetButton onReset={onReset} />
    </View>
  );
}
