import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type Portal = "student" | "staff" | "owner";
type ScreenMode = "choice" | "portal" | "forgot" | "otp" | "reset";
type AuthAction = "sign_in" | "create";

export default function AuthScreen() {
  const router = useRouter();
  const { completeLogin } = useLmsSession();
  const [portal, setPortal] = useState<Portal>("student");
  const [screenMode, setScreenMode] = useState<ScreenMode>("choice");
  const [authAction, setAuthAction] = useState<AuthAction>("sign_in");
  const [fullName, setFullName] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [staffPasskey, setStaffPasskey] = useState("");
  const [staffPasskeyConfirmation, setStaffPasskeyConfirmation] = useState("");
  const [ownerSetupCode, setOwnerSetupCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signInTimedOut, setSignInTimedOut] = useState(false);
  const signInAttemptRef = useRef(false);

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const registerStaffMutation = trpc.auth.registerStaff.useMutation();
  const ownerLoginMutation = trpc.auth.ownerLogin.useMutation();
  const claimInitialOwnerMutation = trpc.auth.claimInitialOwner.useMutation();
  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();
  const mutationBusy = loginMutation.isPending || registerMutation.isPending || registerStaffMutation.isPending || ownerLoginMutation.isPending || claimInitialOwnerMutation.isPending || requestResetMutation.isPending || verifyOtpMutation.isPending || resetPasswordMutation.isPending;
  const isBusy = mutationBusy && !signInTimedOut;

  const clearFeedback = () => { setError(null); setNotice(null); };
  const clearSensitiveFields = () => { setPassword(""); setConfirmPassword(""); setStaffPasskey(""); setStaffPasskeyConfirmation(""); setOwnerSetupCode(""); };
  const openPortal = (nextPortal: Portal, nextAction: AuthAction = "sign_in") => {
    setPortal(nextPortal); setAuthAction(nextAction); setScreenMode("portal"); setFullName(""); setIdentity(""); clearSensitiveFields(); setOtpCode(""); setResetToken(""); clearFeedback();
  };
  const selectAction = (nextAction: AuthAction) => { setAuthAction(nextAction); clearSensitiveFields(); clearFeedback(); };
  const goBack = () => {
    if (screenMode === "forgot") setScreenMode("portal");
    else if (screenMode === "otp") setScreenMode("forgot");
    else if (screenMode === "reset") setScreenMode("portal");
    else setScreenMode("choice");
    clearFeedback();
  };
  const messageForFailure = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "";
    if (/network|fetch|connection|offline|timeout/i.test(message)) return "The connection did not complete. Check your network and try again.";
    if (message.includes("Staff Passkey")) return "The Staff Passkey is incorrect or has been rotated. Ask the owner for the current value.";
    if (message.includes("Private Owner Passkey") || message.includes("Initial owner setup")) return "The Private Owner Setup Code is incorrect or owner setup is no longer available.";
    if (message.includes("already exists")) return "An account already exists with these details. Select Sign In instead.";
    if (message.includes("Staff / Admin portal")) return "This account belongs to Staff/Admin. Please use the Staff/Admin portal.";
    if (message.includes("not authorized")) return "This account is not authorized for that portal.";
    if (screenMode === "forgot") return "We could not start account recovery. Check the details and try again.";
    if (screenMode === "otp") return message || "We could not verify the recovery code.";
    if (screenMode === "reset") return message || "We could not update your password.";
    if (portal === "owner") return message || "Owner authentication was not completed. Verify your details and Private Owner Setup Code.";
    if (portal === "staff") return message || "Staff/Admin authentication was not completed. Verify your credentials and Staff Passkey.";
    return message || "Student authentication was not completed. Check the details and try again.";
  };
  const identityPayload = () => ({ email: identity.includes("@") ? identity.trim() : "", mobile: identity.includes("@") ? "" : identity.trim() });

  const submitPortal = async () => {
    clearFeedback();
    if (signInAttemptRef.current) return setError("Your previous sign-in request is still completing. Please wait for its result to avoid creating a duplicate session.");
    if (!identity.trim()) return setError(portal === "owner" ? "Enter the owner email address." : "Enter your email address or mobile number.");
    if (!password) return setError("Enter your password to continue.");
    if (authAction === "create" && fullName.trim().length < 2) return setError("Enter your full name.");
    if (authAction === "create" && password !== confirmPassword) return setError("Your password confirmation does not match.");
    signInAttemptRef.current = true;
    setSignInTimedOut(false);
    const timeout = setTimeout(() => {
      setSignInTimedOut(true);
      setNotice("Signing in is taking longer than expected. The secure request is still being checked; duplicate submissions are blocked until it finishes.");
    }, 15_000);
    try {
      if (portal === "student") {
        if (authAction === "create") {
          const payload = await registerMutation.mutateAsync({ fullName: fullName.trim(), ...identityPayload(), password });
          await completeLogin(payload); router.replace("/"); return;
        }
        const payload = await loginMutation.mutateAsync({ identity, password, portal: "student" });
        await completeLogin(payload); router.replace("/"); return;
      }
      if (portal === "staff") {
        if (!staffPasskey) return setError("Enter the Staff Passkey. It is required for both account creation and sign-in.");
        if (authAction === "create") {
          const payload = await registerStaffMutation.mutateAsync({ fullName: fullName.trim(), ...identityPayload(), password, staffPasskey });
          await completeLogin(payload); router.replace("/operations"); return;
        }
        const payload = await loginMutation.mutateAsync({ identity, password, portal: "staff", staffPasskey });
        await completeLogin(payload); router.replace("/operations"); return;
      }
      if (!identity.includes("@")) return setError("Enter the owner email address.");
      if (!ownerSetupCode) return setError("Enter the Private Owner Setup Code. It is required for owner creation and sign-in.");
      if (authAction === "create") {
        if (staffPasskey.length < 12) return setError("Create a Staff Passkey of at least 12 characters.");
        if (staffPasskey !== staffPasskeyConfirmation) return setError("The Staff Passkey confirmation does not match.");
        const payload = await claimInitialOwnerMutation.mutateAsync({ fullName: fullName.trim(), email: identity.trim(), mobile: "", password, staffPasskey, staffPasskeyConfirmation, ownerSetupCode });
        await completeLogin(payload); router.replace("/operations"); return;
      }
      const payload = await ownerLoginMutation.mutateAsync({ email: identity.trim(), password, ownerSetupCode });
      await completeLogin(payload); router.replace("/operations");
    } catch (cause) { setError(messageForFailure(cause)); } finally { clearTimeout(timeout); signInAttemptRef.current = false; setSignInTimedOut(false); }
  };

  const requestReset = async () => {
    clearFeedback();
    if (!identity.trim()) return setError("Enter the email address or mobile number registered with your account.");
    try {
      const response = await requestResetMutation.mutateAsync({ identity });
      if (response.delivery === "unconfigured") return setNotice("Recovery delivery is not configured yet. Please contact the Amin Ka Master team for help.");
      setScreenMode("otp"); setNotice("If this account is eligible, a six-digit code has been sent. It expires in 10 minutes.");
    } catch (cause) { setError(messageForFailure(cause)); }
  };
  const verifyCode = async () => {
    clearFeedback();
    if (!/^\d{6}$/.test(otpCode)) return setError("Enter the six-digit recovery code.");
    try {
      const response = await verifyOtpMutation.mutateAsync({ identity, code: otpCode });
      setResetToken(response.resetToken); setPassword(""); setConfirmPassword(""); setScreenMode("reset"); setNotice("Identity confirmed. Choose a new password for your account.");
    } catch (cause) { setError(messageForFailure(cause)); }
  };
  const resetPassword = async () => {
    clearFeedback();
    if (password.length < 8) return setError("Use at least 8 characters for your new password.");
    if (password !== confirmPassword) return setError("Your new password confirmation does not match.");
    try {
      await resetPasswordMutation.mutateAsync({ resetToken, password });
      setPassword(""); setConfirmPassword(""); setOtpCode(""); setResetToken(""); setScreenMode("portal"); setAuthAction("sign_in"); setNotice("Your password has been updated. Previous sessions were signed out. Please sign in again.");
    } catch (cause) { setError(messageForFailure(cause)); }
  };

  const isOwner = portal === "owner";
  const title = screenMode === "forgot" ? "Recover your account" : screenMode === "otp" ? "Verify recovery code" : screenMode === "reset" ? "Choose a new password" : isOwner ? "Owner portal" : portal === "staff" ? "Staff / Admin portal" : "Student portal";
  const subtitle = screenMode === "forgot" ? "Enter the email address or Indian mobile number linked to your account." : screenMode === "otp" ? "Enter the six-digit code from your email or mobile message." : screenMode === "reset" ? "This recovery session is short-lived and can be used once." : isOwner ? "Private Owner Setup Code verification is required for both sign-in and Super Admin account creation." : portal === "staff" ? "A current Staff Passkey is required for both sign-in and Staff account creation." : "Access exam preparation, courses, tests, notes and learning progress.";
  const busyCopy = screenMode === "forgot" ? "Sending recovery code…" : screenMode === "otp" ? "Verifying code…" : screenMode === "reset" ? "Updating password…" : authAction === "create" ? "Creating secure account…" : "Signing you in…";
  const submitCopy = screenMode === "forgot" ? "Send recovery code" : screenMode === "otp" ? "Verify code" : screenMode === "reset" ? "Update password" : authAction === "create" ? isOwner ? "Create Super Admin account" : portal === "staff" ? "Create Staff account" : "Create student account" : isOwner ? "Login as owner" : portal === "staff" ? "Login to Staff/Admin" : "Login as student";
  const feedback = <>{notice ? <View accessibilityLiveRegion="polite" style={styles.noticeBox}><MaterialIcons name="info-outline" size={18} color={COLORS.indigo} /><Text style={styles.noticeText}>{notice}</Text></View> : null}{error ? <View accessibilityLiveRegion="assertive" style={styles.errorBox}><MaterialIcons name="error-outline" size={18} color={COLORS.red} /><View style={styles.errorCopy}><Text style={styles.errorTitle}>{screenMode === "portal" ? authAction === "create" ? "Account not created" : "Sign-in unsuccessful" : "Action needed"}</Text><Text style={styles.errorText}>{error}</Text></View></View> : null}</>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{screenMode !== "choice" ? <Pressable accessibilityRole="button" onPress={goBack} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable> : <View style={styles.topSpace} />}<View style={styles.brandMark}><MaterialIcons name="architecture" size={33} color={COLORS.saffron} /></View><Text style={styles.eyebrow}>AMIN KA MASTER</Text>{screenMode === "choice" ? <PortalChoice onStudent={() => openPortal("student")} onStaff={() => openPortal("staff")} onOwner={() => openPortal("owner")} onDeveloper={() => router.push("/dev-portal")} /> : <><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>{screenMode === "portal" ? <AuthToggle portal={portal} action={authAction} onChange={selectAction} /> : null}<View style={styles.form}>{screenMode === "portal" && authAction === "create" ? <Field label="Full name" value={fullName} onChangeText={(value) => { setFullName(value); clearFeedback(); }} placeholder="Your full name" icon="person-outline" autoCapitalize="words" editable={!isBusy} /> : null}{screenMode === "portal" || screenMode === "forgot" ? <Field label={isOwner && screenMode === "portal" ? "Owner email" : screenMode === "forgot" ? "Registered email or mobile" : "Email or mobile number"} value={identity} onChangeText={(value) => { setIdentity(value); clearFeedback(); }} placeholder={isOwner && screenMode === "portal" ? "owner@example.com" : "name@example.com or +91 90000 00000"} icon="alternate-email" autoCapitalize="none" keyboardType="email-address" editable={!isBusy} /> : null}{screenMode === "portal" ? <Field label="Password" value={password} onChangeText={(value) => { setPassword(value); clearFeedback(); }} placeholder={authAction === "create" ? (isOwner ? "At least 12 characters" : "At least 8 characters") : "Your password"} icon="lock-outline" secureTextEntry editable={!isBusy} /> : null}{screenMode === "portal" && authAction === "create" ? <Field label="Confirm password" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); clearFeedback(); }} placeholder="Repeat your password" icon="lock-outline" secureTextEntry editable={!isBusy} /> : null}{screenMode === "portal" && portal === "staff" ? <Field label="Staff Passkey" value={staffPasskey} onChangeText={(value) => { setStaffPasskey(value); clearFeedback(); }} placeholder="Current Staff Passkey from owner" icon="key" secureTextEntry editable={!isBusy} /> : null}{screenMode === "portal" && isOwner && authAction === "create" ? <><Field label="Create Staff Passkey" value={staffPasskey} onChangeText={(value) => { setStaffPasskey(value); clearFeedback(); }} placeholder="At least 12 characters" icon="key" secureTextEntry editable={!isBusy} /><Field label="Confirm Staff Passkey" value={staffPasskeyConfirmation} onChangeText={(value) => { setStaffPasskeyConfirmation(value); clearFeedback(); }} placeholder="Repeat the Staff Passkey" icon="key" secureTextEntry editable={!isBusy} /></> : null}{screenMode === "portal" && isOwner ? <Field label="Private Owner Passkey / Setup Code" value={ownerSetupCode} onChangeText={(value) => { setOwnerSetupCode(value); clearFeedback(); }} placeholder="Required for every owner action" icon="security" secureTextEntry editable={!isBusy} /> : null}{screenMode === "otp" ? <Field label="Six-digit recovery code" value={otpCode} onChangeText={(value) => { setOtpCode(value.replace(/\D/g, "").slice(0, 6)); clearFeedback(); }} placeholder="000000" icon="security" keyboardType="numeric" editable={!isBusy} /> : null}{screenMode === "reset" ? <><Field label="New password" value={password} onChangeText={(value) => { setPassword(value); clearFeedback(); }} placeholder="At least 8 characters" icon="lock-reset" secureTextEntry editable={!isBusy} /><Field label="Confirm new password" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); clearFeedback(); }} placeholder="Repeat your new password" icon="lock-outline" secureTextEntry editable={!isBusy} /></> : null}{feedback}{screenMode === "portal" && authAction === "sign_in" && !isOwner ? <Pressable disabled={isBusy} onPress={() => { setScreenMode("forgot"); setPassword(""); clearFeedback(); }} style={({ pressed }) => [styles.forgotLink, pressed && styles.pressed]}><Text style={styles.forgotText}>Forgot password?</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityState={{ busy: isBusy, disabled: isBusy }} disabled={isBusy} onPress={screenMode === "forgot" ? requestReset : screenMode === "otp" ? verifyCode : screenMode === "reset" ? resetPassword : submitPortal} style={({ pressed }) => [styles.submit, (pressed || isBusy) && styles.pressed, isBusy && styles.disabled]}>{isBusy ? <><ActivityIndicator size="small" color={COLORS.white} /><Text style={styles.submitText}>{busyCopy}</Text></> : <><Text style={styles.submitText}>{submitCopy}</Text><MaterialIcons name="arrow-forward" size={19} color={COLORS.white} /></>}</Pressable>{screenMode === "otp" ? <Pressable disabled={isBusy} onPress={requestReset} style={({ pressed }) => [styles.resendLink, pressed && styles.pressed]}><Text style={styles.forgotText}>Resend recovery code</Text></Pressable> : null}</View><Text style={styles.footnote}>{screenMode === "portal" && portal === "staff" ? "A valid Staff Passkey is required before the server creates a Staff account or authorizes Staff/Admin sign-in. New self-registered staff start with Teacher access." : screenMode === "portal" && isOwner ? "The Private Owner Setup Code is checked by the server for every owner create-account or sign-in request. It is never displayed by the app." : screenMode === "portal" && authAction === "create" ? "Student registration creates a Student account only." : screenMode === "forgot" || screenMode === "otp" || screenMode === "reset" ? "Recovery codes expire in 10 minutes, can only be used once, and are protected against repeated guessing." : "Use password recovery if you cannot sign in."}</Text></>}</ScrollView></KeyboardAvoidingView></ScreenContainer>;
}

