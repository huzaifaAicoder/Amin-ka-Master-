import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type AccessType = "free" | "lifetime" | "time_limited";

export default function CourseManagerScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const coursesQuery = trpc.operations.courses.useQuery(undefined, { enabled: Boolean(user && user.role !== "student"), retry: false });
  const createMutation = trpc.operations.createCourse.useMutation({ onSuccess: () => void coursesQuery.refetch() });
  const updateMutation = trpc.operations.updateCourse.useMutation({ onSuccess: () => void coursesQuery.refetch() });
  const statusMutation = trpc.operations.setCourseStatus.useMutation({ onSuccess: () => void coursesQuery.refetch() });
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [mrp, setMrp] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [accessType, setAccessType] = useState<AccessType>("free");
  const [categoryIndex, setCategoryIndex] = useState(0);

  if (!user || user.role === "student") return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Operations permission is required.</Text></ScreenContainer>;
  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories[categoryIndex];
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const busy = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setFormMode("none"); setEditingCourseId(null); setTitle(""); setShortDescription(""); setMrp("0"); setSellingPrice("0"); setAccessType("free"); setCategoryIndex(0);
  };
  const beginCreate = () => { resetForm(); setFormMode("create"); };
  const beginEdit = (item: NonNullable<typeof coursesQuery.data>[number]) => {
    const nextIndex = Math.max(0, categories.findIndex((category) => category.id === item.course.categoryId));
    setEditingCourseId(item.course.id); setTitle(item.course.title); setShortDescription(item.course.shortDescription); setMrp(String(item.course.mrp)); setSellingPrice(String(item.course.sellingPrice)); setAccessType(item.course.accessType); setCategoryIndex(nextIndex); setFormMode("edit");
  };
  const submit = async () => {
    if (!selectedCategory || title.trim().length < 3 || shortDescription.trim().length < 10 || !slug) return Alert.alert("Check the course details", "Choose a category, use a descriptive title and add at least 10 characters of course summary.");
    if (Number(sellingPrice) > Number(mrp)) return Alert.alert("Check pricing", "Selling price cannot be greater than MRP.");
    const fields = { categoryId: selectedCategory.id, title: title.trim(), slug, shortDescription: shortDescription.trim(), mrp: mrp || "0", sellingPrice: sellingPrice || "0", accessType };
    try {
      if (formMode === "edit" && editingCourseId) await updateMutation.mutateAsync({ courseId: editingCourseId, ...fields });
      else await createMutation.mutateAsync({ instructorId: user.id, ...fields });
      resetForm();
    } catch (cause) { Alert.alert("Course not saved", cause instanceof Error ? cause.message : "Your current role may not have this permission."); }
  };
  const cycleStatus = async (courseId: number, current: "draft" | "published" | "archived") => {
    const next = current === "draft" ? "published" : current === "published" ? "archived" : "draft";
    try { await statusMutation.mutateAsync({ courseId, status: next }); } catch (cause) { Alert.alert("Status not changed", cause instanceof Error ? cause.message : "Your role may not have publishing permission."); }
  };
  const cycleCategory = () => setCategoryIndex((value) => categories.length ? (value + 1) % categories.length : 0);
  const cycleAccess = () => setAccessType((value) => value === "free" ? "lifetime" : value === "lifetime" ? "time_limited" : "free");

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.header}><Pressable onPress={() => formMode === "none" ? router.back() : resetForm()} hitSlop={10}><MaterialIcons name={formMode === "none" ? "arrow-back" : "close"} size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>{formMode === "none" ? "Manage courses" : formMode === "create" ? "Add a course" : "Edit course"}</Text>{formMode === "none" ? <Pressable onPress={beginCreate} hitSlop={10}><MaterialIcons name="add-circle" size={25} color={COLORS.indigo} /></Pressable> : <View style={{ width: 25 }} />}</View>
    {formMode !== "none" ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={styles.formTitle}>{formMode === "create" ? "Create a new draft course" : "Update course details"}</Text><Text style={styles.formNote}>Use this screen to change the learner-facing course title, summary, category, price and access type. Publishing is controlled separately.</Text><Label text="Course title" /><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Field survey fundamentals" placeholderTextColor="#98A2B3" style={styles.input} returnKeyType="next" /><Label text="Course summary" /><TextInput value={shortDescription} onChangeText={setShortDescription} placeholder="A concise learner-facing description" placeholderTextColor="#98A2B3" multiline textAlignVertical="top" style={[styles.input, styles.textarea]} /><Label text="Category" /><Pressable onPress={cycleCategory} style={({ pressed }) => [styles.selector, pressed && styles.pressed]}><Text style={styles.selectorText}>{selectedCategory?.name ?? "No active category"}</Text><MaterialIcons name="sync" size={18} color={COLORS.indigo} /></Pressable><Label text="Access type" /><Pressable onPress={cycleAccess} style={({ pressed }) => [styles.selector, pressed && styles.pressed]}><Text style={styles.selectorText}>{accessType.replace("_", " ").toUpperCase()}</Text><MaterialIcons name="sync" size={18} color={COLORS.indigo} /></Pressable><View style={styles.priceRow}><View style={styles.priceField}><Label text="MRP (₹)" /><TextInput value={mrp} onChangeText={setMrp} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A2B3" style={styles.input} /></View><View style={styles.priceField}><Label text="Selling price (₹)" /><TextInput value={sellingPrice} onChangeText={setSellingPrice} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A2B3" style={styles.input} /></View></View><Text style={styles.slugHint}>Generated public slug: {slug || "—"}</Text><PrimaryButton label={busy ? "Saving…" : formMode === "edit" ? "Save course changes" : "Create course draft"} icon="save" onPress={submit} disabled={busy} /></ScrollView> : coursesQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={COLORS.indigo} /></View> : <><View style={styles.helper}><Text style={styles.helperText}>Tap <Text style={styles.helperBold}>Edit</Text> to update a course. Tap its status to publish, archive or return it to draft.</Text></View><FlatList data={coursesQuery.data ?? []} keyExtractor={(item) => item.course.id.toString()} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.courseRow}><IconCircle icon="menu-book" size={40} /><View style={styles.copy}><Text style={styles.courseTitle}>{item.course.title}</Text><Text style={styles.courseMeta}>{item.categoryName} · ₹{item.course.sellingPrice}</Text></View><View style={styles.rowActions}><Pressable onPress={() => beginEdit(item)} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}><MaterialIcons name="edit" size={17} color={COLORS.indigo} /><Text style={styles.editText}>Edit</Text></Pressable><Pressable onPress={() => void cycleStatus(item.course.id, item.course.status)} style={({ pressed }) => [styles.statusButton, pressed && styles.pressed]}><Tag label={item.course.status.toUpperCase()} tone={item.course.status === "published" ? "green" : item.course.status === "draft" ? "saffron" : "neutral"} /><MaterialIcons name="sync" size={14} color={COLORS.muted} /></Pressable></View></View>} /></>}</ScreenContainer>;
}

