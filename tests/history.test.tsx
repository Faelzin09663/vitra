import { describe, expect, it } from 'vitest';
import { addCardio, addWater, createInitialStore, finishWorkout, normalizeStore } from '../src/lib/store';

describe('Histórico do Vitra', () => {
  it('reinicia o dia mantendo peso, água detalhada, cardio e treinos anteriores', () => {
    const day = new Date(2026, 9, 3, 12);
    let store = createInitialStore(day);
    store = { ...store, ...addWater(store, 500, day) };
    store = { ...store, ...addCardio(store, 'Corrida', 30, day), weights: [{ date: store.day, value: 72 }] };
    store.sets = { '0-0': { load: 25, reps: 10, done: true } };
    store = { ...store, ...finishWorkout(store, day) };
    const next = normalizeStore(store, new Date(2026, 9, 4, 12));
    expect(next.water).toBe(0);
    expect(next.waterEntries).toHaveLength(1);
    expect(next.cardioEntries[0].activity).toBe('Corrida');
    expect(next.weights[0].value).toBe(72);
    expect(next.workoutLogs[0].sets['0-0'].load).toBe(25);
    expect(next.sets).toEqual({});
  });
  it('reinicia o total semanal sem apagar as atividades anteriores', () => {
    const before = new Date(2026, 9, 3, 12);
    let store = createInitialStore(before);
    store = { ...store, ...addCardio(store, 'Bicicleta', 45, before) };
    const next = normalizeStore(store, new Date(2026, 9, 5, 12));
    expect(next.cardio).toBe(0);
    expect(next.cardioEntries).toHaveLength(1);
    expect(next.cardioEntries[0].minutes).toBe(45);
  });
  it('mantém cargas e repetições de treinos concluídos independentes do próximo treino', () => {
    let store = createInitialStore();
    store.sets = { '0-0': { load: 20, reps: 12, done: true } };
    store = { ...store, ...finishWorkout(store) };
    store.sets = { '0-0': { load: 30, reps: 8, done: true } };
    store.exercises[0].name = 'Outro exercício';
    expect(store.workoutLogs[0].sets['0-0']).toEqual({ load: 20, reps: 12, done: true });
    expect(store.workoutLogs[0].exercises[0].name).toBe('Supino reto');
  });
});
