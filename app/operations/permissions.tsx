import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

const PERMISSIONS = [
  { key: "courses.manage", label: "Courses", description: "Create and update course information" },
  { key: "courses.publish", label: "Publish courses", description: "Change course draft, published and archived status" },
  { key: "course_content.manage", label: "Course content", description: "Manage modules, lessons and course resources" },
  { key: "media.manage", label: "Free media", description: "Manage Free Playlists and Shorts" },
  { key: "assessments.manage", label: "Assessments", description: "Create tests and questions" },
  { key: "assessments.publish", label: "Publish tests", description: "Change test publication status" },
  { key: "live_classes.manage", label: "Live classes", description: "Schedule and update live classes" },
] as const;

export default function TeacherPermissionsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const enabled = user?.role === "super_admin";
  const peopleQuery = trpc.operations.people.useQuery(undefined, { enabled, retry: false });
  const setPermission = trpc.operations.setTeacherPermission.useMutation({ onSuccess: () => void peopleQuery.refetch() });
  const teachers = (peopleQuery.data ?? []).filter((person) => person.role === "teacher");

  if (!enabled) {
    return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="security" title="Owner access required" body="Only the Super Admin can grant or revoke Teacher permissions." /></ScreenContainer>;
  }
  if (peopleQuery.isLoading) {
    return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  }
  if (peopleQuery.isError) {
    return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="wifi-off" title="People could not be loaded" body="Check the connection, then try again." action={<PrimaryButton label="Retry" icon="refresh" onPress={() => void peopleQuery.refetch()} />} /></ScreenContainer>;
  }

  const toggle = async (teacherId: number, permission: (typeof PERMISSIONS)[number]["key"], granted: boolean) => {
    try {
      await setPermission.mutateAsync({ userId: teacherId, permission, granted: !granted });
    } catch (error) {
      Alert.alert("Permission not updated", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Return to operations" onPress={() => router.back()} hitSlop={10} style={styles.back}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable>
          <View style={styles.heading}><Text style={styles.eyebrow}>SUPER ADMIN / OWNER</Text><Text style={styles.title}>Teacher permissions</Text></View>
        </View>
        <View style={styles.notice}><MaterialIcons name="verified-user" size={20} color={COLORS.green} /><Text style={styles.noticeText}>Permissions apply immediately on the server. Teacher accounts receive no operational access unless you grant it here.</Text></View>
        <PrimaryButton label="Manage course categories" icon="folder" onPress={() => router.push("/operations/categories" as never)} subtle />
        {teachers.length ? teachers.map((teacher) => {
          const granted = new Set(teacher.permissions ?? []);
          return <View key={teacher.id} style={styles.teacherCard}>
            <View style={styles.teacherHeader}><View style={{ flex: 1 }}><Text style={styles.teacherName}>{teacher.fullName ?? "Teacher account"}</Text><Text style={styles.teacherIdentity}>{teacher.email ?? teacher.mobile ?? "No contact information"}</Text></View><Tag label={teacher.status.toUpperCase()} tone={teacher.status === "active" ? "green" : "red"} /></View>
            {PERMISSIONS.map((permission) => {
              const active = granted.has(permission.key);
              const busy = setPermission.isPending && setPermission.variables?.userId === teacher.id && setPermission.variables?.permission === permission.key;
              return <View key={permission.key} style={styles.permissionRow}><View style={{ flex: 1 }}><Text style={styles.permissionLabel}>{permission.label}</Text><Text style={styles.permissionDescription}>{permission.description}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: active, disabled: busy }} disabled={busy} onPress={() => void toggle(teacher.id, permission.key, active)} style={({ pressed }) => [styles.permissionButton, active && styles.permissionButtonActive, (pressed || busy) && styles.pressed]}><Text style={[styles.permissionButtonText, active && styles.permissionButtonTextActive]}>{busy ? "Saving…" : active ? "Granted" : "Grant"}</Text></Pressable></View>;
            })}
          </View>;
        }) : <EmptyState icon="person-off" title="No Teacher accounts" body="Create a Teacher account in the Owner Control Center, then return here to grant the required responsibilities." />}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 40, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft },
  heading: { flex: 1 }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900" },
  notice: { flexDirection: "row", gap: 9, alignItems: "flex-start", padding: 13, borderRadius: 16, backgroundColor: "#F4FBF7" }, noticeText: { flex: 1, color: COLORS.green, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  teacherCard: { borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 13, gap: 8 },
  teacherHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line }, teacherName: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, teacherIdentity: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  permissionRow: { minHeight: 62, flexDirection: "row", gap: 10, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingVertical: 8 }, permissionLabel: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, permissionDescription: { color: COLORS.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  permissionButton: { minWidth: 74, minHeight: 35, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.indigoSoft }, permissionButtonActive: { backgroundColor: COLORS.indigo }, permissionButtonText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" }, permissionButtonTextActive: { color: COLORS.white }, pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
