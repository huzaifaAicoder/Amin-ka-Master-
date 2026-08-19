import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function StudentShortPermissionsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const enabled = user?.role === "admin" || user?.role === "super_admin";
  const peopleQuery = trpc.operations.people.useQuery(undefined, { enabled, retry: 1 });
  const permissionMutation = trpc.operations.setStudentShortUploadPermission.useMutation({ onSuccess: () => void peopleQuery.refetch() });
  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="lock" title="Admin access required" body="Only Admin and Owner accounts can manage student Short-upload access." /></ScreenContainer>;
  const students = (peopleQuery.data ?? []).filter((person) => person.role === "student");
  const update = async (userId: number, canUploadShorts: boolean) => {
    try {
      await permissionMutation.mutateAsync({ userId, canUploadShorts });
      Alert.alert(canUploadShorts ? "Upload access granted" : "Upload access removed", canUploadShorts ? "The student can now submit Shorts for moderation." : "The student can no longer begin new Short uploads. Existing submissions remain in moderation history.");
    } catch (error) {
      Alert.alert("Permission not updated", error instanceof Error ? error.message : "Please try again.");
    }
  };
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.eyebrow}>STUDENT SAFETY CONTROL</Text><Text style={styles.title}>Short upload access</Text></View><IconCircle icon="video-settings" size={39} color={COLORS.saffron} background={COLORS.indigo} /></View><View style={styles.notice}><MaterialIcons name="policy" size={20} color={COLORS.indigo} /><Text style={styles.noticeText}>Enable this only for trusted students. Every enabled student submission still begins as Pending and requires Admin or Owner approval before it reaches the public feed.</Text></View>{peopleQuery.isLoading ? <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View> : peopleQuery.isError ? <View style={styles.center}><EmptyState icon="wifi-off" title="Students could not load" body="Retry the secure people list." /><PrimaryButton label="Retry" icon="refresh" onPress={() => void peopleQuery.refetch()} /></View> : <FlatList data={students} keyExtractor={(item) => item.id.toString()} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="groups" title="No students found" body="Student accounts will appear here after registration." />} renderItem={({ item }) => { const pending = permissionMutation.isPending && permissionMutation.variables?.userId === item.id; return <View style={styles.card}><IconCircle icon="person" size={40} /><View style={styles.copy}><Text style={styles.name}>{item.fullName ?? "Student"}</Text><Text numberOfLines={1} style={styles.contact}>{item.email ?? item.mobile ?? "No contact details"}</Text><View style={styles.tags}><Tag label={item.status.toUpperCase()} tone={item.status === "active" ? "green" : "red"} />{item.canUploadShorts ? <Tag label="UPLOAD ENABLED" tone="saffron" /> : null}</View></View><View style={styles.toggleWrap}>{pending ? <ActivityIndicator size="small" color={COLORS.indigo} /> : <Switch value={item.canUploadShorts} disabled={item.status !== "active"} onValueChange={(value) => void update(item.id, value)} trackColor={{ false: COLORS.line, true: COLORS.indigo }} accessibilityLabel={`Allow ${item.fullName ?? "student"} to upload Shorts`} />}</View></View>; }} />}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 15, flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  heading: { flex: 1 },
  eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "900" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 15, backgroundColor: COLORS.indigoSoft },
  noticeText: { flex: 1, color: COLORS.indigo, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  list: { paddingTop: 12, paddingBottom: 34, gap: 9 },
  card: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white },
  copy: { flex: 1, gap: 3 },
  name: { color: COLORS.ink, fontSize: 14, fontWeight: "900" },
  contact: { color: COLORS.muted, fontSize: 11 },
  tags: { flexDirection: "row", gap: 5, alignItems: "center" },
  toggleWrap: { width: 52, alignItems: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
