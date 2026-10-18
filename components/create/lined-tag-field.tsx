import { useMemo, useRef, useState, type RefObject } from "react";
import { TextInput, View } from "react-native";
import { TagPicker } from "@/components/create/tag-picker";
import { styles } from "@/theme/styles";

export function LinedTagField({
  placeholder,
  options,
  selected,
  onToggle,
  onInputFocus,
}: {
  placeholder: string;
  options: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onInputFocus?: (fieldRef: RefObject<View | null>) => void;
}) {
  const fieldRef = useRef<View>(null);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const chosen = new Set(selected);
    const filtered = needle
      ? options.filter((tag) => chosen.has(tag) || tag.toLowerCase().includes(needle))
      : options;
    return [...filtered.filter((tag) => chosen.has(tag)), ...filtered.filter((tag) => !chosen.has(tag))];
  }, [options, query, selected]);

  return (
    <View ref={fieldRef} style={styles.createLinedField} collapsable={false}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onFocus={() => onInputFocus?.(fieldRef)}
        placeholder={placeholder}
        placeholderTextColor="#71717a"
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.createLinedInput}
        underlineColorAndroid="transparent"
      />
      <View style={styles.createHairline} />
      <TagPicker
        compact
        scroll
        options={visible}
        selected={selected}
        onToggle={(tag) => {
          onToggle(tag);
          setQuery("");
        }}
      />
    </View>
  );
}
