begin;

create table public.daily_steps (
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  steps integer not null check (steps between 0 and 300000),
  source text not null check (source in ('manual', 'apple-health-shortcut')),
  updated_at timestamptz not null default now(),
  primary key (user_id, recorded_on)
);
alter table public.daily_steps enable row level security;
revoke all on public.daily_steps from anon, authenticated;
grant select, insert, update on public.daily_steps to authenticated;
create policy "Read own steps" on public.daily_steps for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own manual steps" on public.daily_steps for insert to authenticated with check ((select auth.uid()) = user_id and source = 'manual');
create policy "Update own manual steps" on public.daily_steps for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and source = 'manual');

create table public.health_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);
alter table public.health_connections enable row level security;
revoke all on public.health_connections from anon, authenticated;
grant select, insert, update, delete on public.health_connections to authenticated;
create policy "Read own health connection" on public.health_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own health connection" on public.health_connections for insert to authenticated with check ((select auth.uid()) = user_id and expires_at <= now() + interval '91 days');
create policy "Update own health connection" on public.health_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and expires_at <= now() + interval '91 days');
create policy "Revoke own health connection" on public.health_connections for delete to authenticated using ((select auth.uid()) = user_id);

-- Only the authenticated backend can consume quotas. Clients cannot reset them.
create table public.meal_analysis_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  hour_bucket timestamptz not null,
  requests integer not null default 1,
  primary key (user_id, hour_bucket)
);
alter table public.meal_analysis_limits enable row level security;
revoke all on public.meal_analysis_limits from anon, authenticated;
create function public.consume_meal_analysis(owner uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare accepted integer;
begin
  insert into public.meal_analysis_limits (user_id, hour_bucket, requests)
  values (owner, date_trunc('hour', now()), 1)
  on conflict (user_id, hour_bucket) do update
    set requests = public.meal_analysis_limits.requests + 1
    where public.meal_analysis_limits.requests < 20
  returning requests into accepted;
  return accepted is not null;
end;
$$;
revoke execute on function public.consume_meal_analysis(uuid) from public, anon, authenticated;
grant execute on function public.consume_meal_analysis(uuid) to service_role;
grant all on public.daily_steps, public.health_connections, public.meal_analysis_limits to service_role;

commit;
