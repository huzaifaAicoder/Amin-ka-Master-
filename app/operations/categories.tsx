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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  if (!enabled) return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="lock" title="Admin access required" body="Categories are managed by Admin and Super Admin accounts." /></ScreenContainer>;
  if (categoriesQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  const submit = async () => {
    const normalizedSlug = slug.trim().toLowerCase();
    if (name.trim().length < 3 || !/^[a-z0-9-]+$/.test(normalizedSlug)) return Alert.alert("Check the category", "Add a name and a lowercase slug using letters, numbers and hyphens only.");
    try {
      await createCategory.mutateAsync({ name: name.trim(), slug: normalizedSlug, description: description.trim() || undefined });
      setName(""); setSlug(""); setDescription("");
      Alert.alert("Category created", "It is available for new course setup.");
    } catch (error) { Alert.alert("Category not created", error instanceof Error ? error.message : "Please try again."); }
  };
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><View><Text style={styles.eyebrow}>COURSE CATALOG</Text><Text style={styles.title}>Categories</Text></View></View><Text style={styles.helper}>Create a short, stable category before setting up a course. Slugs cannot be changed from this release because they may already be used in shared links.</Text><View style={styles.card}><Text style={styles.cardTitle}>New category</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Revenue records" placeholderTextColor="#98A2B3" style={styles.input} /><TextInput value={slug} onChangeText={(value) => setSlug(value.replace(/\s+/g, "-").toLowerCase())} autoCapitalize="none" placeholder="e.g. revenue-records" placeholderTextColor="#98A2B3" style={styles.input} /><TextInput value={description} onChangeText={setDescription} multiline placeholder="Optional learner-facing description" placeholderTextColor="#98A2B3" style={[styles.input, styles.area]} /><PrimaryButton label={createCategory.isPending ? "Creating…" : "Create category"} icon="add" disabled={createCategory.isPending} onPress={submit} /></View><Text style={styles.section}>Active categories</Text>{categoriesQuery.isError ? <EmptyState icon="wifi-off" title="Categories could not load" body="Check your connection, then try again." action={<PrimaryButton label="Retry" icon="refresh" onPress={() => void categoriesQuery.refetch()} />} /> : (categoriesQuery.data ?? []).map((category) => <View key={category.id} style={styles.row}><View style={styles.icon}><MaterialIcons name="folder" size={20} color={COLORS.indigo} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{category.name}</Text><Text style={styles.rowCopy}>{category.description || category.slug}</Text></View><Tag label={category.slug.toUpperCase()} tone="indigo" /></View>)}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 12, paddingBottom: 40, gap: 11 }, header: { flexDirection: "row", alignItems: "center", gap: 11 }, back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900" }, helper: { backgroundColor: COLORS.indigoSoft, color: COLORS.indigo, borderRadius: 14, padding: 12, fontSize: 12, lineHeight: 18 }, card: { gap: 10, borderRadius: 19, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, padding: 14 }, cardTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "900" }, input: { minHeight: 51, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper, paddingHorizontal: 12, color: COLORS.ink, fontSize: 14 }, area: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" }, section: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 7 }, row: { minHeight: 66, gap: 10, padding: 11, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, flexDirection: "row", alignItems: "center" }, icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigoSoft }, rowTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "900" }, rowCopy: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, });
