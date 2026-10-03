import React from 'react';
import { Clock, Pause, Play, Smartphone } from 'lucide-react';
import { formatDuration, toggleWorkoutPause, type ActiveWorkout } from '../lib/store';
export function WorkoutTimer({ active, elapsed, onChange }: { active: ActiveWorkout; elapsed: number; onChange: (active: ActiveWorkout) => void }) {
  const [keepAwake, setKeepAwake] = React.useState(false);
  const [wakeMessage, setWakeMessage] = React.useState('');
  React.useEffect(() => {
    if (!keepAwake) return;
    let lock: WakeLockSentinel | null = null; let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || stopped) return;
      try { if (!('wakeLock' in navigator)) throw new Error(); lock = await navigator.wakeLock.request('screen'); if (stopped) await lock.release(); }
      catch { if (!stopped) { setWakeMessage('Este navegador não permitiu manter a tela acesa.'); setKeepAwake(false); } }
    };
    void acquire(); document.addEventListener('visibilitychange', acquire);
    return () => { stopped = true; void lock?.release(); document.removeEventListener('visibilitychange', acquire); };
  }, [keepAwake]);
  return <section className="workout-timer"><div className="timer-main"><span className="tile blue"><Clock size={23}/></span><div><span>{active.pausedAt ? 'TREINO PAUSADO' : 'TREINO EM ANDAMENTO'}</span><strong role="timer" aria-label="Tempo total de treino">{formatDuration(elapsed)}</strong></div><button className="timer-pause" onClick={() => onChange(toggleWorkoutPause(active))}>{active.pausedAt ? <Play size={18}/> : <Pause size={18}/>}<span>{active.pausedAt ? 'Continuar' : 'Pausar'}</span></button></div><div className="timer-options"><button className="text" onClick={() => { setWakeMessage(''); setKeepAwake(v => !v); }}><Smartphone size={15}/>{keepAwake ? 'Desativar tela acesa' : 'Manter tela acesa'}</button><p>{wakeMessage || 'O tempo é recuperado ao voltar ao app. No iPhone, o timer na tela bloqueada exige um app nativo.'}</p></div></section>;
}
