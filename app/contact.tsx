import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

function setting(settings: Record<string, unknown>, key: string, fallback: string) { const value = settings[key]; return typeof value === "string" && value.trim() ? value : fallback; }

export default function ContactScreen() {
  const router = useRouter();
  const settingsQuery = trpc.catalog.uiSettings.useQuery();
  const settings = (settingsQuery.data ?? {}) as Record<string, unknown>;
  const contacts = [
    ["Official contact number", setting(settings, "brand.contact_phone", "Not configured — Super Admin can add the official number."), "phone"],
    ["Official email", setting(settings, "brand.contact_email", "Not configured — Super Admin can add the official email."), "alternate-email"],
    ["Support email", setting(settings, "support.support_email", "Not configured — Super Admin can add a support email."), "support-agent"],
    ["Support contact", setting(settings, "support.support_phone", "Not configured — Super Admin can add a support number."), "headset-mic"],
    ["Office information", setting(settings, "support.office_info", "Not configured — Super Admin can add office/contact information."), "location-on"],
  ] as const;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.eyebrow}>AMIN KA MASTER</Text><Text style={styles.title}>Contact Us</Text></View></View>
    <View style={styles.note}><MaterialIcons name="info-outline" size={18} color={COLORS.indigo} /><Text style={styles.noteText}>Official contact information is controlled by the Super Admin. Only configured channels should be used for support.</Text></View>
    <View style={styles.group}>{contacts.map(([label, value, icon], index) => <View key={label} style={[styles.row, index < contacts.length - 1 && styles.divider]}><IconCircle icon={icon} size={39} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.copy}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View></View>)}</View>
    <Pressable onPress={() => router.push("/help")} style={({ pressed }) => [styles.helpLink, pressed && styles.pressed]}><Text style={styles.helpText}>Open Help & Support</Text><MaterialIcons name="arrow-forward" size={20} color={COLORS.indigo} /></Pressable>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content:{paddingTop:14,paddingBottom:36,gap:14},header:{flexDirection:"row",alignItems:"center",gap:11},back:{width:40,height:40,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.indigoSoft},heading:{flex:1},eyebrow:{color:COLORS.earth,fontSize:10,fontWeight:"900",letterSpacing:1.1},title:{color:COLORS.ink,fontSize:25,fontWeight:"900",marginTop:2},note:{padding:13,borderRadius:16,backgroundColor:COLORS.indigoSoft,flexDirection:"row",gap:8,alignItems:"flex-start"},noteText:{flex:1,color:COLORS.indigo,fontSize:12,lineHeight:18,fontWeight:"700"},group:{borderColor:COLORS.line,borderWidth:1,borderRadius:19,backgroundColor:COLORS.white,overflow:"hidden"},row:{padding:14,flexDirection:"row",gap:11,alignItems:"center"},divider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:COLORS.line},copy:{flex:1,gap:3},label:{color:COLORS.ink,fontSize:14,fontWeight:"900"},value:{color:COLORS.muted,fontSize:12,lineHeight:17},helpLink:{minHeight:50,borderRadius:14,backgroundColor:COLORS.white,borderColor:COLORS.line,borderWidth:1,paddingHorizontal:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},helpText:{color:COLORS.indigo,fontSize:14,fontWeight:"900"},pressed:{opacity:0.74,transform:[{scale:0.985}]}});
