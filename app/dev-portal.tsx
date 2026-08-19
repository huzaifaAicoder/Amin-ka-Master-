import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { COLORS, EmptyState, PrimaryButton, Tag } from "@/components/lms-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type Form = { appName: string; tagline: string; contactEmail: string; contactPhone: string; whatsapp: string; themePrimary: string; themeAccent: string; developerName: string; developerRole: string; developerProjectInfo: string; developerContact: string; developerCopyright: string };
const emptyForm: Form = { appName: "", tagline: "", contactEmail: "", contactPhone: "", whatsapp: "", themePrimary: "#0F172A", themeAccent: "#F2A541", developerName: "", developerRole: "", developerProjectInfo: "", developerContact: "", developerCopyright: "" };
type ToastState = { title: string; message: string; tone: "error" | "success" };

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "Please check the details and try again.";
  if (/password.*(12|at least|character)/i.test(message)) return "Password must be at least 12 characters long.";
  if (/email|invalid.*address/i.test(message)) return "Enter a valid developer email address.";
  if (/passkey/i.test(message)) return "The Developer Passkey is incorrect or missing.";
  if (/setup code/i.test(message)) return "The setup code is incorrect or missing.";
  return message.replace(/^\{.*\}$/s, "Please check the details and try again.");
}

export default function DeveloperPortalScreen() {
  const router = useRouter();
  const { user, completeLogin, logout } = useLmsSession();
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passkey, setPasskey] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const setupQuery = trpc.auth.developerSetupStatus.useQuery(undefined, { enabled: !user, retry: false });
  const settingsQuery = trpc.developer.settings.useQuery(undefined, { enabled: user?.role === "developer", retry: false });
  const statusQuery = trpc.developer.integrationStatus.useQuery(undefined, { enabled: user?.role === "developer", retry: false });
  const loginMutation = trpc.auth.developerLogin.useMutation();
  const claimMutation = trpc.auth.claimInitialDeveloper.useMutation();
  const saveMutation = trpc.developer.saveSettings.useMutation({ onSuccess: () => void settingsQuery.refetch() });
  const showToast = (next: ToastState) => {
    setToast(next);
    setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    const values = settingsQuery.data;
    if (!values) return;
    const get = (key: string, fallback = "") => typeof values[key as keyof typeof values] === "string" ? String(values[key as keyof typeof values]) : fallback;
    setForm({ appName: get("brand.app_name"), tagline: get("brand.tagline"), contactEmail: get("brand.contact_email"), contactPhone: get("brand.contact_phone"), whatsapp: get("brand.whatsapp"), themePrimary: get("brand.theme_primary", "#0F172A"), themeAccent: get("brand.theme_accent", "#F2A541"), developerName: get("developer.name"), developerRole: get("developer.role"), developerProjectInfo: get("developer.project_info"), developerContact: get("developer.contact"), developerCopyright: get("developer.copyright") });
  }, [settingsQuery.data]);

  const enter = async () => {
    if (mode === "setup" && name.trim().length < 2) return showToast({ title: "Name required", message: "Enter your full developer name.", tone: "error" });
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return showToast({ title: "Email required", message: "Enter a valid developer email address.", tone: "error" });
    if (password.length < 12) return showToast({ title: "Password too short", message: "Password must be at least 12 characters long.", tone: "error" });
    if (passkey.trim().length === 0) return showToast({ title: "Passkey required", message: "Enter the Developer Passkey to continue.", tone: "error" });
    try {
      const payload = mode === "setup"
        ? await claimMutation.mutateAsync({ fullName: name.trim(), email: email.trim(), password, developerPasskey: passkey })
        : await loginMutation.mutateAsync({ email: email.trim(), password, developerPasskey: passkey });
      await completeLogin(payload);
      router.replace("/dev-portal");
    } catch (error) { showToast({ title: "Check your details", message: friendlyError(error), tone: "error" }); }
  };
  const update = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    try { await saveMutation.mutateAsync(form); showToast({ title: "Settings saved", message: "Branding settings were saved securely.", tone: "success" }); }
    catch (error) { showToast({ title: "Settings not saved", message: friendlyError(error), tone: "error" }); }
  };

  if (user && user.role !== "developer") return <ScreenContainer className="items-center justify-center px-5"><EmptyState icon="lock" title="Developer access required" body="This private portal is available only to a Developer identity verified by the server." /></ScreenContainer>;
  if (!user) {
    const configured = Boolean(setupQuery.data?.configured);
    const canSetup = Boolean(setupQuery.data?.available);
    return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.authContent}><View style={styles.icon}><MaterialIcons name="terminal" size={28} color={COLORS.white} /></View><Text style={styles.eyebrow}>PRIVATE PLATFORM ACCESS</Text><Text style={styles.title}>Developer Portal</Text><Text style={styles.copy}>This route is intentionally separate from Student and Staff login. A Developer identity and server-only Developer Passkey are required.</Text>{!configured ? <View style={styles.warning}><Text style={styles.warningText}>Developer setup is awaiting the server-only Developer Passkey configuration. No fallback credential is enabled.</Text></View> : null}{canSetup ? <View style={styles.switcher}><Pressable onPress={() => setMode("login")} style={[styles.switchButton, mode === "login" && styles.switchButtonActive]}><Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Sign in</Text></Pressable><Pressable onPress={() => setMode("setup")} style={[styles.switchButton, mode === "setup" && styles.switchButtonActive]}><Text style={[styles.switchText, mode === "setup" && styles.switchTextActive]}>First setup</Text></Pressable></View> : null}{mode === "setup" && canSetup ? <Field label="Full name" value={name} onChangeText={setName} /> : null}<Field label="Developer email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" /><Field label="Developer Passkey" value={passkey} onChangeText={setPasskey} secureTextEntry autoCapitalize="none" /><PrimaryButton label={loginMutation.isPending || claimMutation.isPending ? "Verifying…" : mode === "setup" ? "Create Developer account" : "Enter Developer Portal"} icon="lock" disabled={!configured || loginMutation.isPending || claimMutation.isPending} onPress={() => void enter()} /></ScrollView>{toast ? <ToastBanner toast={toast} /> : null}</ScreenContainer>;
  }
  if (settingsQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><View><Text style={styles.eyebrow}>ROOT PLATFORM OPERATOR</Text><Text style={styles.title}>Developer Portal</Text></View><Pressable onPress={() => void logout()} style={styles.signOut}><MaterialIcons name="logout" size={18} color={COLORS.indigo} /><Text style={styles.signOutText}>Sign out</Text></Pressable></View><View style={styles.warning}><Text style={styles.warningText}>Provider secrets are never entered, stored, or displayed in this app screen. Configure keys through secure server environment controls only.</Text></View><Text style={styles.section}>Branding & application</Text><Field label="App name" value={form.appName} onChangeText={(value) => update("appName", value)} /><Field label="Tagline" value={form.tagline} onChangeText={(value) => update("tagline", value)} /><Field label="Official email" value={form.contactEmail} onChangeText={(value) => update("contactEmail", value)} autoCapitalize="none" keyboardType="email-address" /><Field label="Official phone" value={form.contactPhone} onChangeText={(value) => update("contactPhone", value)} /><Field label="WhatsApp" value={form.whatsapp} onChangeText={(value) => update("whatsapp", value)} /><Field label="Primary theme colour (#RRGGBB)" value={form.themePrimary} onChangeText={(value) => update("themePrimary", value)} autoCapitalize="none" /><Field label="Accent theme colour (#RRGGBB)" value={form.themeAccent} onChangeText={(value) => update("themeAccent", value)} autoCapitalize="none" /><Text style={styles.section}>Developer details</Text><Field label="Developer name" value={form.developerName} onChangeText={(value) => update("developerName", value)} /><Field label="Developer role" value={form.developerRole} onChangeText={(value) => update("developerRole", value)} /><Field label="Project information" value={form.developerProjectInfo} onChangeText={(value) => update("developerProjectInfo", value)} multiline /><Field label="Developer contact" value={form.developerContact} onChangeText={(value) => update("developerContact", value)} /><Field label="Copyright" value={form.developerCopyright} onChangeText={(value) => update("developerCopyright", value)} /><Text style={styles.section}>API configuration status</Text><View style={styles.statusCard}><StatusRow label="Developer Passkey" ready={Boolean(statusQuery.data?.developerPortalPasskeyConfigured)} /><StatusRow label="Gemini AI" ready={Boolean(statusQuery.data?.geminiConfigured)} /><StatusRow label="Razorpay / UPI" ready={Boolean(statusQuery.data?.razorpayConfigured)} /></View><PrimaryButton label={saveMutation.isPending ? "Saving…" : "Save Developer settings"} icon="save" disabled={saveMutation.isPending} onPress={() => void save()} /></ScrollView>{toast ? <ToastBanner toast={toast} /> : null}</ScreenContainer>;
}

