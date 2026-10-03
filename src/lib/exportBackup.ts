import { supabase } from './supabase';
import type { Store } from './store';
export async function exportBackup(userId: string, dashboard: Store) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const readAll = async (table: string) => {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase!.from(table).select('*').eq('user_id', userId).order('recorded_on', { ascending: false }).range(offset, offset + 999);
      if (error) throw new Error('Não foi possível exportar o histórico completo. Confira a conexão e as migrações.');
      rows.push(...data); if (data.length < 1000) return rows;
    }
  };
  const [dailyRecords, dailySteps] = await Promise.all([readAll('daily_records'), readAll('daily_steps')]);
  const backup = { format: 'vitra-backup', version: 2, exportedAt: new Date().toISOString(), dashboard, dailyRecords, dailySteps };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `vitra-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  // Integration tokens and authentication credentials are deliberately not exported.
}
