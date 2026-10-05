-- Persistent assistant data: owner RLS, server-only messages, atomic idempotent turns.
create table if not exists public.vit_conversations (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Conversa com VIT' check(length(title) between 1 and 100),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id)
);
create table if not exists public.vit_memories (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(length(content) between 1 and 500),active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.vit_messages (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null,request_id uuid not null,role text not null check(role in ('user','assistant')),
 content text not null check(length(content) between 1 and 7000),photo_id uuid references public.progress_photos(id) on delete set null,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and length(metadata::text)<=20000),
 created_at timestamptz not null default now(),sequence bigint generated always as identity,unique(conversation_id,request_id,role),
 foreign key(conversation_id,user_id) references public.vit_conversations(id,user_id) on delete cascade
);
create index if not exists vit_conversations_owner_date on public.vit_conversations(user_id,updated_at,id);
create index if not exists vit_memories_owner_date on public.vit_memories(user_id,updated_at,id);
create index if not exists vit_messages_owner_conversation on public.vit_messages(user_id,conversation_id,created_at,id);
alter table public.vit_conversations enable row level security;
alter table public.vit_memories enable row level security;
alter table public.vit_messages enable row level security;
drop policy if exists vit_conversations_owner on public.vit_conversations;
create policy vit_conversations_owner on public.vit_conversations for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists vit_memories_owner on public.vit_memories;
create policy vit_memories_owner on public.vit_memories for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists vit_messages_read on public.vit_messages;
create policy vit_messages_read on public.vit_messages for select to authenticated using((select auth.uid())=user_id);
revoke all on public.vit_messages from anon,authenticated;
grant select on public.vit_messages to authenticated;
grant select,insert,update,delete on public.vit_conversations,public.vit_memories to authenticated;
grant select,insert,update,delete on public.vit_conversations,public.vit_memories,public.vit_messages to service_role;
grant usage,select on sequence public.vit_messages_sequence_seq to service_role;

create or replace function public.save_vit_turn(owner uuid,target_conversation uuid,target_request uuid,prompt_text text,answer_text text,attachment uuid,details jsonb,provider_model text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare existing jsonb;old_prompt text;old_photo uuid;result jsonb;
begin
 if prompt_text is null or length(prompt_text) not between 1 and 1500 or answer_text is null or length(answer_text) not between 1 and 7000 or jsonb_typeof(details) is distinct from 'object' or length(details::text)>18000 or provider_model is null or length(provider_model) not between 1 and 150 then raise exception 'invalid turn';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text||target_request::text,0));
 if not exists(select 1 from public.vit_conversations where id=target_conversation and user_id=owner) then raise exception 'conversation unavailable';end if;
 if attachment is not null and not exists(select 1 from public.progress_photos where id=attachment and user_id=owner) then raise exception 'photo unavailable';end if;
 select metadata into existing from public.vit_messages where conversation_id=target_conversation and user_id=owner and request_id=target_request and role='assistant';
 if found then
  select content,photo_id into old_prompt,old_photo from public.vit_messages where conversation_id=target_conversation and user_id=owner and request_id=target_request and role='user';
  if old_prompt is distinct from prompt_text or old_photo is distinct from attachment then raise exception 'request mismatch';end if;
  return existing;
 end if;
 result=details||jsonb_build_object('answer',answer_text,'model',provider_model);
 insert into public.vit_messages(user_id,conversation_id,request_id,role,content,photo_id) values(owner,target_conversation,target_request,'user',prompt_text,attachment);
 insert into public.vit_messages(user_id,conversation_id,request_id,role,content,metadata) values(owner,target_conversation,target_request,'assistant',answer_text,result);
 update public.vit_conversations set updated_at=now() where id=target_conversation and user_id=owner;
 return result;
end;$$;
revoke all on function public.save_vit_turn(uuid,uuid,uuid,text,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_vit_turn(uuid,uuid,uuid,text,text,uuid,jsonb,text) to service_role;
