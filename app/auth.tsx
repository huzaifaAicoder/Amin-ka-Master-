import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type Portal = "student" | "staff";
type Mode = "choice" | "login" | "register";

export default function AuthScreen() {
  const router = useRouter();
  const { completeLogin } = useLmsSession();
  const [portal, setPortal] = useState<Portal>("student");
  const [mode, setMode] = useState<Mode>("choice");
  const [fullName, setFullName] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const isBusy = loginMutation.isPending || registerMutation.isPending;

  const start = (nextPortal: Portal, nextMode: "login" | "register" = "login") => { setPortal(nextPortal); setMode(nextMode); setError(null); setPassword(""); };
  const clearError = () => setError(null);
  const messageForFailure = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "";
    if (message.includes("Staff / Admin portal")) return "This is a staff account. Please choose Staff / Admin Login.";
    if (message.includes("not authorized for the Staff")) return "This account is not authorized for the Staff / Admin portal.";
    if (message.toLowerCase().includes("already") || message.toLowerCase().includes("exists")) return "An account already exists with these details. Please sign in instead.";
    if (mode === "login") return "The email/mobile number or password is incorrect. Please check both and try again.";
    return "We could not create your student account. Review the details and try again.";
  };
  const submit = async () => {
    setError(null);
    if (!identity.trim()) return setError("Enter your email address or mobile number.");
    if (!password) return setError("Enter your password to continue.");
    if (mode === "register" && fullName.trim().length < 2) return setError("Enter your full name to create your learner profile.");
    try {
      if (mode === "register") {
        const cleanIdentity = identity.trim(); const isEmail = cleanIdentity.includes("@");
        const payload = await registerMutation.mutateAsync({ fullName, email: isEmail ? cleanIdentity : "", mobile: isEmail ? "" : cleanIdentity, password });
        await completeLogin(payload); router.replace("/"); return;
      }
      const payload = await loginMutation.mutateAsync({ identity, password, portal });
      await completeLogin(payload);
      router.replace(payload.user.role === "student" ? "/" : "/operations");
    } catch (cause) { setError(messageForFailure(cause)); }
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    {mode !== "choice" ? <Pressable onPress={() => { setMode("choice"); setError(null); }} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable> : <View style={styles.topSpace} />}
    <View style={styles.brandMark}><MaterialIcons name="architecture" size={33} color={COLORS.saffron} /></View><Text style={styles.eyebrow}>AMIN KA MASTER</Text>
    {mode === "choice" ? <PortalChoice onStudent={() => start("student")} onStaff={() => start("staff")} /> : <><Text style={styles.title}>{mode === "register" ? "Create your student profile" : portal === "student" ? "Student login" : "Staff / Admin login"}</Text><Text style={styles.subtitle}>{mode === "register" ? "Public sign-up creates a student account only." : portal === "student" ? "Continue your field-ready learning journey." : "Use your individual staff credentials. Your server-verified role and permissions determine the portal you receive."}</Text>
      {portal === "student" ? <View style={styles.switcher}><Pressable disabled={isBusy} onPress={() => { setMode("login"); clearError(); }} style={[styles.switch, mode === "login" && styles.switchActive]}><Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Sign in</Text></Pressable><Pressable disabled={isBusy} onPress={() => { setMode("register"); clearError(); }} style={[styles.switch, mode === "register" && styles.switchActive]}><Text style={[styles.switchText, mode === "register" && styles.switchTextActive]}>Create account</Text></Pressable></View> : <View style={styles.portalTag}><MaterialIcons name="verified-user" size={16} color={COLORS.indigo} /><Text style={styles.portalTagText}>SERVER-VERIFIED STAFF ACCESS</Text></View>}
      <View style={styles.form}>{mode === "register" ? <Field label="Full name" value={fullName} onChangeText={(value) => { setFullName(value); clearError(); }} placeholder="Your full name" icon="person-outline" autoCapitalize="words" editable={!isBusy} /> : null}<Field label="Email or mobile number" value={identity} onChangeText={(value) => { setIdentity(value); clearError(); }} placeholder="name@example.com or +91 90000 00000" icon="alternate-email" autoCapitalize="none" keyboardType="email-address" editable={!isBusy} /><Field label="Password" value={password} onChangeText={(value) => { setPassword(value); clearError(); }} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} icon="lock-outline" secureTextEntry editable={!isBusy} />{error ? <View accessibilityLiveRegion="assertive" style={styles.errorBox}><MaterialIcons name="error-outline" size={18} color={COLORS.red} /><View style={styles.errorCopy}><Text style={styles.errorTitle}>{mode === "login" ? "Login unsuccessful" : "Account not created"}</Text><Text style={styles.errorText}>{error}</Text></View></View> : null}<Pressable accessibilityRole="button" accessibilityState={{ busy: isBusy, disabled: isBusy }} disabled={isBusy} onPress={submit} style={({ pressed }) => [styles.submit, (pressed || isBusy) && styles.pressed, isBusy && styles.disabled]}>{isBusy ? <><ActivityIndicator size="small" color={COLORS.white} /><Text style={styles.submitText}>{mode === "register" ? "Creating your account…" : "Signing you in…"}</Text></> : <><Text style={styles.submitText}>{mode === "register" ? "Create student account" : portal === "student" ? "Login as student" : "Login to staff portal"}</Text><MaterialIcons name="arrow-forward" size={19} color={COLORS.white} /></>}</Pressable></View>
      <Text style={styles.footnote}>{portal === "staff" ? "Selecting this portal never grants a role. The server verifies your active account, role and permissions after login." : mode === "register" ? "Staff accounts are created by authorized administrators, not public registration." : "Password recovery and verification channels are prepared as future operator-configured features."}</Text></>}
  </ScrollView></KeyboardAvoidingView></ScreenContainer>;
}