function AuthToggle({ portal, action, onChange }: { portal: Portal; action: AuthAction; onChange: (action: AuthAction) => void }) {
  const createLabel = portal === "owner" ? "Create Account (Super Admin)" : "Create Account";
  return <View style={styles.switcher}><Pressable accessibilityRole="tab" onPress={() => onChange("sign_in")} style={[styles.switch, action === "sign_in" && styles.switchActive]}><Text style={[styles.switchText, action === "sign_in" && styles.switchTextActive]}>Sign In</Text></Pressable><Pressable accessibilityRole="tab" onPress={() => onChange("create")} style={[styles.switch, action === "create" && styles.switchActive]}><Text numberOfLines={1} style={[styles.switchText, action === "create" && styles.switchTextActive]}>{createLabel}</Text></Pressable></View>;
}

function PortalChoice({ onStudent, onStaff, onOwner, onDeveloper }: { onStudent: () => void; onStaff: () => void; onOwner: () => void; onDeveloper: () => void }) {
  return <View><Text style={styles.title}>Welcome back</Text><Text style={styles.subtitle}>Learn. Measure. Master.</Text><View style={styles.choiceList}><PortalCard title="Student" body="Sign in or create a learner account." icon="school" tone="student" onPress={onStudent} /><PortalCard title="Staff / Admin" body="Sign in or create Staff access with a Staff Passkey." icon="admin-panel-settings" tone="staff" onPress={onStaff} /><PortalCard title="Owner" body="Sign in or create the Super Admin account with the Private Owner Setup Code." icon="verified-user" tone="owner" onPress={onOwner} /></View><Pressable accessibilityRole="link" accessibilityLabel="Open Developer test sign-in" onPress={onDeveloper} style={({ pressed }) => [styles.developerLink, pressed && styles.pressed]}><MaterialIcons name="terminal" size={15} color={COLORS.muted} /><Text style={styles.developerLinkText}>Developer test sign-in</Text></Pressable><Text style={styles.footnote}>For security, this opens the protected Developer sign-in screen; your Developer email, password, and server-verified passkey are still required.</Text></View>;
}

