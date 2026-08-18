import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, IconCircle } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

const topics = [
  ["Getting started", "Create a student account, sign in, choose a course and begin learning from the first lesson."],
  ["Student sign-in help", "Use the registered email address or Indian mobile number. Choose Forgot password if you cannot sign in."],
  ["Teacher and admin access", "Select Staff / Admin Login. Your server-verified role and staff access controls decide the workspace you can use."],
  ["Courses and practice tests", "Enroll in available courses, complete lessons, then open Practice tests from Account to attempt published MCQs."],
  ["Progress and certificates", "Lesson progress is saved automatically. Certificate availability depends on the relevant course completion rules."],
  ["Technical issues", "If a page does not load, check your internet connection, restart the app, and contact support with a screenshot and the action you tried."],
] as const;

export default function HelpScreen() {
  const router = useRouter();
  const settingsQuery = trpc.catalog.uiSettings.useQuery();
  const settings = settingsQuery.data ?? {};
  const intro = typeof settings["support.help_intro"] === "string" && settings["support.help_intro"].trim() ? settings["support.help_intro"] : "Find quick guidance for learning, accounts, tests, and technical issues.";

  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={COLORS.indigo} /></Pressable><View style={styles.heading}><Text style={styles.eyebrow}>SUPPORT CENTER</Text><Text style={styles.title}>Help & Support</Text></View></View>
    <View style={styles.hero}><IconCircle icon="support-agent" size={45} color={COLORS.saffron} background="rgba(255,255,255,0.12)" /><View style={styles.heroCopy}><Text style={styles.heroTitle}>How can we help?</Text><Text style={styles.heroBody}>{intro}</Text></View></View>
    <Text style={styles.section}>Frequently asked questions</Text>
    <View style={styles.group}>{topics.map(([title, body], index) => <View key={title} style={[styles.topic, index < topics.length - 1 && styles.topicDivider]}><Text style={styles.topicTitle}>{title}</Text><Text style={styles.topicBody}>{body}</Text></View>)}</View>
    <Pressable onPress={() => router.push("/contact")} style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}><IconCircle icon="mail-outline" size={40} color={COLORS.indigo} background={COLORS.indigoSoft} /><View style={styles.contactCopy}><Text style={styles.contactTitle}>Still need help?</Text><Text style={styles.contactBody}>View the official support channels or report a technical issue.</Text></View><MaterialIcons name="chevron-right" size={24} color={COLORS.muted} /></Pressable>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content:{paddingTop:14,paddingBottom:36,gap:14},header:{flexDirection:"row",alignItems:"center",gap:11},back:{width:40,height:40,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.indigoSoft},heading:{flex:1},eyebrow:{color:COLORS.earth,fontSize:10,fontWeight:"900",letterSpacing:1.1},title:{color:COLORS.ink,fontSize:25,fontWeight:"900",marginTop:2},hero:{backgroundColor:COLORS.indigo,borderRadius:22,padding:17,flexDirection:"row",gap:12,alignItems:"center"},heroCopy:{flex:1,gap:4},heroTitle:{color:COLORS.white,fontSize:18,fontWeight:"900"},heroBody:{color:"#D6DFF2",fontSize:13,lineHeight:18},section:{marginTop:5,color:COLORS.muted,fontSize:11,fontWeight:"900",letterSpacing:1.1},group:{borderColor:COLORS.line,borderWidth:1,borderRadius:19,backgroundColor:COLORS.white,overflow:"hidden"},topic:{padding:15,gap:5},topicDivider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:COLORS.line},topicTitle:{color:COLORS.ink,fontSize:15,fontWeight:"900"},topicBody:{color:COLORS.muted,fontSize:13,lineHeight:19},contactCard:{marginTop:4,padding:14,borderRadius:19,borderWidth:1,borderColor:"#C9D5F2",backgroundColor:"#F7F9FF",flexDirection:"row",alignItems:"center",gap:11},contactCopy:{flex:1,gap:3},contactTitle:{color:COLORS.indigo,fontSize:15,fontWeight:"900"},contactBody:{color:COLORS.muted,fontSize:12,lineHeight:17},pressed:{opacity:0.74,transform:[{scale:0.985}]}});
