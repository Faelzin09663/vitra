import React from 'react';
export type ThemeMode = 'light' | 'dark' | 'system';
type ThemeContextValue = { mode: ThemeMode; dark: boolean; setMode: (mode: ThemeMode) => void };
const ThemeContext = React.createContext<ThemeContextValue>({ mode: 'system', dark: false, setMode: () => {} });
export function readTheme(): ThemeMode { try { const value = localStorage.getItem('vitra-theme'); return value === 'light' || value === 'dark' ? value : 'system'; } catch { return 'system'; } }
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ThemeMode>(readTheme);
  const [systemDark, setSystemDark] = React.useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  React.useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  React.useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101827' : '#f7f9fc');
    try { localStorage.setItem('vitra-theme', mode); } catch { /* Theme still works when storage is unavailable. */ }
  }, [dark, mode]);
  React.useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === 'vitra-theme' || e.key === null) setMode(readTheme()); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  return <ThemeContext.Provider value={{ mode, dark, setMode }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => React.useContext(ThemeContext);
