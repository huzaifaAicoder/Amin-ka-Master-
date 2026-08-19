import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type AccessType = "free" | "lifetime" | "time_limited";
type CourseStatus = "draft" | "published" | "archived";

export default function CourseManagerScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const coursesQuery = trpc.operations.courses.useQuery(undefined, { enabled: Boolean(user && user.role !== "student"), retry: false });
  const createMutation = trpc.operations.createCourse.useMutation({ onSuccess: () => void coursesQuery.refetch() });
  const updateMutation = trpc.operations.updateCourse.useMutation({ onSuccess: () => void coursesQuery.refetch() });
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [mrp, setMrp] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [accessType, setAccessType] = useState<AccessType>("free");
  const [status, setStatus] = useState<CourseStatus>("draft");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [filterStatus, setFilterStatus] = useState<"all" | CourseStatus>("all");

  if (!user || user.role === "student") return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.denied}>Operations permission is required.</Text></ScreenContainer>;
  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories[categoryIndex];
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const busy = createMutation.isPending || updateMutation.isPending;
  const filteredCourses = (coursesQuery.data ?? []).filter((item) => filterStatus === "all" || item.course.status === filterStatus);
  const normalizePrice = (value: string) => value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 12);

  const resetForm = () => {
    setFormMode("none"); setEditingCourseId(null); setTitle(""); setShortDescription(""); setMrp("0"); setSellingPrice("0"); setAccessType("free"); setStatus("draft"); setCategoryIndex(0);
  };
  const beginCreate = () => { resetForm(); setFormMode("create"); };
  const beginEdit = (item: NonNullable<typeof coursesQuery.data>[number]) => {
    const nextIndex = Math.max(0, categories.findIndex((category) => category.id === item.course.categoryId));
    setEditingCourseId(item.course.id); setTitle(item.course.title); setShortDescription(item.course.shortDescription); setMrp(String(item.course.mrp)); setSellingPrice(String(item.course.sellingPrice)); setAccessType(item.course.accessType); setStatus(item.course.status); setCategoryIndex(nextIndex); setFormMode("edit");
  };
  const submit = async () => {
    if (!selectedCategory || title.trim().length < 3 || shortDescription.trim().length < 10 || !slug) return Alert.alert("Check the course details", "Choose a category, use a descriptive title and add at least 10 characters of course summary.");
    const normalizedMrp = mrp || "0"; const normalizedSellingPrice = sellingPrice || "0";
    if (!Number.isFinite(Number(normalizedMrp)) || !Number.isFinite(Number(normalizedSellingPrice)) || Number(normalizedMrp) < 0 || Number(normalizedSellingPrice) < 0) return Alert.alert("Check pricing", "Enter valid non-negative prices using digits and up to two decimal places.");
    if (Number(normalizedSellingPrice) > Number(normalizedMrp)) return Alert.alert("Check pricing", "Selling price cannot be greater than MRP.");
    const fields = { categoryId: selectedCategory.id, title: title.trim(), slug, shortDescription: shortDescription.trim(), mrp: normalizedMrp, sellingPrice: normalizedSellingPrice, accessType };
    try {
      if (formMode === "edit" && editingCourseId) await updateMutation.mutateAsync({ courseId: editingCourseId, ...fields, mrp: Number(normalizedMrp), sellingPrice: Number(normalizedSellingPrice), ...(user.role === "admin" || user.role === "super_admin" ? { status } : {}) });
      else await createMutation.mutateAsync({ instructorId: user.id, ...fields });
      resetForm();
    } catch (cause) { Alert.alert("Course not saved", cause instanceof Error ? cause.message : "Your current role may not have this permission."); }
  };
  const cycleCategory = () => setCategoryIndex((value) => categories.length ? (value + 1) % categories.length : 0);
  const cycleAccess = () => setAccessType((value) => value === "free" ? "lifetime" : value === "lifetime" ? "time_limited" : "free");

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
    <View style={styles.header}><Pressable onPress={() => formMode === "none" ? router.back() : resetForm()} hitSlop={10}><MaterialIcons name={formMode === "none" ? "arrow-back" : "close"} size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>{formMode === "none" ? "Manage courses" : formMode === "create" ? "Add a course" : "Edit course"}</Text>{formMode === "none" ? <Pressable onPress={beginCreate} hitSlop={10}><MaterialIcons name="add-circle" size={25} color={COLORS.indigo} /></Pressable> : <View style={{ width: 25 }} />}</View>
    {formMode !== "none" ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={styles.formTitle}>{formMode === "create" ? "Create a new draft course" : "Update course details"}</Text><Text style={styles.formNote}>Use this screen to change learner-facing content, price and access. Status changes are explicit and only save when you press Save course changes.</Text><Label text="Course title" /><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Field survey fundamentals" placeholderTextColor="#98A2B3" style={styles.input} returnKeyType="next" /><Label text="Course summary" /><TextInput value={shortDescription} onChangeText={setShortDescription} placeholder="A concise learner-facing description" placeholderTextColor="#98A2B3" multiline textAlignVertical="top" style={[styles.input, styles.textarea]} /><Label text="Category" /><Pressable onPress={cycleCategory} style={({ pressed }) => [styles.selector, pressed && styles.pressed]}><Text style={styles.selectorText}>{selectedCategory?.name ?? "No active category"}</Text><MaterialIcons name="sync" size={18} color={COLORS.indigo} /></Pressable><Label text="Access type" /><Pressable onPress={cycleAccess} style={({ pressed }) => [styles.selector, pressed && styles.pressed]}><Text style={styles.selectorText}>{accessType.replace("_", " ").toUpperCase()}</Text><MaterialIcons name="sync" size={18} color={COLORS.indigo} /></Pressable>{formMode === "edit" && (user.role === "admin" || user.role === "super_admin") ? <View><Label text="Course status" /><View style={styles.pickerBox}><Picker selectedValue={status} onValueChange={(value) => setStatus(value as CourseStatus)} style={styles.picker}><Picker.Item label="Draft" value="draft" /><Picker.Item label="Published" value="published" /><Picker.Item label="Archived" value="archived" /></Picker></View></View> : null}<View style={styles.priceRow}><View style={styles.priceField}><Label text="MRP (₹)" /><TextInput value={mrp} onChangeText={(value) => setMrp(normalizePrice(value))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A2B3" style={styles.input} /></View><View style={styles.priceField}><Label text="Selling price (₹)" /><TextInput value={sellingPrice} onChangeText={(value) => setSellingPrice(normalizePrice(value))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A2B3" style={styles.input} /></View></View><Text style={styles.slugHint}>Generated public slug: {slug || "—"}</Text><PrimaryButton label={busy ? "Saving…" : formMode === "edit" ? "Save course changes" : "Create course draft"} icon="save" onPress={submit} disabled={busy} /></ScrollView> : coursesQuery.isLoading ? <CourseSkeleton /> : coursesQuery.isError ? <View style={styles.retryBox}><MaterialIcons name="wifi-off" size={30} color={COLORS.muted} /><Text style={styles.retryTitle}>Courses could not load</Text><Text style={styles.retryText}>Check your connection and retry this dashboard request.</Text><PrimaryButton label="Retry" icon="refresh" onPress={() => void coursesQuery.refetch()} /></View> : <><View style={styles.helper}><Text style={styles.helperText}>Tap <Text style={styles.helperBold}>Edit</Text> to change course details, price, access, or status. The list status is display-only.</Text></View><View style={styles.filterRow}><Text style={styles.filterLabel}>Show</Text><View style={styles.filterPicker}><Picker selectedValue={filterStatus} onValueChange={(value) => setFilterStatus(value as "all" | CourseStatus)} style={styles.filterPickerControl}><Picker.Item label="All course statuses" value="all" /><Picker.Item label="Draft" value="draft" /><Picker.Item label="Published" value="published" /><Picker.Item label="Archived" value="archived" /></Picker></View></View><FlatList data={filteredCourses} keyExtractor={(item) => item.course.id.toString()} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No {filterStatus === "all" ? "courses" : `${filterStatus} courses`} match this filter.</Text>} renderItem={({ item }) => <View style={styles.courseRow}><IconCircle icon="menu-book" size={40} /><View style={styles.copy}><Text style={styles.courseTitle}>{item.course.title}</Text><Text style={styles.courseMeta}>{item.categoryName} · ₹{item.course.sellingPrice}</Text></View><View style={styles.rowActions}><Pressable onPress={() => beginEdit(item)} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}><MaterialIcons name="edit" size={17} color={COLORS.indigo} /><Text style={styles.editText}>Edit</Text></Pressable><Tag label={item.course.status.toUpperCase()} tone={item.course.status === "published" ? "green" : item.course.status === "draft" ? "saffron" : "neutral"} /></View></View>} /></>}</ScreenContainer>;
}

