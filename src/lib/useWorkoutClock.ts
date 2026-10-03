import React from 'react';
import { elapsedSeconds, type ActiveWorkout } from './store';

export function useWorkoutClock(active: ActiveWorkout | null) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pageshow', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick); };
  }, [active?.startedAt]);
  // Timers derive from persisted timestamps, not from background interval ticks.
  return { elapsed: elapsedSeconds(active, now), rest: active?.restUntil ? Math.max(0, Math.ceil((Date.parse(active.restUntil) - now) / 1000)) : 0 };
}
