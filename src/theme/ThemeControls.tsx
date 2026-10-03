import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, setMode } = useTheme();
  return <button type="button" className={`theme-toggle ${className}`} aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'} title={dark ? 'Ativar modo claro' : 'Ativar modo escuro'} onClick={() => setMode(dark ? 'light' : 'dark')}>{dark ? <Sun size={20}/> : <Moon size={20}/>}</button>;
}
export function ThemeSettings() {
  const { mode, setMode } = useTheme();
  return <section className="theme-settings" aria-label="Aparência"><h3>Aparência</h3><p>Escolha o tema ou acompanhe o ajuste do seu dispositivo.</p><div className="theme-options">{([{ mode: 'light', name: 'Claro', icon: Sun }, { mode: 'dark', name: 'Escuro', icon: Moon }, { mode: 'system', name: 'Sistema', icon: Monitor }] as const).map(({ mode: value, name, icon: Icon }) => <button type="button" key={value} aria-pressed={mode === value} className={mode === value ? 'selected' : ''} onClick={() => setMode(value)}><Icon size={18}/>{name}</button>)}</div></section>;
}
