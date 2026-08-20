function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export type GuardianProgressPdfReport = {
  studentName: string;
  guardianName: string;
  generatedAt: Date;
  summary: { activeCourseCount: number; overallProgressPercent: number; currentStreakDays: number; guidance: string };
};

/** The report intentionally contains aggregate learning progress only. */
export function buildGuardianProgressPdfHtml(report: GuardianProgressPdfReport) {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#14213D;padding:28px;line-height:1.5}h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:24px 0 8px;color:#273A67}.sub{color:#667085;font-size:12px}.metrics{display:flex;gap:10px;margin-top:18px}.metric{flex:1;border:1px solid #C9D3EC;border-radius:12px;padding:12px;background:#F7F9FF}.value{font-size:24px;font-weight:800;color:#273A67}.label{font-size:10px;font-weight:800;color:#667085;letter-spacing:.5px}p{font-size:13px;color:#475467}.notice{margin-top:18px;padding:12px;border-radius:12px;background:#F4FBF7;color:#137A4B;font-size:12px}</style></head><body><h1>Parent/Guardian Progress Report</h1><p class="sub">Learner: ${escapeHtml(report.studentName)} · Prepared for: ${escapeHtml(report.guardianName)}<br/>Generated ${escapeHtml(report.generatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))}</p><div class="metrics"><div class="metric"><div class="value">${report.summary.activeCourseCount}</div><div class="label">ACTIVE COURSES</div></div><div class="metric"><div class="value">${report.summary.overallProgressPercent}%</div><div class="label">OVERALL PROGRESS</div></div><div class="metric"><div class="value">${report.summary.currentStreakDays}</div><div class="label">CURRENT STUDY STREAK</div></div></div><h2>Encouragement</h2><p>${escapeHtml(report.summary.guidance)}</p><div class="notice">This consented report contains aggregate progress only. It does not include assessment answers or marks, AI Quiz topics or results, personal notes, downloads, messages, or the learner’s private Study Coach plan.</div></body></html>`;
}
