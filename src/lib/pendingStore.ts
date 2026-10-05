import { uid } from './uid';

export type PendingChange<T extends object> = {
  version: 1;
  id: string;
  base: T;
  snapshot: T;
};
export const pendingStoreKey = (userId: string) => `vitra:pending-store:v1:${userId}`;

export function pendingPatch<T extends object>(pending: PendingChange<T>): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(pending.snapshot) as (keyof T)[]) {
    if (JSON.stringify(pending.base[key]) !== JSON.stringify(pending.snapshot[key])) {
      patch[key] = pending.snapshot[key];
    }
  }
  return patch;
}

export function readPendingChange<T extends object>(userId: string): PendingChange<T> | null {
  try {
    const raw = localStorage.getItem(pendingStoreKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    const object = (v: unknown) => Boolean(v && typeof v === 'object' && !Array.isArray(v));
    return value?.version === 1 && typeof value.id === 'string' && object(value.base) && object(value.snapshot)
      ? value : null;
  } catch { return null; }
}

export function writePendingChange<T extends object>(userId: string, base: T, snapshot: T): string | null {
  try {
    const change: PendingChange<T> = { version: 1, id: uid(), base, snapshot };
    localStorage.setItem(pendingStoreKey(userId), JSON.stringify(change));
    return change.id;
  } catch { return null; }
}

// A slow acknowledgement must never discard a newer pending change.
export function clearPendingChange(userId: string, id: string | null) {
  if (!id) return;
  try {
    if (readPendingChange(userId)?.id === id) localStorage.removeItem(pendingStoreKey(userId));
  } catch { /* Storage can be unavailable; the database acknowledgement still counts. */ }
}
