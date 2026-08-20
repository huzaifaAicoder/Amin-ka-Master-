// @ts-nocheck
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { COLORS, PrimaryButton, Tag } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

const initialDraft = {
  name: "",
  slug: "",
  appName: "",
  tagline: "",
  primaryColor: "#0F172A",
  accentColor: "#F2A541",
  supportEmail: "",
};

const initialFeatures = {
  courses: true,
  assessments: true,
  liveClasses: true,
  shorts: true,
  downloads: true,
  aiDoubt: true,
  aiQuiz: true,
};

const featureLabels = {
  courses: "Courses",
  assessments: "Assessments",
  liveClasses: "Live classes",
  shorts: "Shorts",
  downloads: "Offline downloads",
  aiDoubt: "AI Doubt Solver",
  aiQuiz: "AI Quiz",
};

function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={label} placeholderTextColor="#98A2B3" multiline={multiline} style={[styles.input, multiline && styles.area]} /></View>;
}

export function TemplateStudio() {
  const templates = trpc.developer.templates.useQuery();
  const projectList = trpc.developer.clientProjects.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = trpc.developer.clientProject.useQuery({ clientProjectId: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  const releases = trpc.developer.clientProjectReleases.useQuery({ clientProjectId: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  const create = trpc.developer.createClientProject.useMutation({ onSuccess: () => void projectList.refetch() });
  const update = trpc.developer.updateClientProject.useMutation({ onSuccess: () => { void projectList.refetch(); void selected.refetch(); } });
  const prepare = trpc.developer.prepareClientProjectRelease.useMutation({ onSuccess: () => { void projectList.refetch(); void selected.refetch(); void releases.refetch(); } });
  const generate = trpc.developer.generateClientProjectBlueprint.useMutation();
  const [draft, setDraft] = useState(initialDraft);
  const [branding, setBranding] = useState({ appName: "", tagline: "", primaryColor: "#0F172A", accentColor: "#F2A541", logoUrl: "" });
  const [features, setFeatures] = useState(initialFeatures);
  const [navigation, setNavigation] = useState("home, my_learning, shorts, downloads, account");
  const [pages, setPages] = useState({ supportEmail: "", about: "", contact: "", privacyUrl: "", termsUrl: "" });
  const [aiBrief, setAiBrief] = useState("");
  const [notice, setNotice] = useState("");
  const master = templates.data?.find((entry) => entry.status === "active") ?? templates.data?.[0];
  const projects = projectList.data ?? [];
  const detail = selected.data;
  const busy = create.isPending || update.isPending || prepare.isPending || generate.isPending;

  useEffect(() => {
    if (!detail) return;
    const savedBranding = detail.project.branding ?? {};
    const savedFeatures = detail.project.featureProfile ?? {};
    const savedNavigation = detail.project.navigationProfile ?? {};
    const savedPages = detail.project.publicPages ?? {};
    setBranding({ appName: savedBranding.appName ?? detail.project.name, tagline: savedBranding.tagline ?? "", primaryColor: savedBranding.primaryColor ?? "#0F172A", accentColor: savedBranding.accentColor ?? "#F2A541", logoUrl: savedBranding.logoUrl ?? "" });
    setFeatures({ ...initialFeatures, ...savedFeatures });
    setNavigation((savedNavigation.studentTabs ?? ["home", "my_learning", "shorts", "downloads", "account"]).join(", "));
    setPages({ supportEmail: savedPages.supportEmail ?? "", about: savedPages.about ?? "", contact: savedPages.contact ?? "", privacyUrl: savedPages.privacyUrl ?? "", termsUrl: savedPages.termsUrl ?? "" });
  }, [detail]);

  const createProject = async () => {
    if (!master) return setNotice("The protected master template is not available yet.");
    try {
      const result = await create.mutateAsync({ templateId: master.id, ...draft });
      setDraft(initialDraft);
      setSelectedId(result.clientProjectId);
      setNotice("Isolated client project created. It inherited only configuration capability—not users, passwords, provider keys, audit history, or production media.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Client project could not be created."); }
  };

  const save = async () => {
    if (!detail) return;
    try {
      await update.mutateAsync({
        clientProjectId: detail.project.id,
        branding: { ...branding, logoUrl: branding.logoUrl || null },
        featureProfile: features,
        navigationProfile: { studentTabs: navigation.split(",").map((item) => item.trim()).filter(Boolean), staffAreas: detail.project.navigationProfile?.staffAreas ?? [], ownerAreas: detail.project.navigationProfile?.ownerAreas ?? [] },
        publicPages: pages,
      });
      setNotice("Client configuration saved. The master Amin Ka Master application has not been changed.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Client configuration could not be saved."); }
  };

  const prepareRelease = () => {
    if (!detail) return;
    Alert.alert("Prepare release package?", "This creates a safe handoff manifest. It does not publish the app, generate an APK, or copy any provider credentials.", [
      { text: "Cancel", style: "cancel" },
      { text: "Prepare", onPress: () => void prepare.mutateAsync({ clientProjectId: detail.project.id, confirmation: "PREPARE" }).then((release) => setNotice(`${release.releaseVersion} is ready for separate-project provisioning. Create the separate project, review it, checkpoint it, then use its Publish control for the build.`)).catch((error) => setNotice(error instanceof Error ? error.message : "Release preparation failed.")) },
    ]);
  };

  const applyAiConfiguration = async () => {
    try {
      const blueprint = await generate.mutateAsync({ brief: aiBrief });
      const suggestedBranding = { appName: blueprint.appName, tagline: blueprint.tagline, primaryColor: blueprint.primaryColor, accentColor: blueprint.accentColor, logoUrl: "" };
      if (detail) {
        setBranding(suggestedBranding);
        setFeatures(blueprint.features);
        setNavigation(blueprint.studentTabs.join(", "));
        setPages({ ...pages, about: blueprint.about, contact: blueprint.contact });
        setNotice("AI suggestion applied to this client workspace. Review it and select Save client configuration to persist it.");
      } else {
        setDraft({ ...draft, appName: blueprint.appName, tagline: blueprint.tagline, primaryColor: blueprint.primaryColor, accentColor: blueprint.accentColor });
        setNotice("AI suggestion applied to the new client-project draft. Create the isolated workspace when ready.");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "AI configuration could not be generated."); }
  };

  if (templates.isLoading || projectList.isLoading) return <View style={styles.loading}><ActivityIndicator color={COLORS.indigo} /></View>;
  return <View style={styles.root}>
    <View style={styles.hero}><Text style={styles.eyebrow}>SEPARATE-PROJECT WHITE-LABEL BUILDER</Text><Text style={styles.heroTitle}>Master Template Studio</Text><Text style={styles.heroBody}>Create safe client application workspaces from the complete reference LMS. Configuration is isolated; master production data stays protected.</Text></View>
    <View style={styles.master}><MaterialIcons name="account-tree" size={22} color={COLORS.indigo} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{master?.name ?? "Amin Ka Master Master"}</Text><Text style={styles.cardBody}>Master version {master?.version ?? "—"} · protected reference</Text></View><Tag label={master?.status === "active" ? "ACTIVE" : "PENDING"} tone="green" /></View>
    <View style={styles.aiCard}><View style={styles.aiHeading}><MaterialIcons name="auto-awesome" size={19} color={COLORS.saffron} /><Text style={styles.aiTitle}>AI configuration assistant</Text></View><Text style={styles.cardBody}>Describe the academy, audience, and course style. AI will suggest editable branding, features, navigation, and public copy only. It cannot access secrets, users, or publish an application.</Text><Field label="Client brief" value={aiBrief} onChange={setAiBrief} multiline /><PrimaryButton label={generate.isPending ? "Generating configuration…" : detail ? "Apply AI suggestion to workspace" : "Apply AI suggestion to draft"} icon="auto-awesome" disabled={busy || aiBrief.trim().length < 12} onPress={() => void applyAiConfiguration()} /></View>
    <Text style={styles.section}>Create isolated client project</Text>
    <View style={styles.card}><Field label="Client project name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><Field label="Project slug" value={draft.slug} onChange={(slug) => setDraft({ ...draft, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /><Field label="App display name" value={draft.appName} onChange={(appName) => setDraft({ ...draft, appName })} /><Field label="Tagline" value={draft.tagline} onChange={(tagline) => setDraft({ ...draft, tagline })} /><View style={styles.row}><View style={styles.half}><Field label="Primary #RRGGBB" value={draft.primaryColor} onChange={(primaryColor) => setDraft({ ...draft, primaryColor })} /></View><View style={styles.half}><Field label="Accent #RRGGBB" value={draft.accentColor} onChange={(accentColor) => setDraft({ ...draft, accentColor })} /></View></View><Field label="Support email" value={draft.supportEmail} onChange={(supportEmail) => setDraft({ ...draft, supportEmail })} /><PrimaryButton label={create.isPending ? "Creating client workspace…" : "Create client project"} icon="add-business" disabled={!master || busy} onPress={() => void createProject()} /></View>
    <Text style={styles.section}>Client workspaces</Text>
    {projects.length ? projects.map((entry) => <Pressable key={entry.project.id} onPress={() => setSelectedId(entry.project.id)} style={[styles.project, selectedId === entry.project.id && styles.projectActive]}><View style={[styles.projectMark, { backgroundColor: entry.project.branding?.primaryColor ?? COLORS.indigo }]} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{entry.project.name}</Text><Text style={styles.cardBody}>{entry.project.slug} · {entry.templateName}</Text></View><Tag label={entry.project.status.replace(/_/g, " ").toUpperCase()} tone={entry.project.status === "release_prepared" ? "green" : "saffron"} /></Pressable>) : <View style={styles.empty}><MaterialIcons name="dashboard-customize" size={30} color={COLORS.indigo} /><Text style={styles.cardTitle}>No client projects created</Text><Text style={styles.cardBody}>The Master Template is protected. Your first client project will be a separate configuration workspace.</Text></View>}
    {detail ? <View style={styles.workspace}>
      <Text style={styles.section}>Selected client configuration</Text>
      <View style={styles.preview}><View style={[styles.previewHead, { backgroundColor: branding.primaryColor }]}><Text style={[styles.previewName, { color: branding.accentColor }]}>{branding.appName || detail.project.name}</Text><Text style={styles.previewCopy}>{branding.tagline || "Live configuration preview"}</Text></View><View style={styles.previewContent}><Text style={styles.cardTitle}>Preview-safe configuration</Text><Text style={styles.cardBody}>This visual card uses the same client configuration that release preparation packages. A full runtime preview is available only after the independent project is provisioned.</Text></View></View>
      <View style={styles.card}><Text style={styles.subheading}>Branding</Text><Field label="App display name" value={branding.appName} onChange={(appName) => setBranding({ ...branding, appName })} /><Field label="Tagline" value={branding.tagline} onChange={(tagline) => setBranding({ ...branding, tagline })} /><View style={styles.row}><View style={styles.half}><Field label="Primary colour" value={branding.primaryColor} onChange={(primaryColor) => setBranding({ ...branding, primaryColor })} /></View><View style={styles.half}><Field label="Accent colour" value={branding.accentColor} onChange={(accentColor) => setBranding({ ...branding, accentColor })} /></View></View><Field label="Logo URL (optional)" value={branding.logoUrl} onChange={(logoUrl) => setBranding({ ...branding, logoUrl })} /></View>
      <View style={styles.card}><Text style={styles.subheading}>Feature profile</Text>{Object.entries(featureLabels).map(([key, label]) => <View key={key} style={styles.feature}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{label}</Text><Text style={styles.cardBody}>Enable the module in the generated client project. Server authorization still applies there.</Text></View><Switch value={features[key]} onValueChange={(value) => setFeatures({ ...features, [key]: value })} trackColor={{ false: "#D0D5DD", true: branding.primaryColor }} /></View>)}</View>
      <View style={styles.card}><Text style={styles.subheading}>Navigation & public pages</Text><Field label="Student tabs (comma-separated)" value={navigation} onChange={setNavigation} /><Field label="Support email" value={pages.supportEmail} onChange={(supportEmail) => setPages({ ...pages, supportEmail })} /><Field label="About page copy" value={pages.about} onChange={(about) => setPages({ ...pages, about })} multiline /><Field label="Contact page copy" value={pages.contact} onChange={(contact) => setPages({ ...pages, contact })} multiline /><Field label="Privacy policy URL" value={pages.privacyUrl} onChange={(privacyUrl) => setPages({ ...pages, privacyUrl })} /><Field label="Terms URL" value={pages.termsUrl} onChange={(termsUrl) => setPages({ ...pages, termsUrl })} /><PrimaryButton label={update.isPending ? "Saving configuration…" : "Save client configuration"} icon="save" disabled={busy} onPress={() => void save()} /></View>
      <View style={styles.release}><Text style={styles.subheading}>Separate-project release package</Text><Text style={styles.cardBody}>This package excludes users, passwords, passkeys, provider and payment secrets, webhooks, audit history, database credentials, and production media. Final publish and APK creation happen in the separate project after review.</Text><PrimaryButton label={prepare.isPending ? "Preparing package…" : "Prepare release package"} icon="inventory-2" disabled={busy} onPress={prepareRelease} />{releases.data?.length ? <Text style={styles.releaseNote}>Latest package: {releases.data[0].releaseVersion}. Provision the client project from it, then use that project’s Publish control.</Text> : null}</View>
    </View> : null}
    {notice ? <View style={styles.notice}><MaterialIcons name="info-outline" size={18} color={COLORS.indigo} /><Text style={styles.noticeText}>{notice}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 11 }, workspace: { gap: 11 }, loading: { minHeight: 160, alignItems: "center", justifyContent: "center" }, hero: { gap: 6, padding: 17, borderRadius: 20, backgroundColor: COLORS.indigo }, eyebrow: { color: COLORS.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, heroTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" }, heroBody: { color: "#D6DFF2", fontSize: 12, lineHeight: 18 }, master: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, aiCard: { gap: 9, padding: 13, borderRadius: 17, backgroundColor: "#172554", borderWidth: 1, borderColor: "#1E3A8A" }, aiHeading: { flexDirection: "row", alignItems: "center", gap: 7 }, aiTitle: { color: COLORS.white, fontSize: 14, fontWeight: "900" }, section: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 4 }, subheading: { color: COLORS.indigo, fontSize: 14, fontWeight: "900" }, card: { gap: 10, padding: 13, borderRadius: 17, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, cardTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, cardBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }, field: { gap: 5 }, label: { color: COLORS.ink, fontSize: 11, fontWeight: "800" }, input: { minHeight: 47, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, color: COLORS.ink, backgroundColor: COLORS.white, fontSize: 13 }, area: { minHeight: 76, paddingTop: 11, textAlignVertical: "top" }, row: { flexDirection: "row", gap: 8 }, half: { flex: 1 }, project: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: 15, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line }, projectActive: { backgroundColor: COLORS.indigoSoft, borderColor: COLORS.indigo }, projectMark: { width: 31, height: 31, borderRadius: 10 }, empty: { alignItems: "center", gap: 6, padding: 20, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: "#B7C4E3", backgroundColor: "#F8FAFC" }, preview: { overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }, previewHead: { padding: 16, minHeight: 92, justifyContent: "center" }, previewName: { fontSize: 20, fontWeight: "900" }, previewCopy: { color: "#E2E8F0", fontSize: 12, marginTop: 4 }, previewContent: { padding: 14 }, feature: { minHeight: 57, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: COLORS.line }, release: { gap: 9, padding: 13, borderRadius: 17, backgroundColor: "#FFF8EC", borderWidth: 1, borderColor: "#F5D69E" }, releaseNote: { color: COLORS.earth, fontSize: 11, lineHeight: 16, fontWeight: "700" }, notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 14, backgroundColor: COLORS.indigoSoft }, noticeText: { flex: 1, color: COLORS.indigo, fontSize: 12, lineHeight: 17, fontWeight: "700" },
});
