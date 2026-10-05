import { normalizeStore, type Store } from './store';
import { pendingPatch, type PendingChange } from './pendingStore';

/** Replay only local edits over the freshly loaded account, preserving other remote fields. */
export function recoverPendingStore(remote: Store, pending: PendingChange<Store>, now = new Date()): Store {
  const patch = pendingPatch(pending);
  if (patch.workouts && Array.isArray(pending.base.workouts)) {
    const base = new Map(pending.base.workouts.map(w => [w.id, w]));
    const local = new Map(patch.workouts.map(w => [w.id, w]));
    const edited = patch.workouts.filter(w => JSON.stringify(w) !== JSON.stringify(base.get(w.id)));
    const changed = new Map(edited.map(w => [w.id, w]));
    const removed = new Set([...base.keys()].filter(id => !local.has(id)));
    const merged = remote.workouts.filter(w => !removed.has(w.id)).map(w => changed.get(w.id) || w);
    patch.workouts = [...merged, ...edited.filter(w => !merged.some(existing => existing.id === w.id))];
  }
  // Yesterday's interrupted write cannot reset today's intake or this week's totals.
  if (pending.snapshot.day !== remote.day) {
    delete patch.day;
    delete patch.water;
    delete patch.meals;
    if (!pending.snapshot.activeWorkout) delete patch.sets;
  }
  if (pending.snapshot.week !== remote.week) {
    delete patch.week;
    delete patch.cardio;
    delete patch.cardioKm;
  }
  return normalizeStore({ ...remote, ...patch }, now);
}
