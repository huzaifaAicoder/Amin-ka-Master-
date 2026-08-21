import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/components/lms-ui";

const CONTROL_AREAS = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "health", label: "Health", icon: "monitor-heart" },
  { id: "branding", label: "Branding", icon: "palette" },
  { id: "access", label: "Access", icon: "admin-panel-settings" },
  { id: "users", label: "Users", icon: "people-alt" },
  { id: "templates", label: "Templates", icon: "account-tree" },
  { id: "content", label: "Content", icon: "inventory-2" },
  { id: "audit", label: "Audit", icon: "fact-check" },
] as const;

type ControlTab = (typeof CONTROL_AREAS)[number]["id"];

/**
 * A mobile-first map of the existing Developer tabs. It supplements, rather
 * than replaces, the horizontal tab strip so root controls are discoverable
 * without a hidden sideways swipe.
 */
export function DeveloperControlShortcutGrid({ active, onSelect }: { active: ControlTab; onSelect: (tab: ControlTab) => void }) {
  return <View accessibilityLabel="All Developer control areas" style={styles.wrap}>
    <View style={styles.headingRow}><View><Text style={styles.eyebrow}>ROOT CONTROL MAP</Text><Text style={styles.title}>All control areas</Text></View><Text style={styles.count}>8 AREAS</Text></View>
    <View style={styles.grid}>{CONTROL_AREAS.map((area) => <Pressable key={area.id} accessibilityRole="tab" accessibilityState={{ selected: active === area.id }} accessibilityLabel={`Open ${area.label}`} onPress={() => onSelect(area.id)} style={({ pressed }) => [styles.tile, active === area.id && styles.tileActive, pressed && styles.pressed]}><MaterialIcons name={area.icon} size={19} color={active === area.id ? COLORS.white : COLORS.indigo} /><Text numberOfLines={1} style={[styles.tileText, active === area.id && styles.tileTextActive]}>{area.label}</Text></Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 14, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: "#DCE4F3", backgroundColor: "#F7F9FE" },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 11 },
  eyebrow: { color: COLORS.earth, fontSize: 10, letterSpacing: 0.7, fontWeight: "900" },
  title: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 2 },
  count: { color: COLORS.indigo, fontSize: 10, letterSpacing: 0.6, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: COLORS.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "23.5%", minHeight: 72, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4, backgroundColor: COLORS.white, borderWidth: 1, borderColor: "#DCE4F3" },
  tileActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  tileText: { color: COLORS.indigo, fontSize: 10, fontWeight: "900", textAlign: "center" },
  tileTextActive: { color: COLORS.white },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
