import Constants from "expo-constants";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

function setting(settings: Record<string, unknown>, key: string, fallback: string) { const value = settings[key]; return typeof value === "string" && value.trim() ? value : fallback; }

export default function DeveloperScreen() {
  const router = useRouter();
  const settingsQuery = trpc.catalog.uiSettings.useQuery();
  const settings = (settingsQuery.data ?? {}) as Record<string, unknown>;
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.eyebrow}>APPLICATION INFORMATION</Text><Text style={styles.title}>Developer Details</Text></View></View>
    <View style={styles.hero}><IconCircle icon="code" size={45} color={COLORS.saffron} background="rgba(255,255,255,0.12)" /><View style={styles.heroCopy}><Text style={styles.heroTitle}>{setting(settings, "developer.name", "Developer information not configured")}</Text><Text style={styles.heroBody}>{setting(settings, "developer.role", "Authorized development partner")}</Text></View></View>
    <View style={styles.group}><InfoRow icon="hub" label="AMINPATH project" value={setting(settings, "developer.project_info", "AMINPATH learning platform development information can be configured by Super Admin.")} /><InfoRow icon="memory" label="Technology stack" value="Expo React Native, TypeScript, NativeWind, tRPC, Drizzle ORM and MySQL." /><InfoRow icon="new-releases" label="Application version" value={appVersion} /><InfoRow icon="copyright" label="Copyright" value={setting(settings, "developer.copyright", "Copyright information not configured.")} /><InfoRow icon="contact-mail" label="Developer/support contact" value={setting(settings, "developer.contact", "Optional developer/support contact not configured.")} last /></View>
  </ScrollView></ScreenContainer>;
}

function InfoRow({ icon, label, value, last = false }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; last?: boolean }) { return <View style={[styles.row, !last && styles.divider]}><IconCircle icon={icon} size={38} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.copy}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View></View>; }
const styles = StyleSheet.create({ content:{paddingTop:14,paddingBottom:36,gap:14},header:{flexDirection:"row",alignItems:"center",gap:11},back:{width:40,height:40,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.indigoSoft},heading:{flex:1},eyebrow:{color:COLORS.earth,fontSize:10,fontWeight:"900",letterSpacing:1.1},title:{color:COLORS.ink,fontSize:25,fontWeight:"900",marginTop:2},hero:{backgroundColor:COLORS.indigo,borderRadius:22,padding:17,flexDirection:"row",gap:12,alignItems:"center"},heroCopy:{flex:1,gap:4},heroTitle:{color:COLORS.white,fontSize:17,fontWeight:"900"},heroBody:{color:"#D6DFF2",fontSize:13,lineHeight:18},group:{borderColor:COLORS.line,borderWidth:1,borderRadius:19,backgroundColor:COLORS.white,overflow:"hidden"},row:{padding:14,flexDirection:"row",gap:11,alignItems:"center"},divider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:COLORS.line},copy:{flex:1,gap:3},label:{color:COLORS.ink,fontSize:14,fontWeight:"900"},value:{color:COLORS.muted,fontSize:12,lineHeight:17},pressed:{opacity:0.74,transform:[{scale:0.985}]}});
