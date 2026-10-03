import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { ThemeSettings, ThemeToggle } from '../src/theme/ThemeControls';
let matches: boolean;
let subscribers: Set<() => void>;
beforeEach(() => {
  localStorage.clear(); matches = false; subscribers = new Set();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return matches; }, addEventListener: (_: string, handler: () => void) => subscribers.add(handler), removeEventListener: (_: string, handler: () => void) => subscribers.delete(handler) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
const view = () => render(<ThemeProvider><ThemeToggle/><ThemeSettings/></ThemeProvider>);
describe('Aparência', () => {
  it('troca o tema, salva a preferência e a mantém ao reabrir', () => {
    const first = view();
    fireEvent.click(screen.getByRole('button', { name: 'Ativar modo escuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('vitra-theme')).toBe('dark');
    first.unmount(); view();
    expect(screen.getByRole('button', { name: 'Ativar modo claro' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escuro', exact: true }).getAttribute('aria-pressed')).toBe('true');
  });
  it('acompanha alterações do sistema quando selecionado', () => {
    view();
    act(() => { matches = true; subscribers.forEach(handler => handler()); });
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Claro', exact: true }));
    act(() => { matches = false; subscribers.forEach(handler => handler()); matches = true; subscribers.forEach(handler => handler()); });
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Sistema', exact: true }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('sincroniza uma preferência alterada em outra aba', () => {
    view();
    act(() => { localStorage.setItem('vitra-theme', 'dark'); window.dispatchEvent(new StorageEvent('storage', { key: 'vitra-theme', newValue: 'dark' })); });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
