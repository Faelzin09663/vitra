import React from 'react';
import { supabase } from './supabase';

export function useCloudStore<T extends object>(userId: string, initial: T, normalize: (data: T) => T) {
  const [data, setData] = React.useState<T>(initial);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('Carregando registros…');
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [saveAttempt, setSaveAttempt] = React.useState(0);
  const loaded = React.useRef(false);
  const active = React.useRef(false);
  const revision = React.useRef(0);
  const savedRevision = React.useRef(0);
  const queue = React.useRef<Promise<void>>(Promise.resolve());
  const latest = React.useRef(data);
  latest.current = data;
  // Initial/normalize are stable for the lifetime of the user-keyed dashboard.
  React.useEffect(() => {
    let cancelled = false;
    active.current = true;
    loaded.current = false;
    setLoading(true); setError('');
    async function load() {
      try {
        if (!supabase) throw new Error('Supabase não configurado');
        const { data: row, error } = await supabase.from('user_data').select('data').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const next = row ? normalize(row.data as T) : initial;
        setData(next); latest.current = next;
        revision.current = row && JSON.stringify(row.data) === JSON.stringify(next) ? 0 : 1;
        savedRevision.current = 0;
        loaded.current = true;
        setStatus('Tudo salvo na sua conta');
      } catch {
        if (!cancelled) setError('Não foi possível carregar seus registros. Verifique sua conexão e a configuração do banco.');
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; active.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadAttempt]);

  const update = (patch: Partial<T>) => {
    revision.current += 1;
    setStatus('Salvando…');
    latest.current = { ...latest.current, ...patch };
    setData(latest.current);
  };
  async function persist(snapshot: T, version: number) {
    if (version <= savedRevision.current) return;
    if (!supabase) throw new Error('Supabase não configurado');
    const { error } = await supabase.from('user_data').upsert({ user_id: userId, data: snapshot }, { onConflict: 'user_id' });
    if (error) throw error;
    savedRevision.current = version;
    if (active.current && version === revision.current) { setError(''); setStatus('Tudo salvo na sua conta'); }
  }
  React.useEffect(() => {
    if (!loaded.current || savedRevision.current === revision.current) return;
    const snapshot = data; const version = revision.current;
    const timer = setTimeout(() => {
      setStatus('Salvando…');
      // Serialize requests so an older snapshot can never overwrite a newer one.
      queue.current = queue.current.then(() => persist(snapshot, version)).catch(() => {
        if (active.current) { setError('Não foi possível salvar suas alterações. Mantenha esta página aberta e tente novamente.'); setStatus('Alterações não salvas'); }
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [data, loading, saveAttempt]);
  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (loaded.current && savedRevision.current !== revision.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  React.useEffect(() => {
    const saveBeforeBackground = () => {
      if (document.visibilityState !== 'hidden' || !loaded.current || revision.current === savedRevision.current) return;
      const snapshot = latest.current; const version = revision.current;
      queue.current = queue.current.then(() => persist(snapshot, version)).catch(() => {
        if (active.current) { setError('Não foi possível salvar suas alterações. Mantenha esta página aberta e tente novamente.'); setStatus('Alterações não salvas'); }
      });
    };
    document.addEventListener('visibilitychange', saveBeforeBackground);
    return () => document.removeEventListener('visibilitychange', saveBeforeBackground);
  }, [userId]);
  const flush = async () => {
    // Use the same queue as debounced writes; consent must finish before AI calls.
    const operation = queue.current.then(async () => {
      if (savedRevision.current !== revision.current) {
        setStatus('Salvando…');
        await persist(latest.current, revision.current);
      }
    });
    queue.current = operation.catch(() => {});
    try { await operation; }
    catch (err) { setError('Não foi possível salvar suas alterações. Tente novamente.'); setStatus('Alterações não salvas'); throw err; }
  };
  const updateAndFlush = async (patch: Partial<T>) => {
    if (!loaded.current) throw new Error('Aguarde seus registros carregarem.');
    update(patch);
    await flush();
  };
  return { data, update, updateAndFlush, loading, error, status, ready: loaded.current, retry: () => loaded.current ? setSaveAttempt(a => a + 1) : setLoadAttempt(a => a + 1), flush };
}
