import type { Exercise, SetRecord, Store } from "./store.ts";
import { nutritionEstimates } from "./nutrition.ts";
export type EnergyEstimate = {
  method: "met-v1";
  weightKg: number;
  minutes: number;
  met: number;
  grossKcal: number;
  netKcal: number;
  exercises?: {
    index: number;
    name: string;
    minutes: number;
    netKcal: number;
  }[];
};
export function metEnergy(
  weight: number | null,
  minutes: number,
  met: number,
): EnergyEstimate | null {
  if (
    weight === null ||
    !Number.isFinite(weight) ||
    weight < 1 ||
    weight > 500 ||
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    minutes > 360 ||
    !Number.isFinite(met) ||
    met <= 1 ||
    met > 20
  )
    return null;
  const factor = (3.5 * weight * minutes) / 200;
  return {
    method: "met-v1",
    weightKg: weight,
    minutes,
    met,
    grossKcal: Math.round(met * factor),
    netKcal: Math.round((met - 1) * factor),
  };
}
export function workoutEnergy(
  exercises: Exercise[],
  sets: Record<string, SetRecord>,
  seconds: number,
  weight: number | null,
  met = 3.5,
): EnergyEstimate | null {
  const counts = exercises.map((ex, i) =>
    Array.from({ length: ex.sets }, (_, j) =>
      sets[`${i}-${j}`]?.done ? 1 : 0,
    ).reduce<number>((a, b) => a + b, 0),
  );
  const total = counts.reduce((a, b) => a + b, 0);
  const energy = metEnergy(weight, seconds / 60, met);
  if (!energy || !total) return null;
  let assigned = 0;
  let cumulative = 0;
  const completed = counts
    .map((count, index) => ({ count, index }))
    .filter((x) => x.count > 0);
  return {
    ...energy,
    exercises: completed.map(({ count, index }, position) => {
      cumulative += count;
      const netKcal =
        position === completed.length - 1
          ? energy.netKcal - assigned
          : Math.round((energy.netKcal * cumulative) / total) - assigned;
      assigned += netKcal;
      return {
        index,
        name: exercises[index].name,
        minutes: (energy.minutes * count) / total,
        netKcal,
      };
    }),
  };
}
export function cardioEnergy(
  activity: string,
  minutes: number,
  weight: number | null,
) {
  const key = activity
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const met =
    key === "caminhada"
      ? 3.8
      : key === "corrida"
        ? 7.5
        : key === "bicicleta"
          ? 7
          : null;
  return met === null ? null : metEnergy(weight, minutes, met);
}
function sameDay(a: string, b: string) {
  const iso = (value: string) =>
    /^\d{2}\/\d{2}\/\d{4}$/.test(value)
      ? value.split("/").reverse().join("-")
      : value;
  return iso(a) === iso(b);
}
export function energyBudget(store: Store) {
  const profile = store.profile,
    weight = store.weights.at(-1)?.value ?? null;
  const estimates = nutritionEstimates(profile, weight);
  const logged = profile.energyBasis === "logged";
  const base =
    logged && estimates.basal !== null
      ? Math.round(estimates.basal * 1.2)
      : estimates.daily;
  const workouts = store.workoutLogs.filter((log) =>
    sameDay(log.date, store.day),
  );
  const cardio = store.cardioEntries.filter((entry) =>
    sameDay(entry.date, store.day),
  );
  // Only saved snapshots count; old records are never re-estimated using today's weight.
  const workoutKcal = workouts.reduce(
    (sum, log) => sum + (log.energy?.netKcal || 0),
    0,
  );
  const cardioKcal = cardio.reduce(
    (sum, entry) => sum + (entry.energy?.netKcal || 0),
    0,
  );
  const exerciseKcal = workoutKcal + cardioKcal;
  const requestedCredit = profile.exerciseCreditPct ?? 50;
  const creditPct = [0, 50, 100].includes(requestedCredit)
    ? requestedCredit
    : 50;
  const credit =
    logged && profile.calorieMode === "automatic"
      ? Math.round((exerciseKcal * creditPct) / 100)
      : 0;
  const requested = profile.deficitKcal ?? 250;
  const deficit =
    profile.calorieObjective === "deficit" &&
    base !== null &&
    estimates.bmi !== null &&
    estimates.bmi >= 18.5 &&
    Number.isFinite(requested)
      ? Math.round(Math.min(Math.max(0, requested), 500, base * 0.2))
      : 0;
  const rawGoal =
    base === null ? null : Math.max(estimates.basal!, base + credit - deficit);
  const target =
    profile.calorieMode === "automatic" && rawGoal !== null
      ? Math.round(rawGoal)
      : store.calorieGoal;
  const consumed = store.meals.reduce((sum, meal) => sum + meal.calories, 0);
  return {
    base,
    workoutKcal,
    cardioKcal,
    exerciseKcal,
    credit,
    creditPct,
    deficit: rawGoal !== null && base !== null ? base + credit - rawGoal : 0,
    target,
    consumed,
    remaining: target - consumed,
    logged,
    automatic: profile.calorieMode === "automatic",
    missingActivities:
      workouts.filter((l) => !l.energy).length +
      cardio.filter((e) => !e.energy).length,
  };
}
