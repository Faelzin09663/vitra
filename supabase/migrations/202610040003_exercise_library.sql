create table if not exists public.custom_exercises (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), data jsonb not null check (jsonb_typeof(data) = 'object' and length(data->>'name') between 2 and 120)
);
create index if not exists custom_exercises_owner_date on public.custom_exercises(user_id, created_at);
alter table public.custom_exercises enable row level security;
drop policy if exists custom_exercises_owner on public.custom_exercises;
create policy custom_exercises_owner on public.custom_exercises for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.custom_exercises to authenticated;
