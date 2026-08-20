import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type DeveloperAuditRecord = {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: Date | string;
  metadata: unknown;
};

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildDeveloperAuditCsv(records: DeveloperAuditRecord[]) {
  const header = ["Audit ID", "Occurred at", "Actor", "Actor email", "Action", "Entity type", "Entity ID", "Metadata"];
  const rows = records.map((record) => [
    record.id,
    new Date(record.createdAt).toISOString(),
    record.actorName ?? "System",
    record.actorEmail ?? "",
    record.action,
    record.entityType,
    record.entityId ?? "",
    record.metadata ? JSON.stringify(record.metadata) : "",
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function exportDeveloperAuditCsv(records: DeveloperAuditRecord[]) {
  const csv = buildDeveloperAuditCsv(records);
  const filename = `amin-ka-master-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return { destination: "browser" as const };
  }
  if (!FileSystem.cacheDirectory) throw new Error("Local export storage is unavailable on this device.");
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) throw new Error("The device share sheet is unavailable for CSV export.");
  await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Export Developer audit log" });
  return { destination: "share_sheet" as const };
}
