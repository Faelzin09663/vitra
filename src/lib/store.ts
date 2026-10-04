import { uid } from './uid';
import type { AIPreferences } from '../../supabase/functions/_shared/ai-consent';
export type Meal = { name: string; calories: number; protein: number; carbs: number; fat: number; estimated?: boolean; notes?: string; analyzedBy?: string; foods?: { name: string; portion: string }[]; confidence?: 'low' | 'medium' | 'high' };
import { emptyProfile, nutritionEstimates, type PersonalProfile } from './nutrition';
export type Exercise = { name: string; exerciseId?: string; sets: number; reps: string; restSeconds?: number; replacedFrom?: string; replaceReason?: string };
export type Workout = { id: string; name: string; focus: string; weekdays: number[]; exercises: Exercise[] };
export type SetRecord = { load: number; reps: number; done: boolean; type?: 'normal'|'aquecimento'|'drop'|'falha' };
export type WaterEntry = { id: string; date: string; at: string; amount: number };
export type CardioEntry = { id: string; date: string; at: string; activity: string; minutes: number; distanceKm?: number };
export type ActiveWorkout = { startedAt: string; pausedAt: string | null; pausedMs: number; restUntil: string | null; workoutId?: string; name?: string; focus?: string; exercises?: Exercise[] };
export type WeightEntry = { date: string; value: number; workout?: string; workoutMinutes?: number; cardioKm?: number; note?: string };
export type WorkoutLog = { id: string; date: string; at: string; name: string; workoutId?: string; deload?: boolean; exercises: Exercise[]; sets: Record<string, SetRecord>; durationSeconds?: number };
export type Store = {
  day: string; week: string; water: number; waterGoal: number; calorieGoal: number; cardioGoal: number; cardio: number;
  meals: Meal[]; weights: WeightEntry[]; exercises: Exercise[];
  sets: Record<string, SetRecord>; sessions: string[];
  waterEntries: WaterEntry[]; cardioEntries: CardioEntry[]; workoutLogs: WorkoutLog[];
  cardioKm: number; cardioGoalKm: number; activeWorkout: ActiveWorkout | null;
  profile: PersonalProfile; workouts: Workout[]; selectedWorkoutId: string;
  preferences: AIPreferences;
};
export function dates(now = new Date()) {
  const monday = new Date(now);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return { day: now.toLocaleDateString('pt-BR'), week: monday.toLocaleDateString('pt-BR') };
}
export function createInitialStore(now = new Date()): Store {
  const exercises: Exercise[] = [
    { name: 'Supino reto', sets: 3, reps: '8–12' }, { name: 'Supino inclinado com halteres', sets: 3, reps: '10–12' },
    { name: 'Desenvolvimento de ombros', sets: 3, reps: '10–12' }, { name: 'Elevação lateral', sets: 3, reps: '12–15' }, { name: 'Tríceps na polia', sets: 3, reps: '10–12' },
  ];
  return { ...dates(now), water: 0, waterGoal: 2500, calorieGoal: 2200, cardioGoal: 150, cardio: 0, cardioKm: 0, cardioGoalKm: 15, activeWorkout: null, preferences: { ai_consent: null }, meals: [], weights: [], sets: {}, sessions: [], waterEntries: [], cardioEntries: [], workoutLogs: [], profile: { ...emptyProfile }, selectedWorkoutId: 'workout-a', workouts: [{ id: 'workout-a', name: 'Treino A', focus: 'Peito, ombros e tríceps', weekdays: [], exercises }], exercises };
}
export function normalizeStore(saved: Store, now = new Date()): Store {
  const initial = createInitialStore(now);
  const workouts = saved.workouts?.length ? saved.workouts : [{ ...initial.workouts[0], exercises: saved.exercises || initial.exercises }];
  const normalized = { ...initial, ...saved, preferences: { ...saved.preferences, ai_consent: saved.preferences?.ai_consent ?? null }, profile: { ...emptyProfile, ...saved.profile }, workouts, selectedWorkoutId: workouts.some(w => w.id === saved.selectedWorkoutId) ? saved.selectedWorkoutId : workouts[0].id,
    ...(saved.day !== initial.day ? { day: initial.day, water: 0, meals: [], sets: saved.activeWorkout ? saved.sets : {} } : {}),
    ...(saved.week !== initial.week ? { week: initial.week, cardio: 0, cardioKm: 0 } : {}),
  };
  if (normalized.activeWorkout && !normalized.activeWorkout.workoutId) normalized.activeWorkout = { ...normalized.activeWorkout, workoutId: workouts[0].id, name: workouts[0].name, focus: workouts[0].focus, exercises: structuredClone(saved.exercises || workouts[0].exercises) };
  return { ...normalized, ...automaticCalories(normalized) };
}
export function addWater(store: Store, amount: number, now = new Date()): Partial<Store> {
  const actual = Math.max(-store.water, amount);
  return { water: store.water + actual, waterEntries: [...store.waterEntries, { id: uid(), date: dates(now).day, at: now.toISOString(), amount: actual }] };
}
export function addCardio(store: Store, activity: string, minutes: number, now = new Date(), distanceKm = 0): Partial<Store> {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(minutes) || minutes < 0) throw new Error('Informe uma distância e duração válidas.');
  return { cardio: store.cardio + minutes, cardioKm: Math.round((store.cardioKm + distanceKm) * 1000) / 1000, cardioEntries: [...store.cardioEntries, { id: uid(), date: dates(now).day, at: now.toISOString(), activity, minutes, distanceKm }] };
}
export function finishWorkout(store: Store, now = new Date()): Partial<Store> {
  const day = dates(now).day;
  return { sessions: [...new Set([...store.sessions, day])], activeWorkout: null, sets: {}, workoutLogs: [...store.workoutLogs, { id: uid(), date: day, at: now.toISOString(), workoutId: store.activeWorkout?.workoutId, name: store.activeWorkout?.name || currentWorkout(store).name, durationSeconds: elapsedSeconds(store.activeWorkout, now.getTime()), exercises: structuredClone(store.activeWorkout?.exercises || currentWorkout(store).exercises), sets: structuredClone(store.sets) }] };
}
export function startWorkout(store: Store, now = new Date()): Partial<Store> {
  const workout = currentWorkout(store);
  return store.activeWorkout ? {} : { sets: {}, activeWorkout: { startedAt: now.toISOString(), pausedAt: null, pausedMs: 0, restUntil: null, workoutId: workout.id, name: workout.name, focus: workout.focus, exercises: structuredClone(workout.exercises) } };
}
export function elapsedSeconds(active: ActiveWorkout | null, now = Date.now()): number {
  if (!active) return 0;
  return Math.max(0, Math.floor(((active.pausedAt ? Date.parse(active.pausedAt) : now) - Date.parse(active.startedAt) - active.pausedMs) / 1000));
}
export function toggleWorkoutPause(active: ActiveWorkout, now = new Date()): ActiveWorkout {
  return active.pausedAt ? { ...active, pausedAt: null, pausedMs: active.pausedMs + Math.max(0, now.getTime() - Date.parse(active.pausedAt)) } : { ...active, pausedAt: now.toISOString() };
}
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = Math.floor(seconds % 60);
  return `${h ? `${String(h).padStart(2, '0')}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function localDateKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function weightReminder(weights: WeightEntry[], now = new Date()) {
  const parse = (day: string) => { const [d, m, y] = day.split('/').map(Number); return Date.UTC(y, m - 1, d); };
  const last = weights.slice().sort((a, b) => parse(b.date) - parse(a.date))[0];
  if (!last) return { due: true, next: dates(now).day, daysRemaining: 0 };
  const next = parse(last.date) + 3 * 86400000;
  const remaining = Math.ceil((next - parse(dates(now).day)) / 86400000);
  return { due: remaining <= 0, next: new Date(next).toLocaleDateString('pt-BR', { timeZone: 'UTC' }), daysRemaining: Math.max(0, remaining) };
}
export function addWeight(store: Store, value: number, day: string, note = ''): Partial<Store> {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Informe um peso válido.');
  const logs = store.workoutLogs.filter(log => log.date === day);
  const entry: WeightEntry = { date: day, value, note: note.trim(), workout: logs.length ? logs.map(l => l.name).join(', ') : store.activeWorkout && day === store.day ? `${store.activeWorkout.name || currentWorkout(store).name} em andamento` : 'Sem treino registrado', workoutMinutes: Math.round(logs.reduce((s, l) => s + (l.durationSeconds || 0), 0) / 60), cardioKm: store.cardioEntries.filter(e => e.date === day).reduce((s, e) => s + (e.distanceKm || 0), 0) };
  const weights = [...store.weights.filter(w => w.date !== day), entry].sort((a, b) => { const parse = (d: string) => d.split('/').reverse().join('-'); return parse(a.date).localeCompare(parse(b.date)); });
  return { weights, ...automaticCalories({ ...store, weights }) };
}
export function currentWorkout(store: Store): Workout { return store.workouts.find(w => w.id === store.selectedWorkoutId) || store.workouts[0]; }
export function automaticCalories(store: Store): Partial<Store> {
  if (store.profile.calorieMode !== 'automatic') return {};
  const daily = nutritionEstimates(store.profile, store.weights.at(-1)?.value ?? null).daily;
  return daily ? { calorieGoal: daily } : {};
}
export function saveProfile(store: Store, profile: PersonalProfile, weight: number | null): Partial<Store> {
  const patch = weight !== null && weight !== store.weights.at(-1)?.value ? addWeight({ ...store, profile }, weight, dates().day, 'Atualizado pelo perfil') : {};
  const next = { ...store, ...patch, profile };
  return { ...patch, profile, ...automaticCalories(next) };
}
export function saveWorkout(store: Store, workout: Workout): Partial<Store> {
  const workouts = store.workouts.some(w => w.id === workout.id) ? store.workouts.map(w => w.id === workout.id ? workout : w) : [...store.workouts, workout];
  return { workouts, selectedWorkoutId: workout.id };
}
export function removeWorkout(store: Store, id: string): Partial<Store> {
  if (store.workouts.length <= 1 || store.activeWorkout?.workoutId === id) return {};
  const workouts = store.workouts.filter(w => w.id !== id);
  return { workouts, selectedWorkoutId: store.selectedWorkoutId === id ? workouts[0].id : store.selectedWorkoutId };
}
export function appendExercise(store: Store, exercise: Exercise): Partial<Store> {
  const id = store.activeWorkout?.workoutId || store.selectedWorkoutId;
  const workouts = store.workouts.map(w => w.id === id ? { ...w, exercises: [...w.exercises, exercise] } : w);
  return { workouts, ...(store.activeWorkout ? { activeWorkout: { ...store.activeWorkout, exercises: [...(store.activeWorkout.exercises || currentWorkout(store).exercises), exercise] } } : {}) };
}
export function scheduledWorkout(store: Store, now = new Date()): Workout {
  const selected = currentWorkout(store);
  return selected.weekdays.includes(now.getDay()) ? selected : store.workouts.find(w => w.weekdays.includes(now.getDay())) || selected;
}