function PortalChoice({ onStudent, onStaff }: { onStudent: () => void; onStaff: () => void }) { return <View><Text style={styles.title}>Welcome back</Text><Text style={styles.subtitle}>Learn. Measure. Master.</Text><View style={styles.choiceList}><Pressable onPress={onStudent} style={({ pressed }) => [styles.portalChoice, pressed && styles.pressed]}><Icon icon="school" color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>Student Login</Text><Text style={styles.choiceBody}>Access your courses, tests, notes and learning progress.</Text></View><MaterialIcons name="arrow-forward" size={22} color={COLORS.indigo} /></Pressable><Pressable onPress={onStaff} style={({ pressed }) => [styles.portalChoice, styles.staffChoice, pressed && styles.pressed]}><Icon icon="admin-panel-settings" color={COLORS.saffron} background="rgba(255,255,255,0.12)" /><View style={styles.choiceCopy}><Text style={[styles.choiceTitle, { color: COLORS.white }]}>Staff / Admin Login</Text><Text style={[styles.choiceBody, { color: "#D6DFF2" }]}>Teacher, Admin and Super Admin access with individual credentials.</Text></View><MaterialIcons name="arrow-forward" size={22} color={COLORS.white} /></Pressable></View></View>; }
function Icon({ icon, color, background }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; color: string; background: string }) { return <View style={[styles.choiceIcon, { backgroundColor: background }]}><MaterialIcons name={icon} size={24} color={color} /></View>; }
function Field({ label, icon, ...inputProps }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; value: string; onChangeText: (text: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address"; autoCapitalize?: "none" | "words"; editable?: boolean }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputShell}><MaterialIcons name={icon} size={20} color={COLORS.muted} /><TextInput {...inputProps} style={styles.input} placeholderTextColor="#98A2B3" returnKeyType="done" /></View></View>; }
const styles = StyleSheet.create({ flex:{flex:1},content:{flexGrow:1,paddingTop:10,paddingBottom:32},topSpace:{height:74},back:{width:42,height:42,borderRadius:14,backgroundColor:COLORS.indigoSoft,alignItems:"center",justifyContent:"center",marginBottom:32},brandMark:{width:62,height:62,borderRadius:20,backgroundColor:COLORS.indigo,alignItems:"center",justifyContent:"center",marginBottom:18},eyebrow:{fontSize:10,letterSpacing:1.3,fontWeight:"900",color:COLORS.earth},title:{color:COLORS.ink,fontSize:30,lineHeight:37,fontWeight:"800",marginTop:7},subtitle:{color:COLORS.muted,fontSize:14,lineHeight:21,marginTop:10,maxWidth:360},choiceList:{marginTop:28,gap:13},portalChoice:{minHeight:116,borderRadius:20,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.white,padding:16,flexDirection:"row",alignItems:"center",gap:12},staffChoice:{backgroundColor:COLORS.indigo,borderColor:COLORS.indigo},choiceIcon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center"},choiceCopy:{flex:1,gap:3},choiceTitle:{color:COLORS.ink,fontSize:17,fontWeight:"900"},choiceBody:{color:COLORS.muted,fontSize:12,lineHeight:17},switcher:{marginTop:27,padding:4,backgroundColor:"#EEF1F5",borderRadius:14,flexDirection:"row"},switch:{flex:1,minHeight:39,alignItems:"center",justifyContent:"center",borderRadius:11},switchActive:{backgroundColor:COLORS.white,shadowColor:"#14213D",shadowOpacity:0.08,shadowRadius:5,elevation:2},switchText:{color:COLORS.muted,fontSize:13,fontWeight:"800"},switchTextActive:{color:COLORS.indigo},portalTag:{marginTop:22,minHeight:42,borderRadius:12,backgroundColor:COLORS.indigoSoft,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6},portalTagText:{color:COLORS.indigo,fontSize:10,fontWeight:"900",letterSpacing:0.8},form:{marginTop:22,gap:15},field:{gap:7},label:{color:COLORS.ink,fontSize:13,fontWeight:"800"},inputShell:{minHeight:53,backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:15,paddingHorizontal:15,flexDirection:"row",alignItems:"center",gap:10},input:{flex:1,minHeight:52,color:COLORS.ink,fontSize:15},errorBox:{flexDirection:"row",gap:8,borderRadius:12,padding:12,backgroundColor:"#FDECEA",alignItems:"flex-start",borderWidth:1,borderColor:"#F9C6C1"},errorCopy:{flex:1,gap:2},errorTitle:{color:COLORS.red,fontSize:13,fontWeight:"900"},errorText:{color:COLORS.red,fontSize:13,lineHeight:18},submit:{minHeight:52,backgroundColor:COLORS.indigo,borderRadius:15,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:9,marginTop:5},submitText:{color:COLORS.white,fontSize:15,fontWeight:"900"},disabled:{opacity:0.55},footnote:{marginTop:19,color:COLORS.muted,fontSize:11,lineHeight:16,textAlign:"center"},pressed:{opacity:0.74,transform:[{scale:0.985}]}});
