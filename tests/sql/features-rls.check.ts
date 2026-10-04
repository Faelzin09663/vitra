// Real PostgreSQL RLS in isolated WASM; Storage schema fixture, no remote service.
import {PGlite} from 'npm:@electric-sql/pglite@0.3.14';
const db=new PGlite(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';let checks=0;
function assert(ok:unknown,label:string){if(!ok)throw new Error(label);checks++;}
async function rejected(sql:string){let denied=false;try{await db.exec(sql);}catch{denied=true;}assert(denied,'cross-owner write denied');}
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const name of ['202610040003_exercise_library.sql','202610040004_session_tools.sql','202610040005_body_progress.sql','202610040006_checkins_habits.sql']){const sql=await Deno.readTextFile(new URL(`../../supabase/migrations/${name}`,import.meta.url));await db.exec(sql);await db.exec(sql);}
 await db.exec(`insert into public.body_measurements(user_id,date,waist) values('${a}','2026-10-04',90),('${b}','2026-10-04',80);insert into public.progress_photos(id,user_id,date,angle,storage_path) values('${a}','${a}','2026-10-04','frente','${a}/a.jpg'),('${b}','${b}','2026-10-04','frente','${b}/b.jpg');insert into storage.objects values('${a}','progress-photos','${a}/a.jpg'),('${b}','progress-photos','${b}/b.jpg');set role authenticated;set "request.jwt.claim.sub"='${a}';`);
 assert((await db.query('select * from public.body_measurements')).rows.length===1,'measurements isolated');
 await rejected(`insert into public.body_measurements(user_id,date,waist) values('${b}','2026-10-05',70)`);
 await db.exec(`insert into public.body_measurements(user_id,date,waist) values('${a}','2026-10-04',89) on conflict(user_id,date) do update set waist=excluded.waist;`);
 assert((await db.query<{waist:string}>('select waist from public.body_measurements')).rows[0].waist==='89','measurement daily upsert');
 assert((await db.query('select * from public.progress_photos')).rows.length===1,'photos isolated');
 assert((await db.query('select * from storage.objects')).rows.length===1,'storage read isolated');
 await rejected(`insert into storage.objects values('00000000-0000-4000-8000-000000000003','progress-photos','${b}/other.jpg')`);
 assert((await db.query(`delete from storage.objects where id='${b}' returning id`)).rows.length===0,'cannot remove other photo');
 await rejected(`insert into public.photo_analyses(id,user_id,photo_ids,result,model) values('${a}','${a}',array['${b}'::uuid],'{}','mock')`);
 await db.exec(`insert into public.photo_analyses(id,user_id,photo_ids,result,model) values('${a}','${a}',array['${a}'::uuid],'{}','mock');delete from public.progress_photos where id='${a}';`);
 assert((await db.query('select * from public.photo_analyses')).rows.length===0,'analysis cascades on photo delete');
 await rejected(`insert into public.pain_reports(id,user_id,date,region,intensity) values('${a}','${b}','2026-10-04','ombro',1)`);
 await rejected(`insert into public.custom_exercises(id,user_id,data) values('${a}','${b}','{"name":"Teste"}')`);
 await db.exec(`insert into public.daily_checkins(user_id,date,energy) values('${a}','2026-10-04',3) on conflict(user_id,date) do update set energy=excluded.energy;insert into public.habits(id,user_id,name,frequency) values('${a}','${a}','Teste','diário');`);
 await rejected(`insert into public.habit_logs(habit_id,user_id,date,done) values('${a}','${b}','2026-10-04',true)`);
 await rejected(`insert into public.daily_checkins(user_id,date) values('${b}','2026-10-04')`);
 await db.exec(`reset role;insert into public.habits(id,user_id,name,frequency) values('${b}','${b}','Outro','diário');set role authenticated;set "request.jwt.claim.sub"='${a}';`);
 await rejected(`insert into public.habit_logs(habit_id,user_id,date,done) values('${b}','${a}','2026-10-04',true)`);
 await db.exec('reset role');assert((await db.query('select * from public.progress_photos')).rows.length===1,'other account preserved');
 console.log(`PASS: ${checks} feature SQL/RLS checks; Storage API not exercised.`);
}finally{await db.close();}
