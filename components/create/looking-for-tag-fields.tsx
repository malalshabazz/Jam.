import { View, type RefObject } from "react-native";
import { LinedTagField } from "@/components/create/lined-tag-field";
import { creatorRoles, musicGenres } from "@/lib/options";
import { styles } from "@/theme/styles";

export function LookingForTagFields({
  selectedRoles,
  selectedGenres,
  onToggleRole,
  onToggleGenre,
  onInputFocus,
}: {
  selectedRoles: string[];
  selectedGenres: string[];
  onToggleRole: (role: string) => void;
  onToggleGenre: (genre: string) => void;
  onInputFocus?: (fieldRef: RefObject<View | null>) => void;
}) {
  return (
    <View style={styles.createLookingForTagFields}>
      <LinedTagField
        placeholder="looking for role"
        options={creatorRoles}
        selected={selectedRoles}
        onToggle={onToggleRole}
        onInputFocus={onInputFocus}
      />
      <LinedTagField
        placeholder="looking for genre"
        options={musicGenres}
        selected={selectedGenres}
        onToggle={onToggleGenre}
        onInputFocus={onInputFocus}
      />
    </View>
  );
}
