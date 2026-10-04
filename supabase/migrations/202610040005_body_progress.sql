create table if not exists public.body_measurements (
 user_id uuid not null references auth.users(id) on delete cascade, date date not null,
 neck numeric check(neck between 1 and 300), shoulders numeric check(shoulders between 1 and 300), chest numeric check(chest between 1 and 300), waist numeric check(waist between 1 and 300), abdomen numeric check(abdomen between 1 and 300), hips numeric check(hips between 1 and 300), right_arm numeric check(right_arm between 1 and 300), left_arm numeric check(left_arm between 1 and 300), forearm numeric check(forearm between 1 and 300), right_thigh numeric check(right_thigh between 1 and 300), left_thigh numeric check(left_thigh between 1 and 300), calf numeric check(calf between 1 and 300), note text not null default '' check(length(note)<=1000), primary key(user_id,date)
);
create table if not exists public.progress_photos (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, date date not null,
 angle text not null check(angle in ('frente','lado','costas','outro')),
 storage_path text not null unique check(storage_path like user_id::text || '/%' and storage_path !~ '\.\.'), note text not null default '' check(length(note)<=1000), unique(id,user_id)
);
create table if not exists public.photo_analyses (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 photo_ids uuid[] not null check(cardinality(photo_ids) between 1 and 2), created_at timestamptz not null default now(), result jsonb not null check(jsonb_typeof(result)='object'), model text not null check(length(model)<=100)
);
create index if not exists body_measurements_owner_date on public.body_measurements(user_id,date);
create index if not exists progress_photos_owner_date on public.progress_photos(user_id,date);
create index if not exists photo_analyses_owner_date on public.photo_analyses(user_id,created_at);
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.photo_analyses enable row level security;
drop policy if exists body_measurements_owner on public.body_measurements;
create policy body_measurements_owner on public.body_measurements for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists progress_photos_owner on public.progress_photos;
create policy progress_photos_owner on public.progress_photos for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists photo_analyses_owner on public.photo_analyses;
create policy photo_analyses_owner on public.photo_analyses for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id and (select count(*) from public.progress_photos p where p.id=any(photo_ids) and p.user_id=(select auth.uid()))=cardinality(photo_ids));
grant select,insert,update,delete on public.body_measurements,public.progress_photos,public.photo_analyses to authenticated;
create or replace function public.delete_linked_photo_analyses() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin delete from public.photo_analyses where user_id=old.user_id and photo_ids @> array[old.id]; return old; end $$;
revoke all on function public.delete_linked_photo_analyses() from public,anon,authenticated;
drop trigger if exists delete_linked_photo_analyses on public.progress_photos;
create trigger delete_linked_photo_analyses before delete on public.progress_photos for each row execute function public.delete_linked_photo_analyses();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('progress-photos','progress-photos',false,1500000,array['image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=1500000,allowed_mime_types=array['image/jpeg','image/webp'];
drop policy if exists vitra_progress_photos_owner on storage.objects;
create policy vitra_progress_photos_owner on storage.objects for all to authenticated using(bucket_id='progress-photos' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='progress-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and name !~ '\.\.');
