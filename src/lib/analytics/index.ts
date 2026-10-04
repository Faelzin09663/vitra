// Portable pure analytics: shared by the UI and the server, no browser/database dependencies.
export type AnalyticsSet = {
  load: number;
  reps: number;
  done: boolean;
  type?: string;
};
export type AnalyticsExercise = { name: string; exerciseId?: string };
export type AnalyticsLog = {
  date: string;
  at?: string;
  deload?: boolean;
  exercises: AnalyticsExercise[];
  sets: Record<string, AnalyticsSet>;
};
export type AnalyticsCatalog = {
  id: string;
  name: string;
  aliases: string[];
  muscleGroup: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  movementPattern: string;
};
export const ANALYTICS_LIMITS = {
  minPlateauSessions: 4,
  minPlateauSpanDays: 21,
  windowDays: 21,
  improvement: 0.01,
  minBalanceWeeks: 2,
  minWeeklySets: 8,
  maxWeeklySets: 25,
  imbalanceRatio: 2,
  dismissDays: 28,
} as const;
export function estimate1RM(load: number, reps: number): number | null {
  return Number.isFinite(load) &&
    load > 0 &&
    Number.isInteger(reps) &&
    reps >= 1 &&
    reps <= 12
    ? reps === 1
      ? load
      : load * (1 + reps / 30)
    : null;
}
export function effective(set: AnalyticsSet) {
  return (
    set.done &&
    set.type !== "aquecimento" &&
    Number.isFinite(set.load) &&
    set.load >= 0 &&
    Number.isInteger(set.reps) &&
    set.reps > 0
  );
}
export function setVolume(set: AnalyticsSet) {
  return effective(set) ? set.load * set.reps : 0;
}
const normalized = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function isoDate(date: string) {
  return date.includes("/") ? date.split("/").reverse().join("-") : date;
}
const dayTime = (date: string) => Date.parse(isoDate(date) + "T00:00:00Z");
export function exercisePerformance(log: AnalyticsLog, index: number) {
  const sets = Object.entries(log.sets)
    .filter(([key]) => key.startsWith(`${index}-`))
    .map(([, set]) => set)
    .filter(effective);
  return {
    volume: sets.reduce((sum, s) => sum + setVolume(s), 0),
    best1RM:
      Math.max(0, ...sets.map((s) => estimate1RM(s.load, s.reps) || 0)) || null,
    bestLoad: Math.max(0, ...sets.map((s) => s.load)),
    effectiveSets: sets.length,
  };
}
export function sessionPerformance(log: AnalyticsLog) {
  const byExercise = log.exercises.map((exercise, i) => ({
    exercise,
    ...exercisePerformance(log, i),
  }));
  return {
    byExercise,
    volume: byExercise.reduce((sum, e) => sum + e.volume, 0),
    best1RM: Math.max(0, ...byExercise.map((e) => e.best1RM || 0)) || null,
  };
}
export function detectPlateaus(logs: AnalyticsLog[], today: string) {
  const now = dayTime(today),
    cutoff = now - 20 * 86400000,
    start = now - 41 * 86400000;
  const groups = new Map<
    string,
    { name: string; exerciseId?: string; date: number; best: number }[]
  >();
  for (const log of logs) {
    const time = dayTime(log.date);
    if (log.deload || time < start || time > now || !Number.isFinite(time))
      continue;
    log.exercises.forEach((ex, i) => {
      const best = exercisePerformance(log, i).best1RM;
      if (!best) return;
      const id = normalized(
        ex.exerciseId ? ex.exerciseId.replace(/-/g, " ") : ex.name,
      );
      const entries = groups.get(id) || [];
      const previous = entries.find((e) => e.date === time);
      if (previous) previous.best = Math.max(previous.best, best);
      else
        entries.push({
          name: ex.name,
          exerciseId: ex.exerciseId,
          date: time,
          best,
        });
      groups.set(id, entries);
    });
  }
  return [...groups].flatMap(([key, all]) => {
    const recent = all.filter((r) => r.date >= cutoff),
      previous = all.filter((r) => r.date < cutoff),
      span =
        (Math.max(...all.map((r) => r.date)) -
          Math.min(...all.map((r) => r.date))) /
        86400000;
    if (all.length < 4 || span < 21 || recent.length < 2 || previous.length < 2)
      return [];
    const before = Math.max(...previous.map((r) => r.best)),
      after = Math.max(...recent.map((r) => r.best));
    if (after > before * 1.01) return [];
    const baseline = previous
      .filter((r) => r.best === before)
      .sort((a, b) => a.date - b.date)[0];
    return [
      {
        key,
        name: all.at(-1)!.name,
        exerciseId: all.at(-1)!.exerciseId,
        before,
        after,
        sessions: all.length,
        stalledDays: Math.round((now - baseline.date) / 86400000),
        from: new Date(start).toISOString().slice(0, 10),
        to: today,
      },
    ];
  });
}
export function weeklyMuscleBalance(
  logs: AnalyticsLog[],
  catalog: AnalyticsCatalog[],
  today: string,
  min = 8,
  max = 25,
) {
  const now = dayTime(today),
    start = now - 27 * 86400000,
    total: Record<string, number> = {},
    weeks = new Set<string>();
  let push = 0,
    pull = 0,
    upper = 0,
    lower = 0,
    known = 0,
    unknown = 0;
  for (const log of logs) {
    const time = dayTime(log.date);
    if (time < start || time > now || !Number.isFinite(time)) continue;
    const date = new Date(time),
      weekday = (date.getUTCDay() + 6) % 7;
    weeks.add(new Date(time - weekday * 86400000).toISOString().slice(0, 10));
    log.exercises.forEach((ex, i) => {
      const n = exercisePerformance(log, i).effectiveSets;
      if (!n) return;
      const entry = catalog.find((c) =>
        ex.exerciseId
          ? c.id === ex.exerciseId
          : [c.name, ...c.aliases].some(
              (name) => normalized(name) === normalized(ex.name),
            ),
      );
      if (!entry) {
        unknown += n;
        return;
      }
      known += n;
      total[entry.primaryMuscle] = (total[entry.primaryMuscle] || 0) + n;
      for (const muscle of new Set(
        entry.secondaryMuscles.filter((m) => m !== entry.primaryMuscle),
      ))
        total[muscle] = (total[muscle] || 0) + n * 0.5;
      if (entry.movementPattern.startsWith("empurrar")) push += n;
      if (entry.movementPattern.startsWith("puxar")) pull += n;
      if (
        ["quadríceps", "posterior", "glúteos", "panturrilha"].includes(
          entry.muscleGroup,
        )
      )
        lower += n;
      else if (
        !["abdômen", "lombar", "corpo inteiro"].includes(entry.muscleGroup)
      )
        upper += n;
    });
  }
  const elapsedWeeks = 4,
    weekly = Object.fromEntries(
      [...new Set(catalog.map((c) => c.muscleGroup))].map((group) => [
        group,
        (total[group] || 0) / elapsedWeeks,
      ]),
    );
  const enough = weeks.size >= 2 && known > 0;
  const alerts: string[] = [];
  if (enough) {
    if (push > 0 && (pull === 0 || push / pull >= 2))
      alerts.push(
        `Você fez ${pull ? (push / pull).toFixed(1) : "somente"} empurrar em relação a puxar: ${push} / ${pull} séries em 4 semanas.`,
      );
    if (upper > 0 && (lower === 0 || upper / lower >= 2))
      alerts.push(
        `Superior / inferior: ${upper} / ${lower} séries em 4 semanas. Considere revisar a distribuição de pernas.`,
      );
    for (const [group, n] of Object.entries(weekly))
      if (n < min || n > max)
        alerts.push(
          `${group}: ${n.toFixed(1)} séries efetivas por semana; faixa configurada ${min}–${max}.`,
        );
  }
  return {
    weekly,
    total,
    push,
    pull,
    upper,
    lower,
    known,
    unknown,
    weeks: weeks.size,
    enough,
    alerts,
    from: new Date(start).toISOString().slice(0, 10),
    to: today,
  };
}
export function alertsDismissed(until: string | undefined, today: string) {
  return Boolean(until && until > today);
}
export function dismissUntil(today: string) {
  return new Date(dayTime(today) + 28 * 86400000).toISOString().slice(0, 10);
}
