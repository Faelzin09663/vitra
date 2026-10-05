import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloudStore } from '../src/lib/useCloudStore';

const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: db.from } }));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  db.from.mockReturnValue(db); db.select.mockReturnValue(db); db.eq.mockReturnValue(db);
  db.maybeSingle.mockResolvedValue({ data: { data: { water: 500 } }, error: null });
  db.upsert.mockResolvedValue({ error: null });
});
afterEach(cleanup);
const initial = { water: 0 };
const normalize = (s: typeof initial) => s;
describe('Persistência por usuário', () => {
  it('salva o patch do consentimento mesmo chamando flush antes de um novo render', async () => {
    const { result } = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.updateAndFlush({ water: 777 }); });
    expect(db.upsert).toHaveBeenLastCalledWith({ user_id: 'owner-a', data: { water: 777 } }, { onConflict: 'user_id' });
    expect(result.current.status).toBe('Tudo salvo na sua conta');
  });
  it('não confirma escolha quando o salvamento imediato falha', async () => {
    const { result } = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(result.current.loading).toBe(false));
    db.upsert.mockResolvedValueOnce({ error: new Error('offline') });
    await act(async () => { await expect(result.current.updateAndFlush({ water: 778 })).rejects.toThrow('offline'); });
    expect(result.current.status).toBe('Alterações não salvas');
    expect(result.current.data.water).toBe(778);
  });
  it('carrega apenas o usuário autenticado e grava alterações com seu id', async () => {
    const { result } = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(db.eq).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(result.current.data.water).toBe(500);
    expect(db.upsert).not.toHaveBeenCalled();
    act(() => result.current.update({ water: 750 }));
    await waitFor(() => expect(db.upsert).toHaveBeenCalledWith({ user_id: 'owner-a', data: { water: 750 } }, { onConflict: 'user_id' }));
    await waitFor(() => expect(result.current.status).toBe('Tudo salvo na sua conta'));
  });
  it('não sobrescreve dados remotos quando a leitura falha', async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: new Error('offline') });
    const { result } = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    expect(result.current.error).toMatch(/carregar/);
    expect(db.upsert).not.toHaveBeenCalled();
    db.maybeSingle.mockResolvedValue({ data: { data: { water: 900 } }, error: null });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data.water).toBe(900));
    expect(result.current.ready).toBe(true);
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it('mantém alterações e permite tentar salvar novamente após erro', async () => {
    db.upsert.mockResolvedValueOnce({ error: new Error('offline') });
    const { result } = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.update({ water: 1000 }));
    await waitFor(() => expect(result.current.status).toBe('Alterações não salvas'));
    expect(result.current.data.water).toBe(1000);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('Tudo salvo na sua conta'));
    expect(db.upsert).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBe('');
  });
  it('salva alterações pendentes antes de sair sem aguardar o debounce', async () => {
    const { result } = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.update({ water: 1250 }));
    await act(async () => { await result.current.flush(); });
    expect(db.upsert).toHaveBeenCalledWith({ user_id: 'owner-a', data: { water: 1250 } }, { onConflict: 'user_id' });
    expect(result.current.status).toBe('Tudo salvo na sua conta');
  });
  it('não reaproveita registros da conta anterior quando o painel é remontado', async () => {
    const first = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();
    db.maybeSingle.mockResolvedValue({ data: { data: { water: 0 } }, error: null });
    const second = renderHook(() => useCloudStore('owner-b', initial, normalize));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(db.eq).toHaveBeenLastCalledWith('user_id', 'owner-b');
    expect(second.result.current.data.water).toBe(0);
  });
  it('serializa salvamentos para uma resposta lenta não sobrescrever uma alteração recente', async () => {
    let completeFirst!: (result: { error: null }) => void;
    db.upsert.mockImplementationOnce(() => new Promise(resolve => { completeFirst = resolve; }));
    const { result } = renderHook(() => useCloudStore('owner-a', initial, normalize));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.update({ water: 750 }));
    await waitFor(() => expect(db.upsert).toHaveBeenCalledTimes(1));
    act(() => result.current.update({ water: 1000 }));
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(db.upsert).toHaveBeenCalledTimes(1);
    await act(async () => { completeFirst({ error: null }); });
    await waitFor(() => expect(db.upsert).toHaveBeenCalledTimes(2));
    expect(db.upsert).toHaveBeenLastCalledWith({ user_id: 'owner-a', data: { water: 1000 } }, { onConflict: 'user_id' });
    await waitFor(() => expect(result.current.status).toBe('Tudo salvo na sua conta'));
  });
});
