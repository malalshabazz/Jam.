import AsyncStorage from "@react-native-async-storage/async-storage";

const PASSWORD_RECOVERY_PENDING_KEY = "jam.passwordRecoveryPending";

/** Persist across process death — recovery sessions don't re-fire PASSWORD_RECOVERY. */
export async function markPasswordRecoveryPending() {
  await AsyncStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, "1");
}

export async function clearPasswordRecoveryPending() {
  await AsyncStorage.removeItem(PASSWORD_RECOVERY_PENDING_KEY);
}

export async function isPasswordRecoveryPending() {
  try {
    return (await AsyncStorage.getItem(PASSWORD_RECOVERY_PENDING_KEY)) === "1";
  } catch {
    return false;
  }
}
