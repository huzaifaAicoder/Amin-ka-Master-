export type AiQuizPdfQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

function optionLabel(question: AiQuizPdfQuestion, optionIndex: number | undefined) {
  if (typeof optionIndex !== "number" || !question.options[optionIndex]) return "No answer selected";
  return `${String.fromCharCode(65 + optionIndex)}. ${question.options[optionIndex]}`;
}

export function buildAiQuizResultsPdfHtml(input: {
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  questions: AiQuizPdfQuestion[];
  answers: Record<number, number>;
  score: number;
  scorePercent: number;
  completedAt?: Date;
}) {
  const missed = input.questions.map((question, index) => ({ question, index, selectedIndex: input.answers[index] })).filter((item) => item.selectedIndex !== item.question.correctIndex);
  const details = missed.length ? missed.map(({ question, index, selectedIndex }) => `<section class="missed"><p class="kicker">QUESTION ${index + 1} · REVIEW</p><h2>${escapeHtml(question.question)}</h2><div class="answer wrong"><strong>Your answer</strong><p>${escapeHtml(optionLabel(question, selectedIndex))}</p></div><div class="answer correct"><strong>Correct answer</strong><p>${escapeHtml(optionLabel(question, question.correctIndex))}</p></div><div class="explanation"><p class="kicker">AI EXPLANATION</p><p>${escapeHtml(question.explanation)}</p></div></section>`).join("") : `<section class="mastered"><h2>All answers correct</h2><p>Excellent work. You did not miss any questions in this private practice set.</p></section>`;
  const completedAt = (input.completedAt ?? new Date()).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>@page{margin:28px}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#14213d;background:#fff;font-size:13px;line-height:1.5}.header{border:3px solid #14213d;padding:20px 22px;background:#f8f5ed}.brand{color:#b15d22;font-size:10px;font-weight:700;letter-spacing:2px}.title{font-size:27px;margin:7px 0}.meta{color:#596579;margin:2px 0}.score{margin-top:14px;padding:13px;background:#14213d;color:#fff}.score strong{font-size:24px}.section-title{font-size:18px;margin:24px 0 10px}.missed{border:1px solid #fecaca;border-radius:10px;padding:15px;margin:0 0 14px;page-break-inside:avoid}.missed h2{font-size:16px;margin:4px 0 12px}.kicker{text-transform:uppercase;letter-spacing:1px;font-size:9px;font-weight:700;margin:0 0 4px}.answer{padding:9px 11px;border-radius:7px;margin:8px 0}.answer strong{font-size:10px;text-transform:uppercase;letter-spacing:.7px}.answer p{margin:3px 0 0}.wrong{background:#fff1f2;color:#b42318}.correct{background:#ecfdf3;color:#067647}.explanation{background:#eef3ff;border-left:4px solid #14213d;padding:10px 12px;margin-top:10px}.explanation p:last-child{margin:4px 0 0}.mastered{padding:18px;border:1px solid #abe2c4;border-radius:10px;background:#f4fbf7}.mastered h2{color:#067647;margin:0 0 5px}.mastered p{margin:0}.footer{margin-top:25px;border-top:1px solid #d0d5dd;padding-top:10px;color:#667085;font-size:10px}</style></head><body><header class="header"><p class="brand">AMIN KA MASTER · PRIVATE PRACTICE</p><h1 class="title">AI Quiz Detailed Results</h1><p class="meta"><strong>Topic:</strong> ${escapeHtml(input.topic)}</p><p class="meta"><strong>Difficulty:</strong> ${escapeHtml(input.difficulty)}</p><p class="meta"><strong>Completed:</strong> ${escapeHtml(completedAt)}</p><div class="score"><strong>${input.score}/${input.questions.length} · ${input.scorePercent}%</strong><br />Private practice result · not an official exam result</div></header><h2 class="section-title">${missed.length ? `${missed.length} answer${missed.length === 1 ? "" : "s"} to review` : "Mastery review"}</h2>${details}<footer class="footer">This PDF was generated on your device from your private Amin Ka Master AI Quiz. AI explanations are educational guidance for this practice set.</footer></body></html>`;
}
