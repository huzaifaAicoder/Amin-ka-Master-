import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton, formatDate } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function SessionsScreen() {
  const router = useRouter();
  const { user, logout } = useLmsSession();
  const sessionsQuery = trpc.auth.sessions.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const everywhereMutation = trpc.auth.logoutEverywhere.useMutation();
  const invalidate = () => Alert.alert("Sign out everywhere", "All sessions, including this device, will be revoked. You will need to sign in again.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out everywhere", style: "destructive", onPress: async () => { await everywhereMutation.mutateAsync(); await logout(); router.replace("/"); } }]);
  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in to manage sessions" body="Active session controls are only available to your authenticated account." /></View></ScreenContainer>;
  if (sessionsQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>Active sessions</Text><View style={{ width: 23 }} /></View><Text style={styles.intro}>Sessions use revocable server records. Ending every session removes access on every signed-in device.</Text>{sessionsQuery.data?.length ? <FlatList data={sessionsQuery.data} keyExtractor={(item) => item.id.toString()} contentContainerStyle={styles.list} renderItem={({ item, index }) => <View style={styles.session}><View style={styles.device}><MaterialIcons name={index === 0 ? "smartphone" : "devices"} size={23} color={COLORS.indigo} /></View><View style={styles.copy}><Text style={styles.deviceName}>{item.userAgent ?? "Amin Ka Master device"}</Text><Text style={styles.date}>Created {formatDate(item.createdAt)}</Text><Text style={styles.date}>Expires {formatDate(item.expiresAt)}</Text></View>{index === 0 ? <View style={styles.current}><Text style={styles.currentText}>CURRENT</Text></View> : null}</View>} /> : <View style={styles.center}><EmptyState icon="devices" title="No active sessions" body="Sign in again to create a secure session." /></View>}<PrimaryButton label={everywhereMutation.isPending ? "Ending sessions…" : "Sign out everywhere"} icon="logout" onPress={invalidate} disabled={everywhereMutation.isPending} /></ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  intro: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 17 },
  center: { flex: 1, justifyContent: "center" },
  list: { gap: 10, paddingBottom: 19 },
  session: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, padding: 14, borderRadius: 18, flexDirection: "row", gap: 11, alignItems: "center" },
  device: { width: 43, height: 43, borderRadius: 14, backgroundColor: COLORS.indigoSoft, justifyContent: "center", alignItems: "center" },
  copy: { flex: 1, gap: 3 },
  deviceName: { color: COLORS.ink, fontSize: 14, fontWeight: "800" },
  date: { color: COLORS.muted, fontSize: 11 },
  current: { borderRadius: 999, backgroundColor: COLORS.greenSoft, paddingHorizontal: 7, paddingVertical: 4 },
  currentText: { color: COLORS.green, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
});
