import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter, useSegments } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { useLmsSession } from "@/lib/lms-session";

export function OwnerPermissionsShortcut() {
  const { user } = useLmsSession();
  const router = useRouter();
  const segments = useSegments();
  const inOperations = segments[0] === "operations";
  const alreadyManagingPermissions = segments[1] === "permissions";

  if (user?.role !== "super_admin" || !inOperations || alreadyManagingPermissions) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Manage Teacher permissions" onPress={() => router.push("/operations/permissions" as never)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><MaterialIcons name="manage-accounts" size={18} color="#FFFFFF" /><Text style={styles.label}>Teacher access</Text></Pressable>;
}

const styles = StyleSheet.create({
  button: { position: "absolute", right: 18, bottom: 22, zIndex: 20, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "#15234C", flexDirection: "row", alignItems: "center", gap: 7, elevation: 4 },
  label: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});