function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function CourseSkeleton() { return <View style={styles.skeletonList} accessibilityLabel="Loading course manager">{[0, 1, 2].map((item) => <View key={item} style={styles.skeletonRow}><View style={styles.skeletonIcon} /><View style={styles.skeletonCopy}><View style={styles.skeletonWide} /><View style={styles.skeletonShort} /></View><View style={styles.skeletonAction} /></View>)}</View>; }

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 17, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  denied: { color: COLORS.muted, textAlign: "center" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  helper: { borderRadius: 14, backgroundColor: COLORS.indigoSoft, padding: 12, marginBottom: 11 },
  helperText: { color: COLORS.indigo, fontSize: 12, lineHeight: 18 },
  helperBold: { fontWeight: "900" },
  filterRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  filterLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "800" },
  filterPicker: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: COLORS.line, borderRadius: 13, overflow: "hidden", backgroundColor: COLORS.white, justifyContent: "center" },
  filterPickerControl: { color: COLORS.indigo, fontSize: 13 },
  empty: { paddingVertical: 26, textAlign: "center", color: COLORS.muted, fontSize: 13 },
  list: { paddingBottom: 36, gap: 10 },
  courseRow: { padding: 13, borderRadius: 18, borderColor: COLORS.line, borderWidth: 1, backgroundColor: COLORS.white, flexDirection: "row", gap: 10, alignItems: "center" },
  copy: { flex: 1, gap: 4 },
  courseTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  courseMeta: { color: COLORS.muted, fontSize: 11 },
  rowActions: { alignItems: "flex-end", gap: 5 },
  editButton: { minHeight: 27, paddingHorizontal: 8, borderRadius: 9, backgroundColor: COLORS.indigoSoft, flexDirection: "row", alignItems: "center", gap: 4 },
  editText: { color: COLORS.indigo, fontSize: 11, fontWeight: "900" },
  form: { paddingBottom: 34, gap: 9 },
  formTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800", marginTop: 3 },
  formNote: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  label: { color: COLORS.ink, fontWeight: "800", fontSize: 13, marginTop: 5 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 13, color: COLORS.ink, fontSize: 14 },
  textarea: { minHeight: 100, paddingTop: 13 },
  selector: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectorText: { color: COLORS.indigo, fontWeight: "800", fontSize: 14 },
  pickerBox: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, justifyContent: "center", overflow: "hidden" },
  picker: { color: COLORS.indigo, fontWeight: "800" },
  priceRow: { flexDirection: "row", gap: 10 },
  priceField: { flex: 1 },
  slugHint: { color: COLORS.muted, fontSize: 11, marginBottom: 4 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  skeletonList: { paddingTop: 16, gap: 10 }, skeletonRow: { minHeight: 73, padding: 13, borderRadius: 18, borderColor: COLORS.line, borderWidth: 1, backgroundColor: COLORS.white, flexDirection: "row", gap: 10, alignItems: "center" }, skeletonIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#E9EDF3" }, skeletonCopy: { flex: 1, gap: 8 }, skeletonWide: { height: 13, width: "74%", borderRadius: 5, backgroundColor: "#E9EDF3" }, skeletonShort: { height: 11, width: "52%", borderRadius: 5, backgroundColor: "#E9EDF3" }, skeletonAction: { width: 54, height: 27, borderRadius: 9, backgroundColor: "#E9EDF3" }, retryBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 25 }, retryTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, retryText: { color: COLORS.muted, textAlign: "center", fontSize: 12, lineHeight: 18, marginBottom: 3 },
});
