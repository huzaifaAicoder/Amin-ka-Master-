import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export const COLORS = {
  indigo: "#14213D",
  indigoSoft: "#E8EDF8",
  saffron: "#F2A541",
  paper: "#FFFDF8",
  ink: "#1D252D",
  muted: "#667085",
  line: "#E6E9EE",
  mist: "#F4F6F9",
  green: "#287A5A",
  greenSoft: "#E7F4ED",
  earth: "#805B3B",
  red: "#B42318",
  white: "#FFFFFF",
};

export function PrimaryButton({ label, onPress, icon, disabled, subtle = false, loading = false }: { label: string; onPress: () => void; icon?: React.ComponentProps<typeof MaterialIcons>["name"]; disabled?: boolean; subtle?: boolean; loading?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, subtle && styles.buttonSubtle, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
    >
      {loading ? <ActivityIndicator size="small" color={subtle ? COLORS.indigo : COLORS.white} /> : icon ? <MaterialIcons name={icon} size={18} color={subtle ? COLORS.indigo : COLORS.white} /> : null}
      <Text style={[styles.buttonText, subtle && styles.buttonTextSubtle]}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: React.ComponentProps<typeof MaterialIcons>["name"] }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}>
      {icon ? <MaterialIcons name={icon} size={18} color={COLORS.indigo} /> : null}
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = COLORS.green }: { value: number; color?: string }) {
  const safeValue = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.progressTrack} accessibilityLabel={`${Math.round(safeValue * 100)} percent complete`}>
      <View style={[styles.progressFill, { width: `${safeValue * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "green" | "saffron" | "indigo" | "red" }) {
  const toneStyle = {
    neutral: styles.tagNeutral,
    green: styles.tagGreen,
    saffron: styles.tagSaffron,
    indigo: styles.tagIndigo,
    red: styles.tagRed,
  }[tone];
  const textStyle = {
    neutral: styles.tagTextNeutral,
    green: styles.tagTextGreen,
    saffron: styles.tagTextSaffron,
    indigo: styles.tagTextIndigo,
    red: styles.tagTextRed,
  }[tone];
  return <View style={[styles.tag, toneStyle]}><Text style={[styles.tagText, textStyle]}>{label}</Text></View>;
}

export function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onPress ? <Pressable onPress={onPress} hitSlop={8}><Text style={styles.actionText}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function IconCircle({ icon, color = COLORS.indigo, background = COLORS.indigoSoft, size = 40 }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; color?: string; background?: string; size?: number }) {
  return <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}><MaterialIcons name={icon} size={Math.round(size * 0.48)} color={color} /></View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({ icon, title, body, action }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; body: string; action?: ReactNode }) {
  return <View style={styles.emptyState}><IconCircle icon={icon} size={52} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text>{action}</View>;
}

export function formatPrice(value: string | number) {
  const amount = Number(value);
  return amount === 0 ? "Free" : `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "To be announced";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

const styles = StyleSheet.create({
  button: { minHeight: 46, borderRadius: 14, paddingHorizontal: 18, backgroundColor: COLORS.indigo, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8 },
  buttonSubtle: { backgroundColor: COLORS.indigoSoft },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  buttonText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  buttonTextSubtle: { color: COLORS.indigo },
  outlineButton: { minHeight: 46, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.indigo, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8 },
  outlineText: { color: COLORS.indigo, fontWeight: "800", fontSize: 15 },
  progressTrack: { height: 7, borderRadius: 99, backgroundColor: "#DFE4EA", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, alignSelf: "flex-start" },
  tagText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.1 },
  tagNeutral: { backgroundColor: COLORS.mist },
  tagGreen: { backgroundColor: COLORS.greenSoft },
  tagSaffron: { backgroundColor: "#FFF0D9" },
  tagIndigo: { backgroundColor: COLORS.indigoSoft },
  tagRed: { backgroundColor: "#FDECEA" },
  tagTextNeutral: { color: COLORS.muted },
  tagTextGreen: { color: COLORS.green },
  tagTextSaffron: { color: "#9A5700" },
  tagTextIndigo: { color: COLORS.indigo },
  tagTextRed: { color: COLORS.red },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontSize: 19, lineHeight: 25, fontWeight: "800", color: COLORS.ink },
  actionText: { color: COLORS.indigo, fontWeight: "800", fontSize: 13 },
  iconCircle: { alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 20, padding: 16 },
  emptyState: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 32, gap: 10 },
  emptyTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "800", textAlign: "center", marginTop: 2 },
  emptyBody: { color: COLORS.muted, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 290 },
});
