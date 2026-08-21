import { MaterialIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, Tag } from "@/components/lms-ui";
import { buildLandConversionReportHtml } from "@/lib/land-conversion-report";
import { convertLandUnit, INDIA_STATES, LAND_UNIT_LABELS, loadPreferredIndiaState, loadRecentConversions, persistPreferredIndiaState, persistRecentConversion, reviewedLandReferenceCardsForState, standardSystemForIndiaState, supportedLandUnits, systemsForIndiaState, type IndiaState, type LandUnit, type RecentConversion } from "@/lib/amin-toolkit";
import { trpc } from "@/lib/trpc";

export default function UnitConverterScreen() {
  const router = useRouter();
  const [stateCode, setStateCode] = useState("BR");
  const [stateSearch, setStateSearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [systemId, setSystemId] = useState("BR-standard");
  const [from, setFrom] = useState<LandUnit>("acre");
  const [to, setTo] = useState<LandUnit>("square_meters");
  const [amount, setAmount] = useState("1");
  const [recent, setRecent] = useState<RecentConversion[]>([]);
  const [exporting, setExporting] = useState(false);
  const selectedState = INDIA_STATES.find((entry) => entry.code === stateCode) ?? INDIA_STATES[0];
  const stateSystems = useMemo(() => systemsForIndiaState(stateCode), [stateCode]);
  const system = stateSystems.find((entry) => entry.id === systemId) ?? standardSystemForIndiaState(stateCode);
  const supported = useMemo(() => supportedLandUnits(system.id), [system.id]);
  const shownStates = useMemo(() => INDIA_STATES.filter((entry) => entry.name.toLocaleLowerCase().includes(stateSearch.trim().toLocaleLowerCase())).slice(0, 12), [stateSearch]);
  const districtDirectory = trpc.student.districtDirectory.useQuery({ stateCode }, { staleTime: 6 * 60 * 60 * 1000, retry: 1 });
  const shownDistricts = useMemo(() => (districtDirectory.data?.districts ?? []).filter((district) => district.toLocaleLowerCase().includes(districtSearch.trim().toLocaleLowerCase())).slice(0, 12), [districtDirectory.data?.districts, districtSearch]);
  const numericAmount = Number(amount.replace(/,/g, ""));
  const result = convertLandUnit(numericAmount, from, to, system.id);
  const districtReferences = reviewedLandReferenceCardsForState(stateCode);

  useEffect(() => {
    void Promise.all([loadPreferredIndiaState(), loadRecentConversions()]).then(([preferred, history]) => {
      if (preferred) {
        setStateCode(preferred);
        setSystemId(standardSystemForIndiaState(preferred).id);
      }
      setRecent(history);
    });
  }, []);

  const chooseSystem = (id: string) => {
    setSystemId(id);
    const units = supportedLandUnits(id);
    if (!units.includes(from)) setFrom("acre");
    if (!units.includes(to)) setTo(units.includes("decimal") ? "decimal" : "square_meters");
  };
  const chooseState = (state: IndiaState) => {
    setStateCode(state.code);
    setStateSearch("");
    setDistrictSearch("");
    chooseSystem(standardSystemForIndiaState(state.code).id);
    void persistPreferredIndiaState(state.code);
  };
  const saveRecent = async () => {
    if (result === null || !Number.isFinite(result)) return;
    setRecent(await persistRecentConversion({ stateCode, systemId: system.id, districtOrTehsil: districtSearch, amount: numericAmount, from, to }));
  };
  const restoreRecent = (entry: RecentConversion) => {
    setStateCode(entry.stateCode);
    setSystemId(entry.systemId);
    setDistrictSearch(entry.districtOrTehsil);
    setAmount(String(entry.amount));
    setFrom(entry.from);
    setTo(entry.to);
  };
  const exportRecent = async () => {
    if (!recent.length) return Alert.alert("No recent conversions", "Save at least one conversion before exporting a private PDF.");
    if (Platform.OS === "web") return Alert.alert("Native app required", "For privacy, conversion PDFs are stored in the protected offline library on Android or iOS.");
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory) return Alert.alert("PDF export unavailable", "Your device does not provide private app storage.");
    setExporting(true);
    try {
      const privateFolder = `${documentDirectory}protected-resources/`;
      await FileSystem.makeDirectoryAsync(privateFolder, { intermediates: true });
      const generated = await Print.printToFileAsync({ html: buildLandConversionReportHtml(recent) });
      const targetUri = `${privateFolder}${Date.now()}-land-conversion-history.pdf`;
      await FileSystem.moveAsync({ from: generated.uri, to: targetUri });
      router.push({ pathname: "/pdf-reader", params: { uri: targetUri, title: "Recent land conversions" } } as never);
    } catch (error) {
      Alert.alert("PDF export unavailable", error instanceof Error ? error.message : "Your conversion report could not be saved. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Return to Amin Toolkit" onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" size={21} color={COLORS.indigo} /></Pressable><View><Text style={styles.eyebrow}>INDIA-WIDE · STATE-FIRST</Text><Text style={styles.title}>Land Unit Converter</Text></View></View>
      <View style={styles.notice}><Tag label="NO UNIVERSAL BIGHA" tone="saffron" /><Text style={styles.noticeText}>Select your State/UT first. Fixed-area units work everywhere; local units appear only in an explicit profile and must match the district or tehsil revenue convention.</Text></View>

      <Text style={styles.step}>1 · State or Union Territory</Text>
      <TextInput value={stateSearch} onChangeText={setStateSearch} placeholder="Search State / UT" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="done" />
      <View style={styles.stateSummary}><MaterialIcons name="location-on" size={19} color={COLORS.indigo} /><View style={styles.grow}><Text style={styles.stateName}>{selectedState.name}</Text><Text style={styles.stateMeta}>{selectedState.kind === "state" ? "State" : "Union Territory"} · saved on this device</Text></View></View>
      <View style={styles.stateList}>{shownStates.map((entry) => <Pressable key={entry.code} accessibilityRole="radio" accessibilityState={{ checked: entry.code === stateCode }} onPress={() => chooseState(entry)} style={[styles.stateChip, entry.code === stateCode && styles.stateChipActive]}><Text style={[styles.stateChipText, entry.code === stateCode && styles.stateChipTextActive]}>{entry.name}</Text></Pressable>)}</View>
      {stateSearch && !shownStates.length ? <Text style={styles.emptySearch}>No State/UT matches that search.</Text> : null}

      <Text style={styles.step}>2 · District / tehsil confirmation</Text>
      <TextInput value={districtSearch} onChangeText={setDistrictSearch} placeholder="Search the official district directory" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="done" />
      <Text style={styles.helper}>{districtSearch.trim() ? `Use “${districtSearch.trim()}” to check the selected reference profile against the official record.` : `Search districts listed for ${selectedState.name}; selecting one never certifies a local-unit convention.`}</Text>
      {districtDirectory.isLoading ? <View style={styles.directoryStatus}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.helper}>Loading the official district directory…</Text></View> : null}
      {districtDirectory.isError ? <View style={styles.directoryStatus}><Text style={styles.directoryError}>The official district directory could not load. You can still type the district from your record.</Text><Pressable accessibilityRole="button" onPress={() => void districtDirectory.refetch()} style={styles.directoryRetry}><MaterialIcons name="refresh" size={16} color={COLORS.white} /><Text style={styles.directoryRetryText}>Retry directory</Text></Pressable></View> : null}
      {!districtDirectory.isLoading && !districtDirectory.isError ? <View style={styles.districtList}>{shownDistricts.map((district) => <Pressable key={district} accessibilityRole="button" accessibilityLabel={`Select ${district}`} onPress={() => setDistrictSearch(district)} style={[styles.districtChip, districtSearch === district && styles.districtChipActive]}><Text style={[styles.districtChipText, districtSearch === district && styles.districtChipTextActive]}>{district}</Text></Pressable>)}</View> : null}
      {districtSearch && !districtDirectory.isLoading && !districtDirectory.isError && !shownDistricts.length ? <Text style={styles.emptySearch}>No official district match. Keep the spelling from the revenue record.</Text> : null}

      <Text style={styles.step}>3 · Local profile for {selectedState.name}</Text>
      <Text style={styles.helper}>Start with fixed-area units unless your revenue record confirms one of the local profiles below.</Text>
      <View style={styles.profileList}>{stateSystems.map((entry) => <Pressable key={entry.id} accessibilityRole="radio" accessibilityState={{ checked: system.id === entry.id }} onPress={() => chooseSystem(entry.id)} style={[styles.profile, system.id === entry.id && styles.profileActive]}><View style={styles.grow}><Text style={styles.profileTitle}>{entry.title}</Text><Text style={styles.profileGeography}>{entry.geography}</Text></View><Tag label={entry.verification === "standard" ? "STANDARD" : "DISTRICT CHECK"} tone={entry.verification === "standard" ? "green" : "saffron"} /></Pressable>)}</View>
      <View style={[styles.systemCard, system.verification === "district_confirmation_required" && styles.systemCardCaution]}><Text style={styles.systemTitle}>{system.title}</Text><Text style={styles.systemNote}>{system.note}</Text></View>

      <View style={styles.references}><Text style={styles.referencesTitle}>Reviewed official references</Text><Text style={styles.helper}>Cards show only reviewed state coverage. They help confirm record terminology but do not certify a conversion or invent a district circular.</Text>{districtReferences.length ? districtReferences.map((reference) => <Pressable key={reference.id} onPress={() => router.push({ pathname: "/toolkit/land-records", params: { portal: reference.portalId } } as never)} style={styles.reference}><MaterialIcons name={reference.kind === "circular directory" ? "gavel" : "account-balance"} size={18} color={COLORS.indigo} /><View style={styles.grow}><Text style={styles.referenceText}>{reference.title}</Text><Text style={styles.referenceMeta}>{reference.issuer} · {reference.coverage}</Text><Text style={styles.referenceNote}>{reference.note}</Text></View><MaterialIcons name="chevron-right" size={19} color={COLORS.muted} /></Pressable>) : <Text style={styles.noReference}>No reviewed district or state reference card is catalogued for this selection yet. Fixed-area units remain available.</Text>}</View>

      <Text style={styles.step}>4 · Convert area</Text>
      <Text style={styles.label}>Amount</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Enter area" placeholderTextColor="#98A2B3" style={styles.input} />
      <Text style={styles.label}>Convert from</Text><UnitChoices units={supported} selected={from} onSelect={setFrom} />
      <Text style={styles.label}>Convert to</Text><UnitChoices units={supported} selected={to} onSelect={setTo} />
      <View style={styles.result}><Text style={styles.resultCaption}>CONVERTED VALUE</Text><Text style={styles.resultValue}>{result === null || !Number.isFinite(result) ? "Enter a valid amount" : `${result.toLocaleString("en-IN", { maximumFractionDigits: 6 })} ${LAND_UNIT_LABELS[to]}`}</Text><Text style={styles.resultBody}>Based on the selected {selectedState.name} profile. This is a learning/reference calculation, never a certified survey or land-record verification.</Text></View>
      <Pressable disabled={result === null || !Number.isFinite(result)} onPress={() => void saveRecent()} style={[styles.saveRecent, (result === null || !Number.isFinite(result)) && styles.disabled]}><MaterialIcons name="history" size={18} color={COLORS.indigo} /><Text style={styles.saveRecentText}>Save to recent conversions</Text></Pressable>

      {recent.length ? <View style={styles.recent}><View style={styles.recentHeader}><Text style={styles.referencesTitle}>Recent conversions</Text><Pressable accessibilityRole="button" accessibilityLabel="Export recent conversions as a private PDF" disabled={exporting} onPress={() => void exportRecent()} style={[styles.exportButton, exporting && styles.disabled]}><MaterialIcons name="picture-as-pdf" size={17} color={COLORS.white} /><Text style={styles.exportButtonText}>{exporting ? "Preparing…" : "Export PDF"}</Text></Pressable></View><Text style={styles.helper}>The report is generated on your device and saved to protected offline storage.</Text>{recent.slice(0, 5).map((entry) => <Pressable key={entry.id} onPress={() => restoreRecent(entry)} style={styles.reference}><View style={styles.grow}><Text style={styles.referenceText}>{entry.amount} {LAND_UNIT_LABELS[entry.from]} → {LAND_UNIT_LABELS[entry.to]}</Text><Text style={styles.recentMeta}>{INDIA_STATES.find((state) => state.code === entry.stateCode)?.name ?? entry.stateCode}{entry.districtOrTehsil ? ` · ${entry.districtOrTehsil}` : ""}</Text></View><MaterialIcons name="restore" size={18} color={COLORS.indigo} /></Pressable>)}</View> : null}
    </ScrollView>
  </ScreenContainer>;
}

function UnitChoices({ units, selected, onSelect }: { units: LandUnit[]; selected: LandUnit; onSelect: (value: LandUnit) => void }) {
  return <View style={styles.chips}>{units.map((unit) => <Pressable key={unit} accessibilityRole="radio" accessibilityState={{ checked: selected === unit }} onPress={() => onSelect(unit)} style={[styles.chip, selected === unit && styles.chipActive]}><Text style={[styles.chipText, selected === unit && styles.chipTextActive]}>{LAND_UNIT_LABELS[unit]}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 10, paddingBottom: 28, gap: 11 }, header: { flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.indigoSoft, justifyContent: "center", alignItems: "center" }, grow: { flex: 1 }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 22, fontWeight: "900", marginTop: 2 }, notice: { gap: 7, padding: 13, borderRadius: 17, backgroundColor: "#FFF8E9", borderWidth: 1, borderColor: "#F3D79F" }, noticeText: { color: COLORS.earth, fontSize: 12, lineHeight: 18 }, step: { color: COLORS.ink, fontSize: 14, fontWeight: "900", marginTop: 4 }, label: { color: COLORS.ink, fontSize: 13, fontWeight: "900", marginTop: 3 }, helper: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: -5 }, searchInput: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, color: COLORS.ink, backgroundColor: COLORS.white, fontSize: 14 }, stateSummary: { minHeight: 57, flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 15, backgroundColor: COLORS.indigoSoft }, stateName: { color: COLORS.indigo, fontSize: 14, fontWeight: "900" }, stateMeta: { color: COLORS.muted, fontSize: 11, marginTop: 2 }, stateList: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, stateChip: { minHeight: 34, justifyContent: "center", borderRadius: 10, paddingHorizontal: 10, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, stateChipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, stateChipText: { color: COLORS.indigo, fontSize: 11, fontWeight: "800" }, stateChipTextActive: { color: COLORS.white }, districtList: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, districtChip: { minHeight: 34, justifyContent: "center", borderRadius: 10, paddingHorizontal: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: COLORS.line }, districtChipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, districtChipText: { color: COLORS.indigo, fontSize: 11, fontWeight: "800" }, districtChipTextActive: { color: COLORS.white }, directoryStatus: { gap: 8, padding: 11, borderRadius: 12, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: COLORS.line, alignItems: "flex-start" }, directoryError: { color: COLORS.earth, fontSize: 11, lineHeight: 16 }, directoryRetry: { minHeight: 34, borderRadius: 10, paddingHorizontal: 10, backgroundColor: COLORS.indigo, flexDirection: "row", alignItems: "center", gap: 5 }, directoryRetryText: { color: COLORS.white, fontSize: 11, fontWeight: "900" }, emptySearch: { color: COLORS.muted, fontSize: 12, textAlign: "center", paddingVertical: 6 }, profileList: { gap: 8 }, profile: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, profileActive: { borderColor: COLORS.indigo, backgroundColor: "#F4F7FF" }, profileTitle: { color: COLORS.ink, fontSize: 12, fontWeight: "900" }, profileGeography: { color: COLORS.muted, marginTop: 3, fontSize: 10, lineHeight: 14 }, systemCard: { padding: 12, borderRadius: 14, backgroundColor: COLORS.indigoSoft }, systemCardCaution: { backgroundColor: "#FFF8E9", borderWidth: 1, borderColor: "#F3D79F" }, systemTitle: { color: COLORS.indigo, fontSize: 13, fontWeight: "900" }, systemNote: { color: COLORS.muted, marginTop: 4, fontSize: 11, lineHeight: 16 }, references: { padding: 12, borderRadius: 14, backgroundColor: "#F4FBF7", borderWidth: 1, borderColor: "#CBE7D9", gap: 7 }, referencesTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, reference: { minHeight: 40, borderRadius: 10, backgroundColor: COLORS.white, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: COLORS.line }, referenceText: { color: COLORS.indigo, fontSize: 12, fontWeight: "900" }, referenceMeta: { color: COLORS.muted, fontSize: 10, marginTop: 2, lineHeight: 14 }, referenceNote: { color: COLORS.muted, fontSize: 10, marginTop: 3, lineHeight: 14 }, noReference: { color: COLORS.muted, fontSize: 11, lineHeight: 16, paddingVertical: 4 }, recentMeta: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, recent: { gap: 7, padding: 12, borderRadius: 14, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: COLORS.line }, recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, exportButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 11, backgroundColor: COLORS.indigo, flexDirection: "row", alignItems: "center", gap: 5 }, exportButtonText: { color: COLORS.white, fontSize: 10, fontWeight: "900" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { minHeight: 36, justifyContent: "center", borderRadius: 11, paddingHorizontal: 11, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, chipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo }, chipText: { color: COLORS.indigo, fontSize: 12, fontWeight: "800" }, chipTextActive: { color: COLORS.white }, input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, color: COLORS.ink, backgroundColor: COLORS.white, fontSize: 16 }, result: { gap: 7, padding: 17, borderRadius: 18, backgroundColor: COLORS.indigo, marginTop: 6 }, resultCaption: { color: "#BFCDE8", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, resultValue: { color: COLORS.white, fontSize: 20, fontWeight: "900" }, resultBody: { color: "#D6DFF2", fontSize: 11, lineHeight: 16 }, saveRecent: { minHeight: 44, borderRadius: 13, backgroundColor: COLORS.indigoSoft, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 7 }, saveRecentText: { color: COLORS.indigo, fontSize: 12, fontWeight: "900" }, disabled: { opacity: 0.45 },
});
