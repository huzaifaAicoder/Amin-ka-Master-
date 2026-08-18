import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";

type AccountRowProps = { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; detail?: string; onPress: () => void; tone?: "default" | "danger" };
function AccountRow({ icon, label, detail, onPress, tone = "default" }: AccountRowProps) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><IconCircle icon={icon} size={38} color={tone === "danger" ? COLORS.red : COLORS.indigo} background={tone === "danger" ? "#FDECEA" : COLORS.indigoSoft} /><View style={styles.rowText}><Text style={[styles.rowLabel, tone === "danger" && { color: COLORS.red }]}>{label}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View><MaterialIcons name="chevron-right" color="#98A2B3" size={23} /></Pressable>;
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout } = useLmsSession();
  const staff = user && user.role !== "student";

  if (!user) {
    return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.anonHeader}><Text style={styles.title}>Account</Text><Text style={styles.subtitle}>Keep your study history secure and accessible.</Text></View><View style={styles.signInCard}><IconCircle icon="account-circle" size={64} /><Text style={styles.signInTitle}>A learning profile that travels with you</Text><Text style={styles.signInBody}>Sign in with email or mobile to enroll, save notes, track progress and take tests.</Text><Pressable onPress={() => router.push("/auth")} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>Sign in or create account</Text></Pressable></View></ScreenContainer>;
  }

  const confirmLogout = () => Alert.alert("Sign out", "Your session will be revoked on this device.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } }]);
  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Account</Text>
        <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{(user.fullName ?? "A").slice(0, 1).toUpperCase()}</Text></View><View style={styles.profileText}><Text style={styles.name}>{user.fullName ?? "Learner"}</Text><Text style={styles.identity}>{user.email ?? user.mobile ?? "Amin Ka Master learner"}</Text><Tag label={user.role.replace("_", " ").toUpperCase()} tone={staff ? "saffron" : "indigo"} /></View></View>
        <Text style={styles.sectionTitle}>Learning</Text>
        <View style={styles.group}><AccountRow icon="assignment" label="Practice tests" detail="Attempts and results" onPress={() => router.push("/tests")} /><AccountRow icon="videocam" label="Live classes" detail="Upcoming and completed sessions" onPress={() => router.push("/live")} /><AccountRow icon="notifications-none" label="Notifications" detail="Course updates and announcements" onPress={() => router.push("/notifications")} /></View>
        {staff ? <><View style={styles.adminCallout}><View style={styles.adminCalloutTop}><IconCircle icon="admin-panel-settings" size={42} color={COLORS.saffron} background="rgba(255,255,255,0.12)" /><View style={styles.adminCalloutCopy}><Text style={styles.adminCalloutTitle}>Admin tools</Text><Text style={styles.adminCalloutBody}>Add, edit and publish courses from your management workspace.</Text></View></View><PrimaryButton label="Manage courses" icon="edit" onPress={() => router.push("/operations/courses" as never)} subtle /></View><Text style={styles.sectionTitle}>Operations</Text><View style={styles.group}><AccountRow icon="admin-panel-settings" label="Operations dashboard" detail="Courses, students and content" onPress={() => router.push("/operations")} /><AccountRow icon="menu-book" label="Course manager" detail="Add, edit and publish courses" onPress={() => router.push("/operations/courses" as never)} /></View></> : null}
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.group}><AccountRow icon="devices" label="Active sessions" detail="Review or invalidate sessions" onPress={() => router.push("/sessions")} /><AccountRow icon="logout" label="Sign out" onPress={confirmLogout} tone="danger" /></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 106 },
  title: { color: COLORS.ink, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  anonHeader: { paddingTop: 12 },
  signInCard: { marginTop: 26, borderWidth: 1, borderColor: COLORS.line, borderRadius: 22, backgroundColor: COLORS.white, padding: 22, alignItems: "center", gap: 11 },
  signInTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "800", textAlign: "center", marginTop: 6 },
  signInBody: { color: COLORS.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  primary: { marginTop: 10, minHeight: 48, paddingHorizontal: 18, justifyContent: "center", borderRadius: 14, backgroundColor: COLORS.indigo, alignSelf: "stretch", alignItems: "center" },
  primaryText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  profileCard: { marginTop: 19, backgroundColor: COLORS.indigo, borderRadius: 22, padding: 17, flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.saffron, alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.indigo, fontSize: 23, fontWeight: "900" },
  profileText: { flex: 1, gap: 4 },
  adminCallout: { marginTop: 19, padding: 16, borderRadius: 21, backgroundColor: COLORS.indigo, gap: 14 },
  adminCalloutTop: { flexDirection: "row", gap: 11, alignItems: "center" },
  adminCalloutCopy: { flex: 1, gap: 3 },
  adminCalloutTitle: { color: COLORS.white, fontWeight: "900", fontSize: 17 },
  adminCalloutBody: { color: "#D6DFF2", fontSize: 12, lineHeight: 17 },
  name: { color: COLORS.white, fontSize: 18, fontWeight: "800" },
  identity: { color: "#D6DFF2", fontSize: 12 },
  sectionTitle: { marginTop: 25, marginBottom: 9, color: COLORS.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  group: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, overflow: "hidden" },
  row: { minHeight: 70, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 12, borderBottomColor: COLORS.line, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: COLORS.ink, fontSize: 15, fontWeight: "800" },
  rowDetail: { color: COLORS.muted, fontSize: 12 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
