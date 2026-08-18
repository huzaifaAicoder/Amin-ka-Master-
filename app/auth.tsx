import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type Portal = "student" | "staff";
type Mode = "choice" | "login" | "register" | "owner_setup" | "forgot" | "otp" | "reset";

export default function AuthScreen() {
  const router = useRouter();
  const { completeLogin } = useLmsSession();
  const [portal, setPortal] = useState<Portal>("student");
  const [mode, setMode] = useState<Mode>("choice");
  const [fullName, setFullName] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [staffPasskey, setStaffPasskey] = useState("");
  const [staffPasskeyConfirmation, setStaffPasskeyConfirmation] = useState("");
  const [ownerSetupCode, setOwnerSetupCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();
  const ownerSetupQuery = trpc.auth.ownerSetupStatus.useQuery(undefined, { retry: false });
  const claimInitialOwnerMutation = trpc.auth.claimInitialOwner.useMutation({ onSuccess: () => void ownerSetupQuery.refetch() });
  const isBusy = loginMutation.isPending || registerMutation.isPending || requestResetMutation.isPending || verifyOtpMutation.isPending || resetPasswordMutation.isPending || claimInitialOwnerMutation.isPending;

  const clearFeedback = () => { setError(null); setNotice(null); };
  const start = (nextPortal: Portal, nextMode: "login" | "register" = "login") => {
    setPortal(nextPortal); setMode(nextMode); setPassword(""); setStaffPasskey(""); setStaffPasskeyConfirmation(""); setOwnerSetupCode(""); setConfirmPassword(""); setOtpCode(""); setResetToken(""); clearFeedback();
  };
  const startOwnerSetup = () => { setPortal("staff"); setMode("owner_setup"); setFullName(""); setIdentity(""); setPassword(""); setConfirmPassword(""); setStaffPasskey(""); setStaffPasskeyConfirmation(""); setOwnerSetupCode(""); clearFeedback(); };
  const goBack = () => {
    if (mode === "owner_setup") setMode("choice");
    else if (mode === "forgot") setMode("login");
    else if (mode === "otp") setMode("forgot");
    else if (mode === "reset") setMode("login");
    else setMode("choice");
    clearFeedback();
  };
  const messageForFailure = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "";
    if (message.includes("Staff / Admin portal")) return "This is a staff account. Please choose Staff / Admin Login.";
    if (message.includes("not authorized for the Staff")) return "This account is not authorized for the Staff / Admin portal.";
    if (message.includes("Staff Passkey")) return "Your Staff Passkey is required and must be current. Contact your Super Admin if it was recently rotated.";
    if (message.toLowerCase().includes("already") || message.toLowerCase().includes("exists")) return "An account already exists with these details. Please sign in instead.";
    if (mode === "login") return "The email/mobile number or password is incorrect. Please check both and try again.";
    if (mode === "otp") return message || "We could not verify that recovery code. Try again or request a new one.";
    if (mode === "reset") return message || "We could not update your password. Request a new recovery code and try again.";
    if (mode === "forgot") return "We could not start account recovery. Check the details and try again.";
    return mode === "owner_setup" ? "Owner setup could not be completed. Check the private setup code and account details." : "We could not create your student account. Review the details and try again.";
  };

  const submitLoginOrRegistration = async () => {
    clearFeedback();
    if (!identity.trim()) return setError("Enter your email address or mobile number.");
    if (!password) return setError("Enter your password to continue.");
    if (mode === "login" && portal === "staff" && !staffPasskey) return setError("Enter the Staff Passkey to continue to the protected staff portal.");
    if (mode === "register" && fullName.trim().length < 2) return setError("Enter your full name to create your learner profile.");
    try {
      if (mode === "register") {
        const cleanIdentity = identity.trim();
        const isEmail = cleanIdentity.includes("@");
        const payload = await registerMutation.mutateAsync({ fullName, email: isEmail ? cleanIdentity : "", mobile: isEmail ? "" : cleanIdentity, password });
        await completeLogin(payload); router.replace("/"); return;
      }
      const payload = await loginMutation.mutateAsync({ identity, password, portal, staffPasskey: portal === "staff" ? staffPasskey : undefined });
      await completeLogin(payload);
      router.replace(payload.user.role === "student" ? "/" : "/operations");
    } catch (cause) { setError(messageForFailure(cause)); }
  };

  const claimInitialOwner = async () => {
    clearFeedback();
    const cleanIdentity = identity.trim();
    if (fullName.trim().length < 2) return setError("Enter the owner’s full name.");
    if (!cleanIdentity) return setError("Enter the owner’s email address or mobile number.");
    if (password.length < 12) return setError("Use a password of at least 12 characters.");
    if (password !== confirmPassword) return setError("The account password confirmation does not match.");
    if (staffPasskey.length < 12) return setError("Use a Staff Passkey of at least 12 characters.");
    if (staffPasskey !== staffPasskeyConfirmation) return setError("The Staff Passkey confirmation does not match.");
    if (!ownerSetupCode) return setError("Enter the private Owner Setup Code.");
    try {
      const isEmail = cleanIdentity.includes("@");
      const payload = await claimInitialOwnerMutation.mutateAsync({ fullName: fullName.trim(), email: isEmail ? cleanIdentity : "", mobile: isEmail ? "" : cleanIdentity, password, staffPasskey, staffPasskeyConfirmation, ownerSetupCode });
      await completeLogin(payload);
      router.replace("/operations");
    } catch (cause) { setError(messageForFailure(cause)); }
  };

  const requestReset = async () => {
    clearFeedback();
    if (!identity.trim()) return setError("Enter the email address or mobile number registered with your account.");
    try {
      const response = await requestResetMutation.mutateAsync({ identity });
      if (response.delivery === "unconfigured") {
        setNotice("Recovery delivery is not configured yet. Please contact the Amin Ka Master team for help.");
        return;
      }
      setMode("otp");
      setNotice("If this account is eligible, a six-digit code has been sent. It expires in 10 minutes.");
    } catch (cause) { setError(messageForFailure(cause)); }
  };

  const verifyCode = async () => {
    clearFeedback();
    if (!/^\d{6}$/.test(otpCode)) return setError("Enter the six-digit recovery code.");
    try {
      const response = await verifyOtpMutation.mutateAsync({ identity, code: otpCode });
      setResetToken(response.resetToken);
      setPassword(""); setConfirmPassword(""); setMode("reset");
      setNotice("Identity confirmed. Choose a new password for your account.");
    } catch (cause) { setError(messageForFailure(cause)); }
  };

  const resetPassword = async () => {
    clearFeedback();
    if (password.length < 8) return setError("Use at least 8 characters for your new password.");
    if (password !== confirmPassword) return setError("Your new password and confirmation do not match.");
    try {
      await resetPasswordMutation.mutateAsync({ resetToken, password });
      setPassword(""); setConfirmPassword(""); setOtpCode(""); setResetToken(""); setMode("login");
      setNotice("Your password has been updated. For your security, all previous sessions were signed out. Please sign in again.");
    } catch (cause) { setError(messageForFailure(cause)); }
  };

  const title = mode === "owner_setup" ? "First owner setup" : mode === "register" ? "Create your student profile" : mode === "forgot" ? "Recover your account" : mode === "otp" ? "Verify recovery code" : mode === "reset" ? "Choose a new password" : portal === "student" ? "Student login" : "Staff / Admin login";
  const subtitle = mode === "owner_setup" ? "Create the first usable Super Admin account and initial Staff Passkey. This is available only once with the private Owner Setup Code." : mode === "register" ? "Public sign-up creates a student account only." : mode === "forgot" ? "Enter the email address or Indian mobile number linked to your account." : mode === "otp" ? "Enter the six-digit code from your email or mobile message." : mode === "reset" ? "This recovery session is short-lived and can be used once." : portal === "student" ? "Continue your field-ready learning journey." : "Use your individual staff credentials. Your server-verified role and permissions determine the portal you receive.";
  const feedback = <>{notice ? <View accessibilityLiveRegion="polite" style={styles.noticeBox}><MaterialIcons name="info-outline" size={18} color={COLORS.indigo} /><Text style={styles.noticeText}>{notice}</Text></View> : null}{error ? <View accessibilityLiveRegion="assertive" style={styles.errorBox}><MaterialIcons name="error-outline" size={18} color={COLORS.red} /><View style={styles.errorCopy}><Text style={styles.errorTitle}>{mode === "login" ? "Login unsuccessful" : mode === "register" ? "Account not created" : mode === "owner_setup" ? "Owner setup not completed" : "Action needed"}</Text><Text style={styles.errorText}>{error}</Text></View></View> : null}</>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    {mode !== "choice" ? <Pressable onPress={goBack} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable> : <View style={styles.topSpace} />}
    <View style={styles.brandMark}><MaterialIcons name="architecture" size={33} color={COLORS.saffron} /></View><Text style={styles.eyebrow}>AMIN KA MASTER</Text>
    {mode === "choice" ? <PortalChoice onStudent={() => start("student")} onStaff={() => start("staff")} showOwnerSetup onOwnerSetup={startOwnerSetup} /> : <><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>
      {(mode === "login" || mode === "register") && (portal === "student" ? <View style={styles.switcher}><Pressable disabled={isBusy} onPress={() => { setMode("login"); clearFeedback(); }} style={[styles.switch, mode === "login" && styles.switchActive]}><Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Sign in</Text></Pressable><Pressable disabled={isBusy} onPress={() => { setMode("register"); clearFeedback(); }} style={[styles.switch, mode === "register" && styles.switchActive]}><Text style={[styles.switchText, mode === "register" && styles.switchTextActive]}>Create account</Text></Pressable></View> : <View style={styles.portalTag}><MaterialIcons name="verified-user" size={16} color={COLORS.indigo} /><Text style={styles.portalTagText}>SERVER-VERIFIED STAFF ACCESS</Text></View>)}
      <View style={styles.form}>
        {(mode === "register" || mode === "owner_setup") ? <Field label="Full name" value={fullName} onChangeText={(value) => { setFullName(value); clearFeedback(); }} placeholder="Your full name" icon="person-outline" autoCapitalize="words" editable={!isBusy} /> : null}
        {(mode === "login" || mode === "register" || mode === "owner_setup" || mode === "forgot") ? <Field label={mode === "forgot" ? "Registered email or mobile" : "Email or mobile number"} value={identity} onChangeText={(value) => { setIdentity(value); clearFeedback(); }} placeholder="name@example.com or +91 90000 00000" icon="alternate-email" autoCapitalize="none" keyboardType="email-address" editable={!isBusy} /> : null}
        {(mode === "login" || mode === "register" || mode === "owner_setup") ? <Field label={mode === "owner_setup" ? "Owner account password" : "Password"} value={password} onChangeText={(value) => { setPassword(value); clearFeedback(); }} placeholder={mode === "owner_setup" ? "At least 12 characters" : mode === "register" ? "At least 8 characters" : "Your password"} icon="lock-outline" secureTextEntry editable={!isBusy} /> : null}
        {mode === "owner_setup" ? <><Field label="Confirm owner account password" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); clearFeedback(); }} placeholder="Repeat the owner password" icon="lock-outline" secureTextEntry editable={!isBusy} /><Field label="Create Staff Passkey" value={staffPasskey} onChangeText={(value) => { setStaffPasskey(value); clearFeedback(); }} placeholder="At least 12 characters" icon="key" secureTextEntry editable={!isBusy} /><Field label="Confirm Staff Passkey" value={staffPasskeyConfirmation} onChangeText={(value) => { setStaffPasskeyConfirmation(value); clearFeedback(); }} placeholder="Repeat the Staff Passkey" icon="key" secureTextEntry editable={!isBusy} /><Field label="Private Owner Setup Code" value={ownerSetupCode} onChangeText={(value) => { setOwnerSetupCode(value); clearFeedback(); }} placeholder="Code configured in secure settings" icon="security" secureTextEntry editable={!isBusy} /></> : null}
        {mode === "login" && portal === "staff" ? <Field label="Staff Passkey" value={staffPasskey} onChangeText={(value) => { setStaffPasskey(value); clearFeedback(); }} placeholder="Current staff access key" icon="key" secureTextEntry editable={!isBusy} /> : null}
        {mode === "otp" ? <Field label="Six-digit recovery code" value={otpCode} onChangeText={(value) => { setOtpCode(value.replace(/\D/g, "").slice(0, 6)); clearFeedback(); }} placeholder="000000" icon="security" keyboardType="numeric" editable={!isBusy} /> : null}
        {mode === "reset" ? <><Field label="New password" value={password} onChangeText={(value) => { setPassword(value); clearFeedback(); }} placeholder="At least 8 characters" icon="lock-reset" secureTextEntry editable={!isBusy} /><Field label="Confirm new password" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); clearFeedback(); }} placeholder="Repeat your new password" icon="lock-outline" secureTextEntry editable={!isBusy} /></> : null}
        {feedback}
        {mode === "login" ? <Pressable disabled={isBusy} onPress={() => { setMode("forgot"); setPassword(""); clearFeedback(); }} style={({ pressed }) => [styles.forgotLink, pressed && styles.pressed]}><Text style={styles.forgotText}>Forgot password?</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ busy: isBusy, disabled: isBusy }} disabled={isBusy} onPress={mode === "owner_setup" ? claimInitialOwner : mode === "forgot" ? requestReset : mode === "otp" ? verifyCode : mode === "reset" ? resetPassword : submitLoginOrRegistration} style={({ pressed }) => [styles.submit, (pressed || isBusy) && styles.pressed, isBusy && styles.disabled]}>{isBusy ? <><ActivityIndicator size="small" color={COLORS.white} /><Text style={styles.submitText}>{mode === "owner_setup" ? "Completing secure setup…" : mode === "forgot" ? "Sending recovery code…" : mode === "otp" ? "Verifying code…" : mode === "reset" ? "Updating password…" : mode === "register" ? "Creating your account…" : "Signing you in…"}</Text></> : <><Text style={styles.submitText}>{mode === "owner_setup" ? "Create Super Admin account" : mode === "forgot" ? "Send recovery code" : mode === "otp" ? "Verify code" : mode === "reset" ? "Update password" : mode === "register" ? "Create student account" : portal === "student" ? "Login as student" : "Login to staff portal"}</Text><MaterialIcons name="arrow-forward" size={19} color={COLORS.white} /></>}</Pressable>
        {mode === "owner_setup" ? <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => start("staff")} style={({ pressed }) => [styles.accountPath, pressed && styles.pressed]}><MaterialIcons name="login" size={18} color={COLORS.indigo} /><View style={styles.accountPathCopy}><Text style={styles.accountPathTitle}>Already have an owner or staff account?</Text><Text style={styles.accountPathText}>Login to the Staff / Admin portal</Text></View><MaterialIcons name="arrow-forward" size={19} color={COLORS.indigo} /></Pressable> : null}
        {mode === "login" && portal === "staff" ? <Pressable accessibilityRole="button" disabled={isBusy} onPress={startOwnerSetup} style={({ pressed }) => [styles.accountPath, pressed && styles.pressed]}><MaterialIcons name="person-add-alt-1" size={18} color={COLORS.earth} /><View style={styles.accountPathCopy}><Text style={styles.accountPathTitle}>Need to create the first owner account?</Text><Text style={styles.accountPathText}>Open First Owner Setup with the private code</Text></View><MaterialIcons name="arrow-forward" size={19} color={COLORS.earth} /></Pressable> : null}
        {mode === "login" && portal === "staff" ? <Text style={styles.staffRequestHint}>Teacher and Admin accounts are created by a Super Admin in Control Center → People after owner setup is complete.</Text> : null}
        {mode === "otp" ? <Pressable disabled={isBusy} onPress={requestReset} style={({ pressed }) => [styles.resendLink, pressed && styles.pressed]}><Text style={styles.forgotText}>Resend recovery code</Text></Pressable> : null}
      </View>
      <Text style={styles.footnote}>{mode === "owner_setup" ? "This one-time flow is for the owner only. It establishes the Super Admin account and Staff Passkey; it does not open public staff registration." : mode === "forgot" || mode === "otp" || mode === "reset" ? "Recovery codes expire in 10 minutes, can only be used once, and are protected against repeated guessing." : portal === "staff" ? "Selecting this portal never grants a role. The server verifies your active account, Staff Passkey, role and permissions after login." : mode === "register" ? "Staff accounts are created by authorized administrators, not public registration." : "Use password recovery if you cannot sign in."}</Text></>}
  </ScrollView></KeyboardAvoidingView></ScreenContainer>;
}

