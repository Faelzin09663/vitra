import { PGlite } from "npm:@electric-sql/pglite@0.3.14";
const db = new PGlite(),
  a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  ca = "10000000-0000-4000-8000-000000000001",
  cb = "10000000-0000-4000-8000-000000000002",
  request = "20000000-0000-4000-8000-000000000001";
let checks = 0;
function assert(ok: unknown, label: string) {
  if (!ok) throw new Error(label);
  checks++;
}
async function denied(sql: string) {
  let failed = false;
  try {
    await db.exec(sql);
  } catch {
    failed = true;
  }
  assert(failed, "write/function denied");
}
const count = async (table: string, where = "true") =>
  (await db.query(`select * from public.${table} where ${where}`)).rows.length;
const turn = (
  owner = a,
  conv = ca,
  req = request,
  prompt = "Pergunta",
  photo = `'${a}'`,
  answer = "Resposta",
) =>
  `select public.save_vit_turn('${owner}','${conv}','${req}','${prompt}','${answer}',${photo},'{"memorySuggestions":["Prefiro comida simples."]}','mock-vit') as result`;
try {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;create table public.progress_photos(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade);insert into public.progress_photos values('${a}','${a}'),('${b}','${b}');grant select on public.progress_photos to service_role;`,
  );
  const sql = await Deno.readTextFile(
    new URL("../../supabase/migrations/202610040007_vit.sql", import.meta.url),
  );
  await db.exec(sql);
  await db.exec(sql);
  checks++;
  await db.exec(
    `insert into public.vit_conversations(id,user_id,title) values('${ca}','${a}','A'),('${cb}','${b}','B');set role authenticated;set "request.jwt.claim.sub"='${a}';`,
  );
  assert(await count("vit_conversations") === 1, "conversation owner read");
  await db.exec(
    `insert into public.vit_memories(id,user_id,content) values('${a}','${a}','Prefiro comida simples.')`,
  );
  await denied(
    `insert into public.vit_memories(id,user_id,content) values('${b}','${b}','Outra pessoa')`,
  );
  await denied(`update public.vit_memories set user_id='${b}' where id='${a}'`);
  await denied(
    `insert into public.vit_conversations(id,user_id,title) values('${request}','${b}','Cross owner')`,
  );
  await denied(
    `insert into public.vit_messages(user_id,conversation_id,request_id,role,content) values('${a}','${ca}','${request}','assistant','Mensagem falsa')`,
  );
  await denied(turn());
  await db.exec("reset role;set role service_role;");
  const saved = await db.query<{ result: { answer: string } }>(turn());
  assert(saved.rows[0].result.answer === "Resposta", "atomic pair result");
  assert(await count("vit_messages") === 2, "both roles persisted");
  const retry = await db.query<{ result: { answer: string } }>(
    turn(a, ca, request, "Pergunta", `'${a}'`, "Resposta diferente"),
  );
  assert(
    retry.rows[0].result.answer === "Resposta",
    "idempotent original result",
  );
  assert(await count("vit_messages") === 2, "retry no duplicate");
  await denied(turn(a, ca, request, "Pergunta diferente"));
  await denied(turn(a, cb, "20000000-0000-4000-8000-000000000002"));
  await denied(
    turn(a, ca, "20000000-0000-4000-8000-000000000002", "Pergunta", `'${b}'`),
  );
  assert(await count("vit_messages") === 2, "failed turns no partial messages");
  const rows = await db.query<{ role: string; sequence: number }>(
    "select role,sequence from public.vit_messages order by sequence",
  );
  assert(
    rows.rows[0].role === "user" && rows.rows[1].role === "assistant",
    "stable turn chronology",
  );
  await db.exec(
    `reset role;set role authenticated;set "request.jwt.claim.sub"='${b}';`,
  );
  assert(await count("vit_messages") === 0, "other owner cannot read messages");
  assert(await count("vit_memories") === 0, "other owner cannot read memories");
  assert(
    (await db.query(
      `delete from public.vit_conversations where id='${ca}' returning id`,
    )).rows.length === 0,
    "other owner cannot delete conversation",
  );
  await denied(
    `update public.vit_messages set content='Forged' where user_id='${a}'`,
  );
  await db.exec(
    `reset role;set role authenticated;set "request.jwt.claim.sub"='${a}';`,
  );
  assert(await count("vit_messages") === 2, "own history visible");
  await db.exec(`update public.vit_memories set active=false where id='${a}'`);
  assert(
    (await db.query<{ active: boolean }>(
      "select active from public.vit_memories",
    )).rows[0].active === false,
    "memory optout saved",
  );
  await db.exec(`delete from public.vit_conversations where id='${ca}'`);
  assert(await count("vit_messages") === 0, "conversation cascade");
  await db.exec(
    `reset role;insert into public.vit_conversations(id,user_id,title) values('${ca}','${a}','A');set role service_role;`,
  );
  await db.exec(turn());
  await db.exec(
    `reset role;delete from public.progress_photos where id='${a}'`,
  );
  assert(
    (await db.query<{ photo_id: string | null }>(
      `select photo_id from public.vit_messages where role='user'`,
    )).rows[0].photo_id === null,
    "photo deletion detaches message",
  );
  await db.exec(`delete from auth.users where id='${a}'`);
  for (const table of ["vit_conversations", "vit_messages", "vit_memories"]) {
    assert(
      await count(table, `user_id='${a}'`) === 0,
      table + " account cascade",
    );
  }
  assert(
    await count("vit_conversations", `user_id='${b}'`) === 1,
    "other account survives",
  );
  console.log(`PASS: ${checks} VIT SQL/RLS checks; no remote access.`);
} finally {
  await db.close();
}
