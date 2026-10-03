import { describe, expect, it } from 'vitest';
import { addCardio, addWeight, createInitialStore, elapsedSeconds, finishWorkout, normalizeStore, startWorkout, toggleWorkoutPause, weightReminder } from '../src/lib/store';
const start = new Date(2026, 9, 3, 12);
describe('Cronômetro de treino', () => {
  it('recupera tempo por timestamp após suspensão e recarregamento', () => {
    const store = { ...createInitialStore(start), ...startWorkout(createInitialStore(start), start) };
    const restored = normalizeStore(JSON.parse(JSON.stringify(store)), new Date(start.getTime() + 1800000));
    expect(elapsedSeconds(restored.activeWorkout, start.getTime() + 1800000)).toBe(1800);
    expect(finishWorkout(restored, new Date(start.getTime() + 1800000)).workoutLogs?.[0].durationSeconds).toBe(1800);
  });
  it('exclui pausas do tempo total e não reinicia um treino ativo', () => {
    const initial = createInitialStore(start);
    const store = { ...initial, ...startWorkout(initial, start) };
    const paused = toggleWorkoutPause(store.activeWorkout!, new Date(start.getTime() + 60000));
    expect(elapsedSeconds(paused, start.getTime() + 300000)).toBe(60);
    const resumed = toggleWorkoutPause(paused, new Date(start.getTime() + 300000));
    expect(elapsedSeconds(resumed, start.getTime() + 360000)).toBe(120);
    expect(startWorkout(store)).toEqual({});
  });
  it('preserva séries de um treino que atravessa a meia-noite', () => {
    const initial = createInitialStore(start);
    const store = { ...initial, ...startWorkout(initial, start), sets: { '0-0': { load: 20, reps: 10, done: true } } };
    const next = normalizeStore(store, new Date(2026, 9, 4, 8));
    expect(next.sets['0-0'].done).toBe(true);
    expect(next.activeWorkout?.startedAt).toBe(start.toISOString());
  });
});
describe('Cardio em quilômetros e peso', () => {
  it('soma quilômetros sem converter registros antigos em minutos', () => {
    const initial = createInitialStore(start);
    let store = { ...initial, ...addCardio(initial, 'Corrida', 25, start, 3.5) };
    store = { ...store, ...addCardio(store, 'Caminhada', 30, start, 2.2) };
    expect(store.cardioKm).toBe(5.7);
    expect(store.cardio).toBe(55);
    const next = normalizeStore(store, new Date(2026, 9, 5));
    expect(next.cardioKm).toBe(0);
    expect(next.cardioEntries[0].distanceKm).toBe(3.5);
  });
  it('lembra o peso no terceiro dia e mantém registro livre nos demais dias', () => {
    const weights = [{ date: '03/10/2026', value: 72 }];
    expect(weightReminder(weights, new Date(2026, 9, 5)).due).toBe(false);
    expect(weightReminder(weights, new Date(2026, 9, 6))).toEqual({ due: true, next: '06/10/2026', daysRemaining: 0 });
  });
  it('associa peso ao treino e cardio do dia e substitui o peso do mesmo dia', () => {
    let store = createInitialStore(start);
    store = { ...store, ...addCardio(store, 'Corrida', 20, start, 3) };
    store = { ...store, ...startWorkout(store, start) };
    store = { ...store, ...finishWorkout(store, new Date(start.getTime() + 1800000)) };
    store = { ...store, ...addWeight(store, 72, '03/10/2026', 'Pela manhã') };
    expect(store.weights[0]).toMatchObject({ workout: 'Treino A', workoutMinutes: 30, cardioKm: 3, note: 'Pela manhã' });
    store = { ...store, ...addWeight(store, 71.8, '03/10/2026') };
    expect(store.weights).toHaveLength(1);
    expect(store.weights[0].value).toBe(71.8);
  });
});
