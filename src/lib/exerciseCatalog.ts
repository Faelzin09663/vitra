import {
  exercises,
  normalizeText,
  type CatalogExercise,
  type Equipment,
  type Muscle,
  type Pattern,
} from "../data/exercises";
import type { Exercise } from "./store";
export function searchExercises(
  catalog: CatalogExercise[],
  query = "",
  filters: { muscle?: Muscle; equipment?: Equipment; pattern?: Pattern } = {},
) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  return catalog.filter(
    (ex) =>
      (!filters.muscle || ex.muscleGroup === filters.muscle) &&
      (!filters.equipment || ex.equipment === filters.equipment) &&
      (!filters.pattern || ex.movementPattern === filters.pattern) &&
      terms.every((term) =>
        [ex.name, ...ex.aliases].some((name) =>
          normalizeText(name).includes(term),
        ),
      ),
  );
}
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    row = next;
  }
  return row[b.length];
}
export function matchExercise(
  name: string,
  catalog = exercises,
): CatalogExercise | null {
  const text = normalizeText(name);
  if (!text) return null;
  const exact = catalog.find((ex) =>
    [ex.name, ...ex.aliases].some((n) => normalizeText(n) === text),
  );
  if (exact) return exact;
  const ranked = catalog
    .map((ex) => ({
      ex,
      d: Math.min(
        ...[ex.name, ...ex.aliases].map((n) =>
          distance(normalizeText(n), text),
        ),
      ),
    }))
    .sort((a, b) => a.d - b.d);
  return ranked[0]?.d <= Math.min(3, Math.floor(text.length * 0.15)) &&
    ranked[0].d < (ranked[1]?.d ?? Infinity)
    ? ranked[0].ex
    : null;
}
export function linkLegacyExercise(
  ex: Exercise,
  catalog = exercises,
): Exercise {
  const match = !ex.exerciseId && matchExercise(ex.name, catalog);
  return match ? { ...ex, exerciseId: match.id } : { ...ex };
}
export function toWorkoutExercise(ex: CatalogExercise): Exercise {
  return {
    name: ex.name,
    exerciseId: ex.id,
    sets: 3,
    reps: "8–12",
    restSeconds: 90,
  };
}
