import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, Tag } from "@/components/lms-ui";
import { convertLandUnit, LAND_UNIT_LABELS, LAND_UNIT_SYSTEMS, supportedLandUnits, type LandUnit } from "@/lib/amin-toolkit";

export default function UnitConverterScreen() {
  const router = useRouter();
  const [systemId, setSystemId] = useState("bihar-common");
  const [from, setFrom] = useState<LandUnit>("acre");
  const [to, setTo] = useState<LandUnit>("bigha");
  const [amount, setAmount] = useState("1");
  const system = LAND_UNIT_SYSTEMS.find((entry) => entry.id === systemId) ?? LAND_UNIT_SYSTEMS[0];
  const supported = useMemo(() => supportedLandUnits(system.id), [system.id]);
  const numericAmount = Number(amount.replace(/,/g, ""));
  const result = convertLandUnit(numericAmount, from, to, system.id);
  const chooseSystem = (id: string) => {
    setSystemId(id);
    const units = supportedLandUnits(id);
    if (!units.includes(from)) setFrom("acre");
    if (!units.includes(to)) setTo(units.includes("bigha") ? "bigha" : "square_meters");
  };
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Amin Toolkit" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View><Text style={styles.eyebrow}>REGION-AWARE</Text><Text style={styles.title}>Land Unit Converter</Text></View></View><View style={styles.notice}><Tag label="CHECK LOCAL PRACTICE" tone="saffron" /><Text style={styles.noticeText}>Bigha, Katha, and Dhur are not universal across India. Choose the state/region system that matches the local revenue or field convention before converting.</Text></View><Text style={styles.label}>State / region system</Text><View style={styles.chips}>{LAND_UNIT_SYSTEMS.map((entry) => <Pressable key={entry.id} accessibilityRole="radio" accessibilityState={{ checked: system.id === entry.id }} onPress={() => chooseSystem(entry.id)} style={[styles.chip, system.id === entry.id && styles.chipActive]}><Text style={[styles.chipText, system.id === entry.id && styles.chipTextActive]}>{entry.state}</Text></Pressable>)}</View><View style={styles.systemCard}><Text style={styles.systemTitle}>{system.title}</Text><Text style={styles.systemNote}>{system.note}</Text></View><Text style={styles.label}>Amount</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Enter area" placeholderTextColor="#98A2B3" style={styles.input} /><Text style={styles.label}>Convert from</Text><UnitChoices units={supported} selected={from} onSelect={setFrom} /><Text style={styles.label}>Convert to</Text><UnitChoices units={supported} selected={to} onSelect={setTo} /><View style={styles.result}><Text style={styles.resultCaption}>CONVERTED VALUE</Text><Text style={styles.resultValue}>{result === null || !Number.isFinite(result) ? "Enter a valid amount" : `${result.toLocaleString("en-IN", { maximumFractionDigits: 6 })} ${LAND_UNIT_LABELS[to]}`}</Text><Text style={styles.resultBody}>Based on {system.title}. This is a learning and reference calculation, not a certified land measurement.</Text></View></ScrollView></ScreenContainer>;
}

function UnitChoices({ units, selected, onSelect }: { units: LandUnit[]; selected: LandUnit; onSelect: (value: LandUnit) => void }) {
  return <View style={styles.chips}>{units.map((unit) => <Pressable key={unit} accessibilityRole="radio" accessibilityState={{ checked: selected === unit }} onPress={() => onSelect(unit)} style={[styles.chip, selected === unit && styles.chipActive]}><Text style={[styles.chipText, selected === unit && styles.chipTextActive]}>{LAND_UNIT_LABELS[unit]}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({ content: { paddingTop: 10, paddingBottom: 28, gap: 11 }, header: { flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.indigoSoft, justifyContent: "center", alignItems: "center" }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900", marginTop: 2 }, notice: { gap: 7, padding: 13, borderRadius: 17, backgroundColor: "#FFF8E9", borderWidth: 1, borderColor: "#F3D79F" }, noticeText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, label: { color: COLORS.ink, fontSize: 13, fontWeight: "900", marginTop: 3 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { minHeight: 36, justifyContent: "center", borderRadius: 11, paddingHorizontal: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, chipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, chipText: { color: COLORS.indigo, fontSize: 12, fontWeight: "800" }, chipTextActive: { color: COLORS.white }, systemCard: { padding: 12, borderRadius: 14, backgroundColor: COLORS.indigoSoft }, systemTitle: { color: COLORS.indigo, fontSize: 13, fontWeight: "900" }, systemNote: { color: COLORS.muted, marginTop: 4, fontSize: 11, lineHeight: 16 }, input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, color: COLORS.ink, backgroundColor: COLORS.white, fontSize: 16 }, result: { gap: 7, padding: 17, borderRadius: 18, backgroundColor: COLORS.indigo, marginTop: 6 }, resultCaption: { color: "#BFCDE8", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, resultValue: { color: COLORS.white, fontSize: 20, fontWeight: "900" }, resultBody: { color: "#D6DFF2", fontSize: 11, lineHeight: 16 } });
