function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export type StudyCoachReport = {
  generatedAt: Date;
  activeCourseCount: number;
  overallProgressPercent: number;
  currentStreakDays: number;
  dailyPlan: Array<{ title: string; detail: string }>;
  weakTopics: Array<{ label: string; reason: string }>;
  revisionPriorities: Array<{ title: string; detail: string }>;
};

export function buildStudyCoachReportHtml(report: StudyCoachReport) {
  const list = (items: Array<{ title?: string; label?: string; detail?: string; reason?: string }>, empty: string) => items.length ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.title ?? item.label ?? "Study item")}</strong><br/><span>${escapeHtml(item.detail ?? item.reason ?? "")}</span></li>`).join("")}</ul>` : `<p>${escapeHtml(empty)}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#14213D;padding:28px;line-height:1.5}h1{font-size:27px;margin:0 0 4px}h2{font-size:17px;margin:24px 0 8px;color:#273A67}.sub{color:#667085;font-size:12px}.metrics{display:flex;gap:10px;margin-top:18px}.metric{flex:1;border:1px solid #C9D3EC;border-radius:12px;padding:12px;background:#F7F9FF}.value{font-size:24px;font-weight:800;color:#273A67}.label{font-size:10px;font-weight:800;color:#667085;letter-spacing:.5px}ul{padding-left:20px}li{margin:9px 0}span,p{font-size:13px;color:#475467}</style></head><body><h1>Study Coach Report</h1><p class="sub">Prepared ${escapeHtml(report.generatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))} · Private learner report</p><div class="metrics"><div class="metric"><div class="value">${report.activeCourseCount}</div><div class="label">ACTIVE COURSES</div></div><div class="metric"><div class="value">${report.overallProgressPercent}%</div><div class="label">OVERALL PROGRESS</div></div><div class="metric"><div class="value">${report.currentStreakDays}</div><div class="label">DAY STREAK</div></div></div><h2>Today’s plan</h2>${list(report.dailyPlan, "No action is waiting yet. Open My Learning to continue a published course.")}<h2>Weak-topic insights</h2>${list(report.weakTopics, "No weak topics have been detected from saved private practice yet.")}<h2>Revision priorities</h2>${list(report.revisionPriorities, "Complete a lesson, assessment, or private AI Quiz to receive revision priorities.")}<p class="sub">This report is generated from your own saved learning activity. It is stored only in your protected offline library on the Android or iOS app.</p></body></html>`;
}
