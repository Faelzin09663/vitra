import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createHealthHandler } from '../_shared/health-handler.ts';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createHealthHandler({
  findOwner: async hash => { const { data, error } = await admin.from('health_connections').select('user_id').eq('token_hash', hash).gt('expires_at', new Date().toISOString()).maybeSingle(); if (error) throw error; return data?.user_id || null; },
  save: async (owner, date, steps) => { const { error } = await admin.from('daily_steps').upsert({ user_id: owner, recorded_on: date, steps, source: 'apple-health-shortcut', updated_at: new Date().toISOString() }, { onConflict: 'user_id,recorded_on' }); if (error) throw error; },
}));
