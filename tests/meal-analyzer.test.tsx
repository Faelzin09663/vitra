import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MealAnalyzer } from '../src/components/MealAnalyzer';
import { AIConsentSettings } from '../src/components/AIConsentSettings';
import { prepareMealImage } from '../src/lib/mealImage';
import { createInitialStore, normalizeStore } from '../src/lib/store';
import type { AIConsent } from '../supabase/functions/_shared/ai-consent';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke } } }));
const estimate = { name: 'Arroz e frango', calories: 450, protein: 35, carbs: 48, fat: 12, confidence: 'medium', notes: 'Porções estimadas.', foods: [{ name: 'Arroz', portion: '150 g' }], needsClarification: false };
const consent = { version: 1, grantedAt: '2026-10-04T12:00:00Z' };
const view = (value: AIConsent | null = consent, age: number | null = 30) => {
  const onSave = vi.fn(), beforeAnalyze = vi.fn().mockResolvedValue(undefined), changed = vi.fn();
  function Wrapper() {
    const [current, setCurrent] = React.useState(value);
    return <MealAnalyzer consent={current} age={age} onConsentChange={async c => { changed(c); setCurrent(c); }} beforeAnalyze={beforeAnalyze} onSave={onSave}/>;
  }
  render(<Wrapper/>);
  const launch = screen.getByRole('button', { name: 'Analisar refeição com IA' });
  launch.focus(); fireEvent.click(launch);
  return { onSave, beforeAnalyze, changed };
};
beforeEach(() => { invoke.mockResolvedValue({ data: { analysis: estimate, model: 'gemini-test' }, error: null }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Consentimento e revisão de refeições', () => {
  it('não envia nada sem autorização explícita e permite revogar depois', async () => {
    const { changed } = view(null);
    const authorize = screen.getByRole('button', { name: 'Autorizar IA' }) as HTMLButtonElement;
    expect(authorize.disabled).toBe(true); expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Autorizo o envio da refeição ao Google para análise.'));
    fireEvent.click(authorize);
    await screen.findByLabelText('Descreva os alimentos e as porções');
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ version: 1, grantedAt: expect.any(String) }));
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar IA' }));
    await screen.findByRole('button', { name: 'Autorizar IA' });
    expect(changed).toHaveBeenLastCalledWith(null);
  });
  it('bloqueia IA para perfil incompleto/menor de idade, e mostra erros de persistência', async () => {
    view(null, 17);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/18 anos ou mais/)).toBeTruthy();
    cleanup();
    render(<AIConsentSettings consent={null} age={30} onChange={async () => { throw new Error('offline'); }}/>);
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Autorizar IA' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });
  it('aguarda o salvamento, exige confirmação e permite editar todos os dados úteis da estimativa', async () => {
    const { onSave, beforeAnalyze } = view();
    fireEvent.change(screen.getByLabelText('Descreva os alimentos e as porções'), { target: { value: 'Arroz e frango' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar refeição', exact: true }));
    await screen.findByLabelText('Nome da refeição');
    expect(beforeAnalyze.mock.invocationCallOrder[0]).toBeLessThan(invoke.mock.invocationCallOrder[0]);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nome da refeição'), { target: { value: 'Meu almoço' } });
    fireEvent.change(screen.getByLabelText('Calorias (kcal)'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Proteínas (g)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Carboidratos (g)'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Gorduras (g)'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Observações e suposições'), { target: { value: 'Porção pesada por mim.' } });
    fireEvent.change(screen.getByLabelText('Confiança da estimativa'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Alimento 1'), { target: { value: 'Arroz integral' } });
    fireEvent.change(screen.getByLabelText('Porção 1'), { target: { value: '180 g' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e salvar refeição' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Meu almoço', calories: 500, protein: 40, carbs: 50, fat: 15, notes: 'Porção pesada por mim.', foods: [{ name: 'Arroz integral', portion: '180 g' }], confidence: 'high', estimated: true, analyzedBy: 'gemini-test' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('pede esclarecimento e não permite salvar uma estimativa insuficiente', async () => {
    invoke.mockResolvedValue({ data: { analysis: { ...estimate, needsClarification: true, notes: 'Qual foi a porção?' }, model: 'gemini-test' }, error: null });
    const { onSave } = view();
    fireEvent.change(screen.getByLabelText('Descreva os alimentos e as porções'), { target: { value: 'Comida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar refeição', exact: true }));
    expect((await screen.findByRole('alert')).textContent).toBe('Qual foi a porção?');
    expect(screen.queryByRole('button', { name: 'Confirmar e salvar refeição' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('descarta resultado depois de fechar, restaura foco e fecha com Esc', async () => {
    let resolve!: (value: unknown) => void;
    invoke.mockImplementation(() => new Promise(r => { resolve = r; }));
    view();
    fireEvent.change(screen.getByLabelText('Descreva os alimentos e as porções'), { target: { value: 'Arroz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar refeição', exact: true }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Analisar refeição com IA' }));
    await act(async () => { resolve({ data: { analysis: estimate, model: 'gemini-test' }, error: null }); });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar refeição com IA' }));
    expect(screen.queryByLabelText('Nome da refeição')).toBeNull();
  });
  it('mantém o foco dentro do modal nos limites da navegação por Tab', () => {
    view();
    const first = screen.getByRole('button', { name: 'Fechar análise' });
    const last = screen.getByRole('button', { name: 'Desativar IA' });
    first.focus(); fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(first);
  });
  it('normaliza preferências antigas sem perder registros e preserva autorização na virada de dia', () => {
    const old = createInitialStore(new Date(2026, 9, 4));
    old.weights.push({ date: '04/10/2026', value: 72 });
    const { preferences: _, ...legacy } = old;
    const normalized = normalizeStore(legacy as typeof old, new Date(2026, 9, 5));
    expect(normalized.preferences.ai_consent).toBeNull(); expect(normalized.weights).toEqual(old.weights);
    expect(normalizeStore({ ...old, preferences: { ai_consent: consent } }, new Date(2026, 9, 5)).preferences.ai_consent).toEqual(consent);
  });
});

describe('Foto reduzida e sem metadados', () => {
  it('reencoda pixels em canvas a 1024 px/JPEG 0,8 e descarta URL do arquivo original', async () => {
    const create = vi.fn().mockReturnValue('blob:source'), revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    vi.stubGlobal('Image', class { width = 4000; height = 3000; src = ''; decode = async () => {}; });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,YWJj');
    const result = await prepareMealImage(new File(['EXIF GPS ORIGINAL'], 'meal.jpg', { type: 'image/jpeg' }));
    expect(drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 1024, 768]);
    expect(encode).toHaveBeenCalledWith('image/jpeg', 0.8); expect(result).not.toContain('EXIF');
    expect(revoke).toHaveBeenCalledWith('blob:source');
  });
  it('recusa tipo/tamanho inválidos antes de ler o arquivo', async () => {
    await expect(prepareMealImage(new File(['x'], 'bad.svg', { type: 'image/svg+xml' }))).rejects.toThrow(/JPEG/);
    await expect(prepareMealImage(new File([new Uint8Array(21 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' }))).rejects.toThrow(/20 MB/);
  });
});
