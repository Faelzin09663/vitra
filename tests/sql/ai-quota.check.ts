// Optional isolated PostgreSQL/WASM verification. No remote database or API calls.
// npx deno run --node-modules-dir=auto --allow-read --allow-env --allow-sys tests/sql/ai-quota.check.ts
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14';
const db = new PGlite();
const ownerA = '00000000-0000-4000-8000-000000000001';
const ownerB = '00000000-0000-4000-8000-000000000002';
let checks = 0;
function assert(value: unknown, name: string) {
  if (!value) throw new Error(`SQL check failed: ${name}`);
  checks++;
}
async function consume(owner: string, kind: string) {
  const { rows } = await db.query<{ allowed: boolean }>('select public.consume_ai_request($1::uuid, $2::text) as allowed', [owner, kind]);
  return rows[0].allowed;
}
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    insert into auth.users values ('${ownerA}'), ('${ownerB}');
    create schema cron;
    create table cron.job(jobname text primary key, schedule text, command text);
    create function cron.schedule(text, text, text) returns bigint language sql as $$
      insert into cron.job values ($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule, command=excluded.command returning 1::bigint;
    $$;
  `);
  const migration = async (file: string) => Deno.readTextFile(new URL(`../../supabase/migrations/${file}`, import.meta.url));
  await db.exec(await migration('202610030003_integrations.sql'));
  // pg_cron is unavailable in WASM. Only its scheduler is stubbed above.
  await db.exec((await migration('202610040001_security.sql')).replace('create extension if not exists pg_cron with schema pg_catalog;', ''));
  await db.query('insert into public.meal_analysis_limits values ($1, date_trunc(\'hour\', now()), 19)', [ownerA]);
  const sql = await migration('202610040002_ai_provider.sql');
  await db.exec(sql);
  assert(await consume(ownerA, 'meal'), 'migrate 19 old requests; request 20 accepted');
  assert(!await consume(ownerA, 'meal'), 'meal request 21 denied');
  const wrapper = await db.query<{ allowed: boolean }>('select public.consume_meal_analysis($1) as allowed', [ownerA]);
  assert(!wrapper.rows[0].allowed, 'legacy wrapper shares quota');
  await db.exec(sql);
  assert(!await consume(ownerA, 'meal'), 'rerun preserves counters');
  assert(await consume(ownerB, 'meal'), 'accounts have independent quota');
  for (let i = 0; i < 30; i++) assert(await consume(ownerA, i % 2 ? 'chat' : 'coach'), 'shared coach/chat allowance');
  assert(!await consume(ownerA, 'coach') && !await consume(ownerA, 'chat'), 'combined quota exhausted');
  for (let i = 0; i < 5; i++) assert(await consume(ownerA, 'body_photo'), 'daily body allowance');
  assert(!await consume(ownerA, 'body_photo'), 'sixth body request denied');
  assert(!await consume(ownerA, 'unexpected'), 'unknown kinds denied');
  await db.exec("update public.ai_quota_settings set requests_limit=2 where kind='coach_chat'");
  assert(await consume(ownerB, 'chat') && await consume(ownerB, 'coach') && !await consume(ownerB, 'chat'), 'admin-configurable quota');
  await db.exec(sql);
  const settings = await db.query<{ requests_limit: number }>("select requests_limit from public.ai_quota_settings where kind='coach_chat'");
  assert(settings.rows[0].requests_limit === 2, 'rerun preserves admin settings');
  const grants = await db.query<{ client: boolean; service: boolean }>("select has_function_privilege('authenticated','public.consume_ai_request(uuid,text)','execute') as client, has_function_privilege('service_role','public.consume_ai_request(uuid,text)','execute') as service");
  assert(!grants.rows[0].client && grants.rows[0].service, 'RPC restricted to service role');
  await db.exec('set role authenticated');
  let blocked = false;
  try { await db.query('select * from public.ai_request_limits'); } catch { blocked = true; }
  await db.exec('reset role');
  assert(blocked, 'clients cannot read quotas');
  await db.query("insert into public.ai_request_limits values ($1, 'meal', now() - interval '8 days', 1)", [ownerA]);
  await db.query("insert into public.health_steps_limits values (repeat('a',64), now() - interval '8 days', 1)");
  await db.query('select public.cleanup_integration_limits()');
  const old = await db.query<{ total: number }>("select count(*)::int as total from public.ai_request_limits where bucket < now() - interval '7 days'");
  assert(old.rows[0].total === 0, 'cleanup removes only old AI buckets');
  assert(!await consume(ownerA, 'meal'), 'cleanup preserves current usage');
  const cron = await db.query<{ total: number }>('select count(*)::int as total from cron.job');
  assert(cron.rows[0].total === 1, 'named schedule is not duplicated');
  console.log(`${checks} SQL checks passed (isolated PostgreSQL; pg_cron scheduling stubbed).`);
} finally { await db.close(); }
