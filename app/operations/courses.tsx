import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function CourseManagerScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const coursesQuery = trpc.operations.courses.useQuery(undefined, { enabled: Boolean(user && user.role !== "student"), retry: false });
  const createMutation = trpc.operations.createCourse.useMutation({ onSuccess: () => void coursesQuery.refetch() });
  const statusMutation = trpc.operations.setCourseStatus.useMutation({ onSuccess: () => void coursesQuery.refetch() });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryIndex, setCategoryIndex] = useState(0);
  if (!user || user.role === "student") return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Operations permission is required.</Text></ScreenContainer>;
  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories[categoryIndex];
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const create = async () => {
    if (!selectedCategory || title.trim().length < 3 || shortDescription.trim().length < 10 || !slug) return Alert.alert("Check the course details", "Choose a category, use a descriptive title and add at least 10 characters of course summary.");
    try {
      await createMutation.mutateAsync({ categoryId: selectedCategory.id, instructorId: user.id, title: title.trim(), slug, shortDescription: shortDescription.trim(), mrp: "0", sellingPrice: "0", accessType: "free" });
      setTitle(""); setShortDescription(""); setCreating(false);
    } catch (cause) { Alert.alert("Course not created", cause instanceof Error ? cause.message : "Your current role may not have this permission."); }
  };
  const cycleStatus = async (courseId: number, current: "draft" | "published" | "archived") => { const next = current === "draft" ? "published" : current === "published" ? "archived" : "draft"; try { await statusMutation.mutateAsync({ courseId, status: next }); } catch (cause) { Alert.alert("Status not changed", cause instanceof Error ? cause.message : "Your role may not have publishing permission."); } };
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>Manage courses</Text><Pressable onPress={() => setCreating((value) => !value)} hitSlop={8}><MaterialIcons name={creating ? "close" : "add"} size={25} color={COLORS.indigo} /></Pressable></View>{creating ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={styles.formTitle}>Create a draft course</Text><Text style={styles.formNote}>New courses begin as a draft. Publication remains a separately audited server action.</Text><Label text="Course title" /><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Field survey fundamentals" placeholderTextColor="#98A2B3" style={styles.input} returnKeyType="next" /><Label text="Course summary" /><TextInput value={shortDescription} onChangeText={setShortDescription} placeholder="A concise learner-facing description" placeholderTextColor="#98A2B3" multiline textAlignVertical="top" style={[styles.input, styles.textarea]} /><Label text="Category" /><Pressable onPress={() => setCategoryIndex((value) => categories.length ? (value + 1) % categories.length : 0)} style={({ pressed }) => [styles.categoryButton, pressed && styles.pressed]}><Text style={styles.categoryName}>{selectedCategory?.name ?? "No active category"}</Text><MaterialIcons name="sync" size={18} color={COLORS.indigo} /></Pressable><Text style={styles.slugHint}>Generated slug: {slug || "—"}</Text><PrimaryButton label={createMutation.isPending ? "Creating draft…" : "Create course draft"} icon="add" onPress={create} disabled={createMutation.isPending} /></ScrollView> : coursesQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={COLORS.indigo} /></View> : <FlatList data={coursesQuery.data ?? []} keyExtractor={(item) => item.course.id.toString()} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.courseRow}><IconCircle icon="menu-book" size={40} /><View style={styles.copy}><Text style={styles.courseTitle}>{item.course.title}</Text><Text style={styles.courseMeta}>{item.categoryName}</Text></View><Pressable onPress={() => void cycleStatus(item.course.id, item.course.status)} style={({ pressed }) => [styles.statusButton, pressed && styles.pressed]}><Tag label={item.course.status.toUpperCase()} tone={item.course.status === "published" ? "green" : item.course.status === "draft" ? "saffron" : "neutral"} /><MaterialIcons name="sync" size={15} color={COLORS.muted} /></Pressable></View>} />}</ScreenContainer>;
}

function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 17, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  denied: { color: COLORS.muted, textAlign: "center" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: 36, gap: 10 },
  courseRow: { padding: 13, borderRadius: 18, borderColor: COLORS.line, borderWidth: 1, backgroundColor: COLORS.white, flexDirection: "row", gap: 10, alignItems: "center" },
  copy: { flex: 1, gap: 4 },
  courseTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  courseMeta: { color: COLORS.muted, fontSize: 11 },
  statusButton: { flexDirection: "row", gap: 4, alignItems: "center", padding: 3 },
  form: { paddingBottom: 34, gap: 9 },
  formTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800", marginTop: 3 },
  formNote: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  label: { color: COLORS.ink, fontWeight: "800", fontSize: 13, marginTop: 5 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 13, color: COLORS.ink, fontSize: 14 },
  textarea: { minHeight: 100, paddingTop: 13 },
  categoryButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryName: { color: COLORS.indigo, fontWeight: "800", fontSize: 14 },
  slugHint: { color: COLORS.muted, fontSize: 11, marginBottom: 4 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
