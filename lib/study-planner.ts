import AsyncStorage from "@react-native-async-storage/async-storage";

const plannerKey = (userId: number) => `amin-ka-master.study-planner.${userId}.v1`;
const learningTimeKey = (userId: number) => `amin-ka-master.learning-time.${userId}.v1`;

export type ManualStudyTask = { id: string; title: string; detail: string; completed: boolean; createdAt: string; updatedAt: string };
export type WeeklyLearningTime = { dayKey: string; label: string; seconds: number };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const dayLabel = (date: Date) => date.toLocaleDateString("en-IN", { weekday: "short" });

export async function loadManualStudyTasks(userId: number): Promise<ManualStudyTask[]> {
  try { const value = await AsyncStorage.getItem(plannerKey(userId)); const parsed = value ? JSON.parse(value) : []; return Array.isArray(parsed) ? parsed.filter((task): task is ManualStudyTask => Boolean(task && typeof task.id === "string" && typeof task.title === "string" && typeof task.detail === "string" && typeof task.completed === "boolean")).slice(0, 30) : []; } catch { return []; }
}

async function saveManualStudyTasks(userId: number, tasks: ManualStudyTask[]) {
  await AsyncStorage.setItem(plannerKey(userId), JSON.stringify(tasks.slice(0, 30)));
  return tasks.slice(0, 30);
}

export async function upsertManualStudyTask(userId: number, input: { id?: string; title: string; detail: string; completed?: boolean }) {
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new Error("Add a task title first.");
  const tasks = await loadManualStudyTasks(userId); const now = new Date().toISOString();
  const next = input.id ? tasks.map((task) => task.id === input.id ? { ...task, title, detail: input.detail.trim().slice(0, 240), completed: input.completed ?? task.completed, updatedAt: now } : task) : [{ id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, detail: input.detail.trim().slice(0, 240), completed: Boolean(input.completed), createdAt: now, updatedAt: now }, ...tasks];
  return saveManualStudyTasks(userId, next);
}

export async function removeManualStudyTask(userId: number, id: string) { return saveManualStudyTasks(userId, (await loadManualStudyTasks(userId)).filter((task) => task.id !== id)); }

export async function recordLearningSeconds(userId: number, seconds: number) {
  const bounded = Math.min(Math.max(Math.round(seconds), 0), 10_800); if (bounded < 30) return;
  try { const value = await AsyncStorage.getItem(learningTimeKey(userId)); const parsed = value ? JSON.parse(value) : {}; const key = dateKey(new Date()); const next = { ...(parsed && typeof parsed === "object" ? parsed : {}), [key]: Math.min(Number((parsed as Record<string, number>)?.[key] ?? 0) + bounded, 86_400) }; await AsyncStorage.setItem(learningTimeKey(userId), JSON.stringify(next)); } catch { /* Local wellbeing data is optional; never block lesson delivery. */ }
}

export async function loadWeeklyLearningTime(userId: number): Promise<WeeklyLearningTime[]> {
  let stored: Record<string, number> = {}; try { const value = await AsyncStorage.getItem(learningTimeKey(userId)); const parsed = value ? JSON.parse(value) : {}; if (parsed && typeof parsed === "object") stored = parsed; } catch { /* Return zero history below. */ }
  return Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); const key = dateKey(date); return { dayKey: key, label: dayLabel(date), seconds: Math.max(0, Number(stored[key] ?? 0)) }; });
}