function PortalChoice({ onStudent, onStaff, showOwnerSetup, onOwnerSetup }: { onStudent: () => void; onStaff: () => void; showOwnerSetup: boolean; onOwnerSetup: () => void }) { return <View><Text style={styles.title}>Welcome back</Text><Text style={styles.subtitle}>Learn. Measure. Master.</Text><View style={styles.choiceList}><Pressable onPress={onStudent} style={({ pressed }) => [styles.portalChoice, pressed && styles.pressed]}><Icon icon="school" color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>Student Login</Text><Text style={styles.choiceBody}>Access your courses, tests, notes and learning progress.</Text></View><MaterialIcons name="arrow-forward" size={22} color={COLORS.indigo} /></Pressable><Pressable onPress={onStaff} style={({ pressed }) => [styles.portalChoice, styles.staffChoice, pressed && styles.pressed]}><Icon icon="admin-panel-settings" color={COLORS.saffron} background="rgba(255,255,255,0.12)" /><View style={styles.choiceCopy}><Text style={[styles.choiceTitle, { color: COLORS.white }]}>Staff / Admin Login</Text><Text style={[styles.choiceBody, { color: "#D6DFF2" }]}>Teacher, Admin and Super Admin access with individual credentials.</Text></View><MaterialIcons name="arrow-forward" size={22} color={COLORS.white} /></Pressable>{showOwnerSetup ? <Pressable onPress={onOwnerSetup} style={({ pressed }) => [styles.ownerChoice, pressed && styles.pressed]}><Icon icon="verified-user" color={COLORS.earth} background="#FFF1DE" /><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>First owner setup</Text><Text style={styles.choiceBody}>One-time Super Admin setup using your private Owner Setup Code.</Text></View><MaterialIcons name="arrow-forward" size={22} color={COLORS.earth} /></Pressable> : null}</View></View>; }
function Icon({ icon, color, background }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; color: string; background: string }) { return <View style={[styles.choiceIcon, { backgroundColor: background }]}><MaterialIcons name={icon} size={24} color={color} /></View>; }
function Field({ label, icon, ...inputProps }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; value: string; onChangeText: (text: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "numeric"; autoCapitalize?: "none" | "words"; editable?: boolean }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputShell}><MaterialIcons name={icon} size={20} color={COLORS.muted} /><TextInput {...inputProps} style={styles.input} placeholderTextColor="#98A2B3" returnKeyType="done" /></View></View>; }
const styles = StyleSheet.create({ flex:{flex:1},content:{flexGrow:1,paddingTop:10,paddingBottom:32},topSpace:{height:74},back:{width:42,height:42,borderRadius:14,backgroundColor:COLORS.indigoSoft,alignItems:"center",justifyContent:"center",marginBottom:32},brandMark:{width:62,height:62,borderRadius:20,backgroundColor:COLORS.indigo,alignItems:"center",justifyContent:"center",marginBottom:18},eyebrow:{fontSize:10,letterSpacing:1.3,fontWeight:"900",color:COLORS.earth},title:{color:COLORS.ink,fontSize:30,lineHeight:37,fontWeight:"800",marginTop:7},subtitle:{color:COLORS.muted,fontSize:14,lineHeight:21,marginTop:10,maxWidth:360},choiceList:{marginTop:28,gap:13},portalChoice:{minHeight:116,borderRadius:20,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.white,padding:16,flexDirection:"row",alignItems:"center",gap:12},staffChoice:{backgroundColor:COLORS.indigo,borderColor:COLORS.indigo},ownerChoice:{minHeight:92,borderRadius:20,borderWidth:1,borderColor:"#EBC37B",backgroundColor:"#FFFAF0",padding:16,flexDirection:"row",alignItems:"center",gap:12},choiceIcon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center"},choiceCopy:{flex:1,gap:3},choiceTitle:{color:COLORS.ink,fontSize:17,fontWeight:"900"},choiceBody:{color:COLORS.muted,fontSize:12,lineHeight:17},switcher:{marginTop:27,padding:4,backgroundColor:"#EEF1F5",borderRadius:14,flexDirection:"row"},switch:{flex:1,minHeight:39,alignItems:"center",justifyContent:"center",borderRadius:11},switchActive:{backgroundColor:COLORS.white,shadowColor:"#14213D",shadowOpacity:0.08,shadowRadius:5,elevation:2},switchText:{color:COLORS.muted,fontSize:13,fontWeight:"800"},switchTextActive:{color:COLORS.indigo},portalTag:{marginTop:22,minHeight:42,borderRadius:12,backgroundColor:COLORS.indigoSoft,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6},portalTagText:{color:COLORS.indigo,fontSize:10,fontWeight:"900",letterSpacing:0.8},form:{marginTop:22,gap:15},field:{gap:7},label:{color:COLORS.ink,fontSize:13,fontWeight:"800"},inputShell:{minHeight:53,backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:15,paddingHorizontal:15,flexDirection:"row",alignItems:"center",gap:10},input:{flex:1,minHeight:52,color:COLORS.ink,fontSize:15},noticeBox:{flexDirection:"row",gap:8,borderRadius:12,padding:12,backgroundColor:COLORS.indigoSoft,alignItems:"flex-start",borderWidth:1,borderColor:"#C9D5F2"},noticeText:{flex:1,color:COLORS.indigo,fontSize:13,lineHeight:18,fontWeight:"700"},errorBox:{flexDirection:"row",gap:8,borderRadius:12,padding:12,backgroundColor:"#FDECEA",alignItems:"flex-start",borderWidth:1,borderColor:"#F9C6C1"},errorCopy:{flex:1,gap:2},errorTitle:{color:COLORS.red,fontSize:13,fontWeight:"900"},errorText:{color:COLORS.red,fontSize:13,lineHeight:18},forgotLink:{alignSelf:"flex-end",minHeight:30,justifyContent:"center",paddingHorizontal:4,marginTop:-4},resendLink:{alignSelf:"center",minHeight:32,justifyContent:"center",paddingHorizontal:4,marginTop:2},forgotText:{color:COLORS.indigo,fontSize:13,fontWeight:"900"},accountPath:{minHeight:64,borderRadius:15,borderWidth:1,borderColor:"#C9D5F2",backgroundColor:"#F7F9FF",paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:10},accountPathCopy:{flex:1,gap:2},accountPathTitle:{color:COLORS.ink,fontSize:12,fontWeight:"900"},accountPathText:{color:COLORS.indigo,fontSize:12,lineHeight:17,fontWeight:"700"},staffRequestHint:{color:COLORS.muted,fontSize:11,lineHeight:16,textAlign:"center",paddingHorizontal:6},submit:{minHeight:52,backgroundColor:COLORS.indigo,borderRadius:15,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:9,marginTop:5},submitText:{color:COLORS.white,fontSize:15,fontWeight:"900"},disabled:{opacity:0.55},footnote:{marginTop:19,color:COLORS.muted,fontSize:11,lineHeight:16,textAlign:"center"},pressed:{opacity:0.74,transform:[{scale:0.985}]}});
