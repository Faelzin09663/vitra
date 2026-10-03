import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createAnalysisHandler } from '../_shared/analyze-handler.ts';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createAnalysisHandler({
  apiKey: Deno.env.get('NVIDIA_API_KEY'), model: Deno.env.get('NVIDIA_MODEL'), endpoint: Deno.env.get('NVIDIA_ENDPOINT'),
  authenticate: async token => { const { data, error } = await admin.auth.getUser(token); return error ? null : data.user?.id || null; },
  allowRequest: async userId => { const { data, error } = await admin.rpc('consume_meal_analysis', { owner: userId }); if (error) throw error; return data === true; },
}));
