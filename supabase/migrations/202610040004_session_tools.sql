create table if not exists public.pain_reports (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 date date not null, region text not null check (region in ('ombro','joelho','lombar','cotovelo','punho','quadril','outra')),
 exercise_id text, intensity smallint not null check (intensity between 1 and 5), note text not null default '' check (length(note) <= 1000)
);
create index if not exists pain_reports_owner_date on public.pain_reports(user_id,date);
alter table public.pain_reports enable row level security;
drop policy if exists pain_reports_owner on public.pain_reports;
create policy pain_reports_owner on public.pain_reports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.pain_reports to authenticated;
