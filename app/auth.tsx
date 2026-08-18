import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function AuthScreen() {
  const router = useRouter();
  const { completeLogin } = useLmsSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const isBusy = loginMutation.isPending || registerMutation.isPending;

  const submit = async () => {
    setError(null);
    try {
      let signedInRole: "student" | "teacher" | "admin" | "super_admin" = "student";
      if (mode === "login") {
        const payload = await loginMutation.mutateAsync({ identity, password });
        await completeLogin(payload);
        signedInRole = payload.user.role;
      } else {
        const cleanIdentity = identity.trim();
        const isEmail = cleanIdentity.includes("@");
        const payload = await registerMutation.mutateAsync({ fullName, email: isEmail ? cleanIdentity : "", mobile: isEmail ? "" : cleanIdentity, password });
        await completeLogin(payload);
      }
      router.replace(signedInRole === "student" ? "/" : "/operations");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not complete that request. Please try again.");
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable>
          <View style={styles.brandMark}><MaterialIcons name="architecture" size={33} color={COLORS.saffron} /></View>
          <Text style={styles.eyebrow}>AMIN KA MASTER</Text>
          <Text style={styles.title}>{mode === "login" ? "Welcome back" : "Create your learner profile"}</Text>
          <Text style={styles.subtitle}>{mode === "login" ? "Continue your field-ready learning journey." : "Use an email address or mobile number. Your progress will be tied securely to this profile."}</Text>
          <View style={styles.switcher}><Pressable onPress={() => { setMode("login"); setError(null); }} style={[styles.switch, mode === "login" && styles.switchActive]}><Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Sign in</Text></Pressable><Pressable onPress={() => { setMode("register"); setError(null); }} style={[styles.switch, mode === "register" && styles.switchActive]}><Text style={[styles.switchText, mode === "register" && styles.switchTextActive]}>Create account</Text></Pressable></View>
          <View style={styles.form}>
            {mode === "register" ? <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" icon="person-outline" autoCapitalize="words" /> : null}
            <Field label="Email or mobile number" value={identity} onChangeText={setIdentity} placeholder="name@example.com or +91 90000 00000" icon="alternate-email" autoCapitalize="none" keyboardType="email-address" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} icon="lock-outline" secureTextEntry />
            {error ? <View style={styles.errorBox}><MaterialIcons name="error-outline" size={18} color={COLORS.red} /><Text style={styles.errorText}>{error}</Text></View> : null}
            <Pressable accessibilityRole="button" disabled={isBusy} onPress={submit} style={({ pressed }) => [styles.submit, (pressed || isBusy) && styles.pressed, isBusy && styles.disabled]}><Text style={styles.submitText}>{isBusy ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create secure account"}</Text><MaterialIcons name="arrow-forward" size={19} color={COLORS.white} /></Pressable>
          </View>
          <Text style={styles.footnote}>{mode === "register" ? "By creating an account, you agree to the platform terms and privacy policy that an administrator publishes." : "Password recovery and verification channels are prepared as future operator-configured features."}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function Field({ label, icon, ...inputProps }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; value: string; onChangeText: (text: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address"; autoCapitalize?: "none" | "words" }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputShell}><MaterialIcons name={icon} size={20} color={COLORS.muted} /><TextInput {...inputProps} style={styles.input} placeholderTextColor="#98A2B3" returnKeyType="done" /></View></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 10, paddingBottom: 32 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center", marginBottom: 32 },
  brandMark: { width: 62, height: 62, borderRadius: 20, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  eyebrow: { fontSize: 10, letterSpacing: 1.3, fontWeight: "900", color: COLORS.earth },
  title: { color: COLORS.ink, fontSize: 30, lineHeight: 37, fontWeight: "800", marginTop: 7 },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 350 },
  switcher: { marginTop: 27, padding: 4, backgroundColor: "#EEF1F5", borderRadius: 14, flexDirection: "row" },
  switch: { flex: 1, minHeight: 39, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  switchActive: { backgroundColor: COLORS.white, shadowColor: "#14213D", shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  switchText: { color: COLORS.muted, fontSize: 13, fontWeight: "800" },
  switchTextActive: { color: COLORS.indigo },
  form: { marginTop: 22, gap: 15 },
  field: { gap: 7 },
  label: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  inputShell: { minHeight: 53, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, minHeight: 52, color: COLORS.ink, fontSize: 15 },
  errorBox: { flexDirection: "row", gap: 8, borderRadius: 12, padding: 12, backgroundColor: "#FDECEA", alignItems: "flex-start" },
  errorText: { color: COLORS.red, fontSize: 13, lineHeight: 18, flex: 1 },
  submit: { minHeight: 52, backgroundColor: COLORS.indigo, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 5 },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  footnote: { marginTop: 19, color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
