import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, EmptyState, IconCircle, formatDate } from "@/components/lms-ui";
import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useLmsSession();
  const notificationsQuery = trpc.student.notifications.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const markReadMutation = trpc.student.markNotificationRead.useMutation({ onSuccess: () => void notificationsQuery.refetch() });

  if (!user) return <ScreenContainer className="px-5"><View style={styles.center}><EmptyState icon="lock-person" title="Sign in for updates" body="Course notices and enrollment messages are personal to your authorized account." /></View></ScreenContainer>;
  if (notificationsQuery.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10}><MaterialIcons name="arrow-back" size={23} color={COLORS.indigo} /></Pressable><Text style={styles.title}>Notifications</Text><View style={{ width: 23 }} /></View>{notificationsQuery.data?.length ? <FlatList data={notificationsQuery.data} keyExtractor={(item) => item.id.toString()} contentContainerStyle={styles.list} renderItem={({ item }) => <Pressable onPress={() => !item.isRead && void markReadMutation.mutateAsync({ notificationId: item.id })} style={({ pressed }) => [styles.notice, !item.isRead && styles.noticeUnread, pressed && styles.pressed]}><IconCircle icon={item.type.includes("live") ? "videocam" : item.type.includes("payment") ? "receipt-long" : "campaign"} size={39} color={item.isRead ? COLORS.muted : COLORS.indigo} background={item.isRead ? COLORS.mist : COLORS.indigoSoft} /><View style={styles.copy}><Text style={styles.noticeTitle}>{item.title}</Text><Text style={styles.noticeBody}>{item.body}</Text><Text style={styles.date}>{formatDate(item.createdAt)}</Text></View>{!item.isRead ? <View style={styles.dot} /> : null}</Pressable>} /> : <View style={styles.center}><EmptyState icon="notifications-off" title="No notifications yet" body="Enrollment confirmations, lesson updates and live-class reminders will appear here." /></View>}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center" },
  list: { paddingBottom: 36, gap: 10 },
  notice: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 19, padding: 13, flexDirection: "row", gap: 11, alignItems: "flex-start" },
  noticeUnread: { borderColor: "#C9D3EC", backgroundColor: "#FAFCFF" },
  copy: { flex: 1, gap: 4 },
  noticeTitle: { color: COLORS.ink, fontSize: 15, fontWeight: "800" },
  noticeBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  date: { color: "#98A2B3", fontSize: 11, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.saffron, marginTop: 4 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
