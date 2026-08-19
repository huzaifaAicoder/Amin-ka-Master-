import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, PrimaryButton, Tag } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function CategoriesScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const enabled = user?.role === "admin" || user?.role === "super_admin";
  const categoriesQuery = trpc.catalog.categories.useQuery(undefined, { enabled, retry: false });
  const createCategory = trpc.operations.createCategory.useMutation({ onSuccess: () => void categoriesQuery.refetch() });
  const updateCategory = trpc.operations.updateCategory.useMutation({ onSuccess: () => void categoriesQuery.refetch() });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="lock" title="Admin access required" body="Categories are managed by Admin and Super Admin accounts." /></ScreenContainer>;
  if (categoriesQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  const submit = async () => {
    const normalizedSlug = slug.trim().toLowerCase();
    if (name.trim().length < 3 || !/^[a-z0-9-]+$/.test(normalizedSlug)) return Alert.alert("Check the category", "Add a name and a lowercase slug using letters, numbers and hyphens only.");
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ categoryId: editingId, name: name.trim(), slug: normalizedSlug, description: description.trim() || undefined });
        Alert.alert("Category updated", "The name, slug and description were saved.");
      } else {
        await createCategory.mutateAsync({ name: name.trim(), slug: normalizedSlug, description: description.trim() || undefined });
        Alert.alert("Category created", "It is available for new course setup.");
      }
      setEditingId(null); setName(""); setSlug(""); setDescription("");
    } catch (error) { Alert.alert(editingId ? "Category not updated" : "Category not created", error instanceof Error ? error.message : "Please try again."); }
  };
  const saving = createCategory.isPending || updateCategory.isPending;
  const beginEdit = (category: NonNullable<typeof categoriesQuery.data>[number]) => { setEditingId(category.id); setName(category.name); setSlug(category.slug); setDescription(category.description ?? ""); };
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><View><Text style={styles.eyebrow}>COURSE CATALOG</Text><Text style={styles.title}>Categories</Text></View></View><Text style={styles.helper}>Create or edit learner-facing categories here. Slugs are validated and saved explicitly, so update shared links carefully.</Text><View style={styles.card}><View style={styles.cardHeader}><Text style={styles.cardTitle}>{editingId ? "Edit category" : "New category"}</Text>{editingId ? <Pressable onPress={() => { setEditingId(null); setName(""); setSlug(""); setDescription(""); }}><Text style={styles.cancel}>Cancel</Text></Pressable> : null}</View><TextInput value={name} onChangeText={setName} placeholder="e.g. Revenue records" placeholderTextColor="#98A2B3" style={styles.input} /><TextInput value={slug} onChangeText={(value) => setSlug(value.replace(/\s+/g, "-").toLowerCase())} autoCapitalize="none" placeholder="e.g. revenue-records" placeholderTextColor="#98A2B3" style={styles.input} /><TextInput value={description} onChangeText={setDescription} multiline placeholder="Optional learner-facing description" placeholderTextColor="#98A2B3" style={[styles.input, styles.area]} /><PrimaryButton label={saving ? "Saving…" : editingId ? "Save category changes" : "Create category"} icon={editingId ? "save" : "add"} disabled={saving} onPress={submit} /></View><Text style={styles.section}>Active categories</Text>{categoriesQuery.isError ? <EmptyState icon="wifi-off" title="Categories could not load" body="Check your connection, then try again." action={<PrimaryButton label="Retry" icon="refresh" onPress={() => void categoriesQuery.refetch()} />} /> : (categoriesQuery.data ?? []).map((category) => <View key={category.id} style={styles.row}><View style={styles.icon}><MaterialIcons name="folder" size={20} color={COLORS.indigo} /></View><Pressable onPress={() => beginEdit(category)} style={{ flex: 1 }}><Text style={styles.rowTitle}>{category.name}</Text><Text style={styles.rowCopy}>{category.description || category.slug}</Text></Pressable><View style={styles.rowActions}><Tag label={category.slug.toUpperCase()} tone="indigo" /><Pressable accessibilityLabel={`Edit ${category.name}`} onPress={() => beginEdit(category)} style={styles.edit}><MaterialIcons name="edit" size={18} color={COLORS.indigo} /></Pressable></View></View>)}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 12, paddingBottom: 40, gap: 11 }, header: { flexDirection: "row", alignItems: "center", gap: 11 }, back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900" }, helper: { backgroundColor: COLORS.indigoSoft, color: COLORS.indigo, borderRadius: 14, padding: 12, fontSize: 12, lineHeight: 18 }, card: { gap: 10, borderRadius: 19, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, padding: 14 }, cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, cardTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, cancel: { color: COLORS.indigo, fontSize: 12, fontWeight: "900" }, input: { minHeight: 51, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper, paddingHorizontal: 12, color: COLORS.ink, fontSize: 14 }, area: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" }, section: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 7 }, row: { minHeight: 66, gap: 10, padding: 11, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, flexDirection: "row", alignItems: "center" }, icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, rowTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900" }, rowCopy: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, rowActions: { alignItems: "flex-end", gap: 5 }, edit: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.indigoSoft }, });
