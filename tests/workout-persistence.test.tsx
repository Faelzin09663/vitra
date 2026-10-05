import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutLibrary } from '../src/components/WorkoutLibrary';
import { useCloudStore } from '../src/lib/useCloudStore';
import { createInitialStore, saveWorkout, type Store, type Workout, normalizeStore } from '../src/lib/store';
import { recoverPendingStore } from '../src/lib/storeRecovery';
import { pendingStoreKey, readPendingChange, writePendingChange } from '../src/lib/pendingStore';

const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: db.from } }));
const initial = createInitialStore();
let remote: Store;
const workout: Workout = { id: 'peito-sexta', name: 'Peito sexta', focus: 'Peito', weekdays: [5], exercises: [{ name: 'Crucifixo', sets: 3, reps: '10', restSeconds: 60 }] };
const useStore = (owner = 'owner-a') => useCloudStore(owner, initial, normalizeStore, recoverPendingStore);
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  remote = structuredClone(initial);
  db.from.mockReturnValue(db); db.select.mockReturnValue(db); db.eq.mockReturnValue(db);
  db.maybeSingle.mockImplementation(async () => ({ data: { data: structuredClone(remote) }, error: null }));
  db.upsert.mockImplementation(async ({ data }: { data: Store }) => { remote = structuredClone(data); return { error: null }; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Library() {
  const { data, ready, updateAndFlush } = useStore();
  if (!ready) return <p>Carregando</p>;
  return <WorkoutLibrary store={data} onSelect={() => {}} onSave={w => updateAndFlush(current => saveWorkout(current, w))} onRemove={() => {}} />;
}
function createWorkout(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Criar treino', exact: true }));
  fireEvent.change(screen.getByLabelText('Nome do treino'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar exercício', exact: true }));
  fireEvent.change(screen.getByLabelText('Nome do exercício'), { target: { value: 'Supino' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar treino', exact: true }));
}

describe('Treinos ao fechar e reabrir o app', () => {
  it('salva múltiplos modelos no Supabase antes de fechar o editor e carrega todos ao entrar novamente', async () => {
    const first = render(<Library />);
    await screen.findByRole('button', { name: 'Criar treino', exact: true });
    createWorkout('Peito segunda');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    createWorkout('Peito sexta');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(remote.workouts.map(w => w.name)).toEqual(['Treino A', 'Peito segunda', 'Peito sexta']);
    expect(localStorage.getItem(pendingStoreKey('owner-a'))).toBeNull();
    first.unmount();
    render(<Library />);
    await screen.findByText('Peito segunda');
    expect(screen.getByText('Peito sexta')).toBeTruthy();
  });

  it('recupera o treino mesmo fechando antes dos 400 ms de autosave', async () => {
    const first = renderHook(() => useStore());
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.update(current => saveWorkout(current, workout)));
    first.unmount();
    expect(db.upsert).not.toHaveBeenCalled();
    const reopened = renderHook(() => useStore());
    await waitFor(() => expect(reopened.result.current.ready).toBe(true));
    expect(reopened.result.current.data.workouts.map(w => w.id)).toEqual(['workout-a', workout.id]);
    await act(async () => { await reopened.result.current.flush(); });
    expect(remote.workouts.at(-1)).toEqual(workout);
    expect(readPendingChange('owner-a')).toBeNull();
  });

  it('mantém o editor e o rascunho após erro de rede e repete sem criar treino duplicado', async () => {
    db.upsert.mockResolvedValueOnce({ error: new Error('offline') });
    render(<Library />);
    await screen.findByRole('button', { name: 'Criar treino', exact: true });
    createWorkout('Peito segunda');
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Nome do treino')).toHaveProperty('value', 'Peito segunda');
    expect(remote.workouts).toHaveLength(1);
    expect(readPendingChange<Store>('owner-a')?.snapshot.workouts).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar treino', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(remote.workouts).toHaveLength(2);
    expect(readPendingChange('owner-a')).toBeNull();
  });

  it('não fecha o editor nem permite outro envio enquanto a confirmação está pendente', async () => {
    let finish!: () => void;
    db.upsert.mockImplementationOnce(async ({ data }: { data: Store }) => {
      await new Promise<void>(resolve => { finish = resolve; });
      remote = structuredClone(data);
      return { error: null };
    });
    render(<Library />);
    await screen.findByRole('button', { name: 'Criar treino', exact: true });
    createWorkout('Peito segunda');
    await waitFor(() => expect(db.upsert).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /Salvando treino/ }).closest('fieldset')?.disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('recupera as alterações depois de uma tentativa offline e não leva dados para outra conta', async () => {
    const first = renderHook(() => useStore());
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    db.upsert.mockResolvedValueOnce({ error: new Error('offline') });
    await act(async () => { await expect(first.result.current.updateAndFlush(current => saveWorkout(current, workout))).rejects.toThrow('offline'); });
    first.unmount();
    const other = renderHook(() => useStore('owner-b'));
    await waitFor(() => expect(other.result.current.ready).toBe(true));
    expect(other.result.current.data.workouts).toHaveLength(1);
    other.unmount();
    const reopened = renderHook(() => useStore());
    await waitFor(() => expect(reopened.result.current.data.workouts).toHaveLength(2));
    await act(async () => { await reopened.result.current.flush(); });
    expect(db.upsert).toHaveBeenLastCalledWith({ user_id: 'owner-a', data: remote }, { onConflict: 'user_id' });
  });

  it('não descarta um rascunho mais novo quando uma gravação antiga termina', async () => {
    let finish!: () => void;
    db.upsert.mockImplementationOnce(async ({ data }: { data: Store }) => {
      await new Promise<void>(resolve => { finish = resolve; });
      remote = structuredClone(data);
      return { error: null };
    });
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    let operation!: Promise<void>;
    act(() => { operation = result.current.updateAndFlush(current => saveWorkout(current, workout)); });
    await waitFor(() => expect(db.upsert).toHaveBeenCalledTimes(1));
    act(() => result.current.update(current => saveWorkout(current, { ...workout, id: 'costas', name: 'Costas' })));
    const pending = readPendingChange<Store>('owner-a');
    expect(pending?.snapshot.workouts).toHaveLength(3);
    await act(async () => { finish(); await operation; });
    // flush also waits for edits that arrived while its first request was in flight.
    expect(db.upsert).toHaveBeenCalledTimes(2);
    expect(remote.workouts).toHaveLength(3);
    expect(readPendingChange('owner-a')).toBeNull();
  });

  it('não grava padrões nem descarta pendências se a leitura do Supabase falhar', async () => {
    writePendingChange('owner-a', initial, { ...initial, ...saveWorkout(initial, workout) });
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(readPendingChange('owner-a')).not.toBeNull();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data.workouts).toHaveLength(2));
  });

  it('remove a pendência já confirmada pelo servidor sem repetir a gravação', async () => {
    remote = { ...initial, ...saveWorkout(initial, workout) };
    writePendingChange('owner-a', initial, remote);
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(readPendingChange('owner-a')).toBeNull();
    expect(db.upsert).not.toHaveBeenCalled();
  });
});
