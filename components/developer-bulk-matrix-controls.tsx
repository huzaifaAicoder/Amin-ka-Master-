import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

const STUDENT_FEATURES = ["courses", "assessments", "live_classes", "shorts", "downloads", "ai_doubt", "ai_quiz"] as const;
const TEACHER_PERMISSIONS = ["courses.manage", "courses.publish", "course_content.manage", "media.manage", "assessments.manage", "assessments.publish", "live_classes.manage"] as const;

type MatrixUser = { id: number; role: string; fullName: string };

export function DeveloperBulkMatrixControls({ selected }: { selected: MatrixUser }) {
  const utils = trpc.useUtils();
  const setStudentFeatures = trpc.developer.setStudentFeatureControls.useMutation();
  const resetStudentFeatures = trpc.developer.resetStudentFeatureControls.useMutation();
  const setTeacherPermissions = trpc.developer.setUserControls.useMutation();
  if (selected.role !== "student" && selected.role !== "teacher") return null;
  const isStudent = selected.role === "student";
  const busy = setStudentFeatures.isPending || resetStudentFeatures.isPending || setTeacherPermissions.isPending;
  const refresh = () => void utils.developer.users.invalidate();
  const selectAll = async () => {
    try {
      if (isStudent) await setStudentFeatures.mutateAsync({ userId: selected.id, features: STUDENT_FEATURES.map((feature) => ({ feature, enabled: true })) });
      else await setTeacherPermissions.mutateAsync({ userId: selected.id, permissions: [...TEACHER_PERMISSIONS] });
      refresh();
      Alert.alert("Matrix updated", `All available ${isStudent ? "Student features" : "Teacher permissions"} were selected for ${selected.fullName}.`);
    } catch { Alert.alert("Matrix not updated", "The bulk change could not be saved. Please try again."); }
  };
  const reset = () => Alert.alert("Reset to Default?", isStudent ? "This clears the Student's individual overrides and restores global policy inheritance." : "This removes all individual Teacher permissions. Permissions can be granted again at any time.", [{ text: "Cancel", style: "cancel" }, { text: "Reset", style: "destructive", onPress: () => void (async () => { try { if (isStudent) await resetStudentFeatures.mutateAsync({ userId: selected.id }); else await setTeacherPermissions.mutateAsync({ userId: selected.id, permissions: [] }); refresh(); Alert.alert("Defaults restored", "The individual permission matrix was reset."); } catch { Alert.alert("Reset not completed", "The default reset could not be saved. Please try again."); } })() }]);
  return <View style={styles.card}><Text style={styles.title}>Bulk matrix editing</Text><Text style={styles.body}>Apply a complete permission set, or return this account to the platform default in one audited action.</Text><View style={styles.actions}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void selectAll()} style={[styles.button, busy && styles.disabled]}><MaterialIcons name="done-all" size={17} color={COLORS.white} /><Text style={styles.buttonText}>Select All</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={reset} style={[styles.reset, busy && styles.disabled]}><MaterialIcons name="restart-alt" size={17} color={COLORS.red} /><Text style={styles.resetText}>Reset to Default</Text></Pressable></View></View>;
}

const styles = StyleSheet.create({ card: { gap: 9, padding: 13, borderRadius: 17, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#C9D5F2" }, title: { color: COLORS.indigo, fontSize: 14, fontWeight: "900" }, body: { color: COLORS.muted, fontSize: 11, lineHeight: 16 }, actions: { gap: 8 }, button: { minHeight: 40, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.indigo }, buttonText: { color: COLORS.white, fontSize: 12, fontWeight: "900" }, reset: { minHeight: 40, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFF4F2", borderWidth: 1, borderColor: "#FECACA" }, resetText: { color: COLORS.red, fontSize: 12, fontWeight: "900" }, disabled: { opacity: 0.55 } });