function PortalCard({ title, body, icon, tone, onPress }: { title: string; body: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; tone: "student" | "staff" | "owner"; onPress: () => void }) {
  const dark = tone === "staff";
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.portalChoice, dark && styles.staffChoice, tone === "owner" && styles.ownerChoice, pressed && styles.pressed]}><View style={[styles.choiceIcon, { backgroundColor: dark ? "rgba(255,255,255,0.12)" : tone === "owner" ? "#FFF1DE" : COLORS.indigoSoft }]}><MaterialIcons name={icon} size={24} color={dark ? COLORS.saffron : tone === "owner" ? COLORS.earth : COLORS.indigo} /></View><View style={styles.choiceCopy}><Text style={[styles.choiceTitle, dark && styles.staffChoiceText]}>{title}</Text><Text style={[styles.choiceBody, dark && styles.staffChoiceBody]}>{body}</Text></View><MaterialIcons name="arrow-forward" size={22} color={dark ? COLORS.white : tone === "owner" ? COLORS.earth : COLORS.indigo} /></Pressable>;
}

function Field({ label, icon, ...inputProps }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; value: string; onChangeText: (text: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "numeric"; autoCapitalize?: "none" | "words"; editable?: boolean }) {
  const [visible, setVisible] = useState(false);
  const secret = Boolean(inputProps.secureTextEntry);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputShell}><MaterialIcons name={icon} size={20} color={COLORS.muted} /><TextInput {...inputProps} secureTextEntry={secret && !visible} style={styles.input} placeholderTextColor="#98A2B3" returnKeyType="done" />{secret ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`} onPress={() => setVisible((current) => !current)} hitSlop={8} style={styles.visibility}><MaterialIcons name={visible ? "visibility-off" : "visibility"} size={21} color={COLORS.muted} /></Pressable> : null}</View></View>;
}

const styles = StyleSheet.create({
  flex:{flex:1}, content:{flexGrow:1,paddingTop:10,paddingBottom:32}, topSpace:{height:74}, back:{width:42,height:42,borderRadius:14,backgroundColor:COLORS.indigoSoft,alignItems:"center",justifyContent:"center",marginBottom:32}, brandMark:{width:62,height:62,borderRadius:20,backgroundColor:COLORS.indigo,alignItems:"center",justifyContent:"center",marginBottom:18}, eyebrow:{fontSize:10,letterSpacing:1.3,fontWeight:"900",color:COLORS.earth}, title:{color:COLORS.ink,fontSize:30,lineHeight:37,fontWeight:"800",marginTop:7}, subtitle:{color:COLORS.muted,fontSize:14,lineHeight:21,marginTop:10,maxWidth:360}, choiceList:{marginTop:28,gap:13}, developerLink:{alignSelf:"center",minHeight:40,marginTop:16,paddingHorizontal:10,flexDirection:"row",alignItems:"center",gap:6}, developerLinkText:{color:COLORS.muted,fontSize:12,fontWeight:"800"}, portalChoice:{minHeight:104,borderRadius:20,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.white,padding:16,flexDirection:"row",alignItems:"center",gap:12}, staffChoice:{backgroundColor:COLORS.indigo,borderColor:COLORS.indigo}, ownerChoice:{borderColor:"#EBC37B",backgroundColor:"#FFFAF0"}, choiceIcon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center"}, choiceCopy:{flex:1,gap:3}, choiceTitle:{color:COLORS.ink,fontSize:17,fontWeight:"900"}, choiceBody:{color:COLORS.muted,fontSize:12,lineHeight:17}, staffChoiceText:{color:COLORS.white}, staffChoiceBody:{color:"#D6DFF2"}, switcher:{marginTop:24,padding:4,backgroundColor:"#EEF1F5",borderRadius:14,flexDirection:"row"}, switch:{flex:1,minHeight:42,alignItems:"center",justifyContent:"center",borderRadius:11,paddingHorizontal:4}, switchActive:{backgroundColor:COLORS.white,shadowColor:"#14213D",shadowOpacity:0.08,shadowRadius:5,elevation:2}, switchText:{color:COLORS.muted,fontSize:12,fontWeight:"800"}, switchTextActive:{color:COLORS.indigo}, form:{marginTop:22,gap:15}, field:{gap:7}, label:{color:COLORS.ink,fontSize:13,fontWeight:"800"}, inputShell:{minHeight:53,backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:15,paddingHorizontal:15,flexDirection:"row",alignItems:"center",gap:10}, input:{flex:1,minHeight:52,color:COLORS.ink,fontSize:15}, visibility:{width:38,height:42,alignItems:"center",justifyContent:"center"}, noticeBox:{flexDirection:"row",gap:8,borderRadius:12,padding:12,backgroundColor:COLORS.indigoSoft,alignItems:"flex-start",borderWidth:1,borderColor:"#C9D5F2"}, noticeText:{flex:1,color:COLORS.indigo,fontSize:13,lineHeight:18,fontWeight:"700"}, errorBox:{flexDirection:"row",gap:8,borderRadius:12,padding:12,backgroundColor:"#FDECEA",alignItems:"flex-start",borderWidth:1,borderColor:"#F9C6C1"}, errorCopy:{flex:1,gap:2}, errorTitle:{color:COLORS.red,fontSize:13,fontWeight:"900"}, errorText:{color:COLORS.red,fontSize:13,lineHeight:18}, forgotLink:{alignSelf:"flex-end",minHeight:30,justifyContent:"center",paddingHorizontal:4,marginTop:-4}, resendLink:{alignSelf:"center",minHeight:32,justifyContent:"center",paddingHorizontal:4,marginTop:2}, forgotText:{color:COLORS.indigo,fontSize:13,fontWeight:"900"}, submit:{minHeight:52,backgroundColor:COLORS.indigo,borderRadius:15,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:9,marginTop:5}, submitText:{color:COLORS.white,fontSize:15,fontWeight:"900"}, disabled:{opacity:0.55}, footnote:{marginTop:19,color:COLORS.muted,fontSize:11,lineHeight:16,textAlign:"center"}, pressed:{opacity:0.74,transform:[{scale:0.985}]}
});
