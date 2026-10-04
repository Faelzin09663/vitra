import React from 'react';
import { supabase } from './supabase';
export function useRecords<T extends { user_id: string }>(table: string, userId: string, order = 'date') {
  const [rows, setRows] = React.useState<T[]>([]), [loading, setLoading] = React.useState(true), [error, setError] = React.useState('');
  const generation = React.useRef(0);
  const reload = React.useCallback(async () => {
    const version = ++generation.current; setLoading(true); setError('');
    try {
      if (!supabase) throw new Error('Configure a conexão com o Supabase.');
      const result = await supabase.from(table).select('*').eq('user_id', userId).order(order, { ascending: true }).limit(5000);
      if (result.error) throw new Error('Não foi possível carregar. Confira a conexão e as migrações do Supabase.');
      if (version === generation.current) setRows((result.data || []) as T[]);
    } catch (err) { if (version === generation.current) setError(err instanceof Error ? err.message : 'Falha ao carregar.'); }
    finally { if (version === generation.current) setLoading(false); }
  }, [table, userId, order]);
  React.useEffect(() => { void reload(); return () => { generation.current++; }; }, [reload]);
  const save = async (row: Partial<T>, conflict = 'id') => {
    if (!supabase) throw new Error('Conexão indisponível.');
    const result = await supabase.from(table).upsert({ ...row, user_id: userId }, { onConflict: conflict });
    if (result.error) throw new Error('Não foi possível salvar. Verifique sua conexão e tente novamente.');
    await reload();
  };
  const remove = async (id: string) => {
    if (!supabase) throw new Error('Conexão indisponível.');
    const result = await supabase.from(table).delete().eq('user_id', userId).eq('id', id);
    if (result.error) throw new Error('Não foi possível excluir. Tente novamente.');
    await reload();
  };
  return { rows, loading, error, reload, save, remove };
}