function ToastBanner({ toast }: { toast: ToastState }) { return <View accessibilityRole="alert" style={[styles.toast, toast.tone === "error" ? styles.toastError : styles.toastSuccess]}><MaterialIcons name={toast.tone === "error" ? "error-outline" : "check-circle-outline"} size={20} color={toast.tone === "error" ? "#B42318" : "#137A4B"} /><View style={styles.toastCopy}><Text style={styles.toastTitle}>{toast.title}</Text><Text style={styles.toastMessage}>{toast.message}</Text></View></View>; }

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; autoCapitalize?: "none" | "sentences"; keyboardType?: "default" | "email-address"; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput {...props} placeholder={props.label} placeholderTextColor="#98A2B3" style={[styles.input, props.multiline && styles.area]} /></View>; }
function StatusRow({ label, ready }: { label: string; ready: boolean }) { return <View style={styles.statusRow}><Text style={styles.statusLabel}>{label}</Text><Tag label={ready ? "CONFIGURED" : "NOT CONFIGURED"} tone={ready ? "green" : "saffron"} /></View>; }

const styles = StyleSheet.create({ authContent: { flexGrow: 1, justifyContent: "center", paddingVertical: 32, gap: 11 }, content: { paddingTop: 13, paddingBottom: 38, gap: 10 }, icon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigo }, eyebrow: { color: COLORS.earth, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: COLORS.ink, fontSize: 25, fontWeight: "900" }, copy: { color: COLORS.muted, fontSize: 13, lineHeight: 20 }, warning: { borderRadius: 14, backgroundColor: "#FFF1DE", padding: 12 }, warningText: { color: COLORS.earth, fontSize: 12, fontWeight: "700", lineHeight: 18 }, switcher: { flexDirection: "row", gap: 8, padding: 4, borderRadius: 14, backgroundColor: COLORS.indigoSoft }, switchButton: { flex: 1, minHeight: 40, justifyContent: "center", alignItems: "center", borderRadius: 11 }, switchButtonActive: { backgroundColor: COLORS.indigo }, switchText: { color: COLORS.indigo, fontWeight: "900", fontSize: 12 }, switchTextActive: { color: COLORS.white }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, signOut: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: 11, backgroundColor: COLORS.indigoSoft }, signOutText: { color: COLORS.indigo, fontSize: 12, fontWeight: "900" }, section: { color: COLORS.ink, fontSize: 17, fontWeight: "900", marginTop: 7 }, field: { gap: 5 }, label: { color: COLORS.ink, fontSize: 12, fontWeight: "800" }, input: { minHeight: 51, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 12, color: COLORS.ink, fontSize: 14 }, area: { minHeight: 82, textAlignVertical: "top", paddingTop: 12 }, statusCard: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 12, gap: 9 }, statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, statusLabel: { color: COLORS.ink, fontSize: 13, fontWeight: "800" }, toast: { position: "absolute", left: 20, right: 20, bottom: 22, borderRadius: 15, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9, shadowColor: "#0F172A", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 }, toastError: { backgroundColor: "#FFF4F2", borderColor: "#F4B4AC" }, toastSuccess: { backgroundColor: "#EFFAF4", borderColor: "#A9DEC0" }, toastCopy: { flex: 1, gap: 2 }, toastTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "900" }, toastMessage: { color: COLORS.muted, fontSize: 12, lineHeight: 17 } });
