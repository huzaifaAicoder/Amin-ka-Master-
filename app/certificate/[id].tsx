import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { ScreenContainer } from "@/components/screen-container";
import { COLORS, PrimaryButton } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

export default function CertificateScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const certificateId = Number(id);
  const query = trpc.student.certificate.useQuery({ certificateId }, { enabled: Number.isInteger(certificateId) && certificateId > 0 });
  const certificate = query.data;
  const html = useMemo(() => certificate ? `<html><body style="font-family:Arial;background:#f8f5ed;padding:48px;text-align:center"><div style="border:8px solid #14213d;padding:48px;background:#fffdf7"><p style="color:#c78335;letter-spacing:3px;font-weight:bold">AMIN KA MASTER</p><h1 style="color:#14213d;font-size:42px">Certificate of Completion</h1><p style="color:#697386;font-size:18px">This certificate is proudly presented to</p><h2 style="color:#14213d;font-size:32px">${escapeHtml(certificate.recipientName ?? "Student")}</h2><p style="color:#697386;font-size:18px">for successfully completing</p><h3 style="color:#14213d;font-size:25px">${escapeHtml(certificate.courseTitle)}</h3><p style="color:#697386">Certificate code: ${escapeHtml(certificate.certificate.certificateCode)}</p><p style="color:#697386">Issued: ${new Date(certificate.certificate.issuedAt).toLocaleDateString("en-IN")}</p></div></body></html>` : "", [certificate]);
  const print = async () => { try { await Print.printAsync({ html }); } catch (error) { Alert.alert("Export unavailable", error instanceof Error ? error.message : "Please try again."); } };
  if (query.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={COLORS.indigo} /></ScreenContainer>;
  if (query.isError || !certificate) return <ScreenContainer className="items-center justify-center px-5"><Text style={styles.error}>Certificate unavailable or not owned by this account.</Text><PrimaryButton label="Back to certificates" icon="arrow-back" onPress={() => router.back()} /></ScreenContainer>;
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>Certificate</Text><Text style={styles.badge}>VERIFIED</Text></View>{Platform.OS === "web" ? <View style={styles.webCard}><Text style={styles.webTitle}>Certificate of Completion</Text><Text style={styles.webName}>{certificate.recipientName ?? "Student"}</Text><Text style={styles.webCourse}>{certificate.courseTitle}</Text><Text style={styles.webCode}>{certificate.certificate.certificateCode}</Text></View> : <WebView source={{ html }} style={styles.viewer} originWhitelist={["about:blank"]} javaScriptEnabled={false} />}{Platform.OS === "web" ? <PrimaryButton label="Print / Save as PDF" icon="print" onPress={() => void print()} /> : <PrimaryButton label="Print / Save as PDF" icon="print" onPress={() => void print()} />}</ScreenContainer>;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char)); }

const styles = StyleSheet.create({ header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.line }, back: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.indigoSoft, alignItems: "center", justifyContent: "center" }, backText: { color: COLORS.indigo, fontSize: 30, lineHeight: 30, marginTop: -3 }, title: { flex: 1, color: COLORS.ink, fontSize: 16, fontWeight: "900" }, badge: { color: COLORS.green, fontSize: 9, fontWeight: "900" }, viewer: { flex: 1, marginVertical: 12, backgroundColor: COLORS.paper }, webCard: { flex: 1, margin: 20, borderWidth: 6, borderColor: COLORS.indigo, backgroundColor: COLORS.paper, justifyContent: "center", alignItems: "center", padding: 24, gap: 14 }, webTitle: { color: COLORS.indigo, fontSize: 26, fontWeight: "900", textAlign: "center" }, webName: { color: COLORS.ink, fontSize: 25, fontWeight: "900" }, webCourse: { color: COLORS.muted, fontSize: 18, textAlign: "center" }, webCode: { color: COLORS.earth, fontSize: 12 }, error: { color: COLORS.muted, textAlign: "center", marginBottom: 15 } });
