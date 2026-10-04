create table if not exists public.daily_checkins (
 user_id uuid not null references auth.users(id) on delete cascade,date date not null,
 sleep_hours numeric check(sleep_hours between 0 and 24), sleep_quality smallint check(sleep_quality between 1 and 5), energy smallint check(energy between 1 and 5), mood smallint check(mood between 1 and 5), stress smallint check(stress between 1 and 5), soreness smallint check(soreness between 1 and 5), note text not null default '' check(length(note)<=1000),primary key(user_id,date)
);
create table if not exists public.habits (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,name text not null check(length(name) between 2 and 100),icon text not null default '✓' check(length(icon)<=20),frequency text not null check(frequency in ('diário','dias da semana')),weekdays integer[] not null default '{}' check(weekdays <@ array[0,1,2,3,4,5,6]),target numeric check(target>0),archived boolean not null default false,source text not null default 'manual' check(source in ('manual','water','workout')),created_at timestamptz not null default now(),unique(id,user_id),check(frequency='diário' or cardinality(weekdays)>0)
);
create table if not exists public.habit_logs (
 habit_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,date date not null,done boolean not null default false,value numeric check(value>=0),primary key(habit_id,user_id,date),foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade
);
create index if not exists checkins_owner_date on public.daily_checkins(user_id,date);
create index if not exists habits_owner_date on public.habits(user_id,created_at);
create index if not exists habit_logs_owner_date on public.habit_logs(user_id,date);
alter table public.daily_checkins enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
drop policy if exists daily_checkins_owner on public.daily_checkins;
create policy daily_checkins_owner on public.daily_checkins for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists habits_owner on public.habits;
create policy habits_owner on public.habits for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists habit_logs_owner on public.habit_logs;
create policy habit_logs_owner on public.habit_logs for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
grant select,insert,update,delete on public.daily_checkins,public.habits,public.habit_logs to authenticated;
