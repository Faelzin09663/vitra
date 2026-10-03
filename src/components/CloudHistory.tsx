import React from 'react';
import { Activity, Dumbbell, Droplets, Utensils, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDuration, type Store } from '../lib/store';

type DailyRecord = { recorded_on: string; data: Pick<Store, 'water' | 'meals' | 'waterGoal' | 'calorieGoal'> };
export function CloudHistory({ userId, status, store }: { userId: string; status: string; store: Store }) {
  const [rows, setRows] = React.useState<DailyRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    if (!supabase || status === 'Salvando…') return;
    setLoading(true);
    supabase.from('daily_records').select('recorded_on,data').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError('Não foi possível carregar o histórico. Confira a conexão e aplique a migração de histórico no Supabase.');
        else { setRows((data || []) as DailyRecord[]); setError(''); }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, status, attempt]);
  return <div className="history-sections"><section className="panel"><div className="section-heading"><h2>Histórico diário</h2><button className="text" onClick={() => setAttempt(a => a + 1)}><RefreshCw size={14}/>Atualizar</button></div><p className="sub">Água e alimentação dos últimos 60 dias registrados.</p>{loading ? <p className="history-message">Carregando histórico…</p> : error ? <p className="history-message" role="alert">{error}</p> : !rows.length ? <p className="history-message">Seu histórico aparecerá conforme você registrar seus dias.</p> : rows.map(row => <div className="daily-history" key={row.recorded_on}><strong>{new Date(`${row.recorded_on}T12:00:00`).toLocaleDateString('pt-BR')}</strong><span><Droplets size={15}/>{row.data.water.toLocaleString('pt-BR')} ml</span><span><Utensils size={15}/>{row.data.meals.reduce((s, m) => s + m.calories, 0)} kcal</span><small>{row.data.meals.length} refeições</small></div>)}</section><section className="panel"><h2>Treinos concluídos</h2>{!store.workoutLogs.length && <p className="history-message">Finalize seu primeiro treino para guardar as séries e cargas.</p>}{store.workoutLogs.slice().reverse().map(log => <details className="workout-history" key={log.id}><summary><span className="tile blue"><Dumbbell size={18}/></span><strong>{log.name}</strong><span>{log.date}</span>{log.durationSeconds !== undefined && <span className="duration-tag">{formatDuration(log.durationSeconds)}</span>}</summary>{log.exercises.map((ex, i) => <div className="history-exercise" key={i}><strong>{ex.name}</strong>{Object.entries(log.sets).filter(([key]) => key.startsWith(`${i}-`)).map(([key, set]) => <span key={key}>Série {Number(key.split('-')[1]) + 1}: {set.load} kg × {set.reps} repetições {set.done ? '· concluída' : '· pendente'}</span>)}</div>)}</details>)}</section><section className="panel"><h2>Atividades de cardio</h2>{!store.cardioEntries.length && <p className="history-message">Registre sua primeira atividade para começar seu histórico.</p>}{store.cardioEntries.slice().reverse().map(entry => <div className="meal-row" key={entry.id}><span className="tile purple"><Activity size={19}/></span><div><strong>{entry.activity}</strong><small>{entry.date}</small></div><b className="cardio-distance">{entry.distanceKm !== undefined && entry.distanceKm > 0 ? `${entry.distanceKm.toLocaleString('pt-BR')} km` : '-- km'}<small>{entry.minutes ? `${entry.minutes} min` : ''}</small></b></div>)}</section></div>;
}
