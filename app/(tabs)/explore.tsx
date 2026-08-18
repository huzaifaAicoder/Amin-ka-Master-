import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, Tag, formatPrice } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [search, setSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState<string | undefined>(params.category);
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const coursesQuery = trpc.catalog.courses.useQuery({ search: search || undefined, categorySlug });

  useEffect(() => setCategorySlug(params.category), [params.category]);

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <View style={styles.header}><Text style={styles.title}>Explore courses</Text><Text style={styles.subtitle}>Find the next concept to master.</Text></View>
      <View style={styles.searchBox}><MaterialIcons name="search" size={22} color={COLORS.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search courses" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search courses" /></View>
      <FlatList horizontal data={[{ id: 0, name: "All topics", slug: "" }, ...(categoriesQuery.data ?? [])]} keyExtractor={(item) => item.id.toString()} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} renderItem={({ item }) => { const active = (item.slug || undefined) === categorySlug; return <Pressable onPress={() => setCategorySlug(item.slug || undefined)} style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.pressed]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item.name}</Text></Pressable>; }} />
      {coursesQuery.isLoading ? (
        <View style={styles.loader}><ActivityIndicator color={COLORS.indigo} /></View>
      ) : coursesQuery.data?.length ? (
        <FlatList
          data={coursesQuery.data}
          keyExtractor={(item) => item.course.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => router.push(`/course/${item.course.slug}`)} style={({ pressed }) => [styles.courseRow, pressed && styles.pressed]}>
              <View style={[styles.visual, index % 3 === 1 && styles.visualEarth, index % 3 === 2 && styles.visualGreen]}><MaterialIcons name={index % 3 === 0 ? "map" : index % 3 === 1 ? "school" : "description"} size={28} color={COLORS.white} /></View>
              <View style={styles.courseCopy}>
                <View style={styles.courseTagRow}><Tag label={item.categoryName.toUpperCase()} tone="indigo" />{item.course.accessType === "free" ? <Tag label="FREE" tone="green" /> : null}</View>
                <Text numberOfLines={2} style={styles.courseTitle}>{item.course.title}</Text>
                <Text numberOfLines={1} style={styles.courseDescription}>{item.course.shortDescription}</Text>
                <View style={styles.priceRow}><Text style={styles.price}>{formatPrice(item.course.sellingPrice)}</Text>{Number(item.course.mrp) > Number(item.course.sellingPrice) ? <Text style={styles.mrp}>₹{Number(item.course.mrp).toLocaleString("en-IN")}</Text> : null}</View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#98A2B3" />
            </Pressable>
          )}
        />
      ) : (
        <EmptyState icon="search-off" title="No courses matched" body="Try a different keyword or return to all topics." />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, marginBottom: 18 },
  title: { color: COLORS.ink, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.muted, marginTop: 5, fontSize: 14 },
  searchBox: { backgroundColor: COLORS.white, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, minHeight: 52, paddingHorizontal: 14, alignItems: "center", flexDirection: "row", gap: 10 },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 15, minHeight: 50 },
  filters: { gap: 8, paddingVertical: 16, paddingRight: 20 },
  filter: { borderWidth: 1, borderColor: COLORS.line, minHeight: 36, paddingHorizontal: 13, borderRadius: 999, justifyContent: "center", backgroundColor: COLORS.white },
  filterActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  filterText: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  filterTextActive: { color: COLORS.white },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 104, gap: 11 },
  courseRow: { minHeight: 132, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 19, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  visual: { width: 72, height: 98, borderRadius: 14, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center" },
  visualEarth: { backgroundColor: COLORS.earth },
  visualGreen: { backgroundColor: COLORS.green },
  courseCopy: { flex: 1, gap: 6, alignSelf: "stretch", justifyContent: "center" },
  courseTagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  courseTitle: { color: COLORS.ink, fontSize: 16, fontWeight: "800", lineHeight: 21 },
  courseDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  priceRow: { flexDirection: "row", gap: 8, alignItems: "baseline" },
  price: { color: COLORS.indigo, fontSize: 14, fontWeight: "900" },
  mrp: { color: "#98A2B3", fontSize: 11, textDecorationLine: "line-through" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
