import { describe, expect, it } from 'vitest';
import { createInitialStore, normalizeStore, startWorkout, type Workout } from '../src/lib/store';
import { recoverPendingStore } from '../src/lib/storeRecovery';
import type { PendingChange } from '../src/lib/pendingStore';

const friday = new Date(2026, 9, 9, 12);
const monday = new Date(2026, 9, 12, 12);
const second: Workout = { id: 'peito-2', name: 'Peito 2', focus: 'Peito', weekdays: [5], exercises: [{ name: 'Crucifixo', sets: 3, reps: '10' }] };
describe('Recuperação de alterações pendentes', () => {
  it('recupera criações, edições e exclusões sem apagar treinos remotos independentes ou perfil atual', () => {
    const base = { ...createInitialStore(friday), workouts: [createInitialStore(friday).workouts[0], second] };
    const edited = { ...base.workouts[0], name: 'Peito segunda' };
    const snapshot = { ...base, workouts: [edited, { ...second, id: 'costas', name: 'Costas' }], selectedWorkoutId: 'costas' };
    const remote = { ...base, workouts: [...base.workouts, { ...second, id: 'pernas', name: 'Pernas' }], profile: { ...base.profile, fullName: 'Nome atualizado' } };
    const pending: PendingChange<typeof base> = { version: 1, id: 'pending', base, snapshot };
    const recovered = recoverPendingStore(remote, pending, friday);
    expect(recovered.workouts.map(w => w.name)).toEqual(['Peito segunda', 'Pernas', 'Costas']);
    expect(recovered.profile.fullName).toBe('Nome atualizado');
    expect(recovered.selectedWorkoutId).toBe('costas');
    expect(remote.workouts).toHaveLength(3);
  });
  it('preserva os treinos e o timer, sem importar consumo antigo na virada de dia e semana', () => {
    const base = createInitialStore(friday);
    const snapshot = { ...base, ...startWorkout(base, friday), workouts: [...base.workouts, second], water: 1000, cardio: 30, cardioKm: 5, meals: [{ name: 'Jantar antigo', calories: 500, protein: 10, carbs: 40, fat: 20 }], sets: { '0-0': { load: 20, reps: 10, done: true } } };
    const remote = { ...normalizeStore(base, monday), water: 500, cardio: 15, cardioKm: 2, meals: [{ name: 'Café atual', calories: 200, protein: 10, carbs: 20, fat: 5 }] };
    const recovered = recoverPendingStore(remote, { version: 1, id: 'pending', base, snapshot }, monday);
    expect(recovered.workouts).toHaveLength(2);
    expect(recovered.water).toBe(500);
    expect(recovered.cardioKm).toBe(2);
    expect(recovered.meals).toEqual(remote.meals);
    expect(recovered.activeWorkout?.startedAt).toBe(friday.toISOString());
    expect(recovered.sets).toEqual(snapshot.sets);
    expect(recovered.day).toBe(remote.day);
  });
});
