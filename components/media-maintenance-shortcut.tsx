import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter, useSegments } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { useLmsSession } from "@/lib/lms-session";

export function MediaMaintenanceShortcut() {
  const { user } = useLmsSession();
  const router = useRouter();
  const segments = useSegments();
  const inOperations = segments[0] === "operations";
  const alreadyMaintainingMedia = segments[1] === "media-maintenance";

  if (!user || user.role === "student" || !inOperations || alreadyMaintainingMedia) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Maintain published media" onPress={() => router.push("/operations/media-maintenance" as never)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><MaterialIcons name="video-settings" size={18} color="#FFFFFF" /><Text style={styles.label}>Maintain media</Text></Pressable>;
}

const styles = StyleSheet.create({
  button: { position: "absolute", right: 18, bottom: 76, zIndex: 20, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "#287A5A", flexDirection: "row", alignItems: "center", gap: 7, elevation: 4 },
  label: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});