function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 17, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  denied: { color: COLORS.muted, textAlign: "center" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  helper: { borderRadius: 14, backgroundColor: COLORS.indigoSoft, padding: 12, marginBottom: 11 },
  helperText: { color: COLORS.indigo, fontSize: 12, lineHeight: 18 },
  helperBold: { fontWeight: "900" },
  list: { paddingBottom: 36, gap: 10 },
  courseRow: { padding: 13, borderRadius: 18, borderColor: COLORS.line, borderWidth: 1, backgroundColor: COLORS.white, flexDirection: "row", gap: 10, alignItems: "center" },
  copy: { flex: 1, gap: 4 },
  courseTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  courseMeta: { color: COLORS.muted, fontSize: 11 },
  rowActions: { alignItems: "flex-end", gap: 5 },
  editButton: { minHeight: 27, paddingHorizontal: 8, borderRadius: 9, backgroundColor: COLORS.indigoSoft, flexDirection: "row", alignItems: "center", gap: 4 },
  editText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" },
  statusButton: { flexDirection: "row", gap: 4, alignItems: "center", padding: 3 },
  form: { paddingBottom: 34, gap: 9 },
  formTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800", marginTop: 3 },
  formNote: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  label: { color: COLORS.ink, fontWeight: "800", fontSize: 13, marginTop: 5 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 13, color: COLORS.ink, fontSize: 14 },
  textarea: { minHeight: 100, paddingTop: 13 },
  selector: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectorText: { color: COLORS.indigo, fontWeight: "800", fontSize: 14 },
  priceRow: { flexDirection: "row", gap: 10 },
  priceField: { flex: 1 },
  slugHint: { color: COLORS.muted, fontSize: 11, marginBottom: 4 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
