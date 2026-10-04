begin;

-- Requires migrations 001–003. No health/activity data is changed.
create table if not exists public.health_steps_limits (
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  hour_bucket timestamptz not null,
  requests integer not null default 1 check (requests between 1 and 60),
  primary key (token_hash, hour_bucket)
);
alter table public.health_steps_limits enable row level security;
revoke all on public.health_steps_limits from public, anon, authenticated;
grant all on public.health_steps_limits to service_role;

create index if not exists health_steps_limits_hour_idx
  on public.health_steps_limits (hour_bucket);
create index if not exists meal_analysis_limits_hour_idx
  on public.meal_analysis_limits (hour_bucket);

create or replace function public.consume_health_steps(token_digest text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare accepted integer;
begin
  if token_digest is null or token_digest !~ '^[a-f0-9]{64}$' then
    return false;
  end if;
  -- Atomic upsert prevents simultaneous requests from exceeding the quota.
  insert into public.health_steps_limits (token_hash, hour_bucket, requests)
  values (token_digest, date_trunc('hour', now()), 1)
  on conflict (token_hash, hour_bucket) do update
    set requests = public.health_steps_limits.requests + 1
    where public.health_steps_limits.requests < 60
  returning requests into accepted;
  return accepted is not null;
end;
$$;
revoke execute on function public.consume_health_steps(text) from public, anon, authenticated;
grant execute on function public.consume_health_steps(text) to service_role;

create or replace function public.cleanup_integration_limits()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.meal_analysis_limits where hour_bucket < now() - interval '7 days';
  delete from public.health_steps_limits where hour_bucket < now() - interval '7 days';
end;
$$;
revoke execute on function public.cleanup_integration_limits() from public, anon, authenticated;
grant execute on function public.cleanup_integration_limits() to service_role;

-- Supabase supports pg_cron. Enable Cron in the dashboard if this fails.
create extension if not exists pg_cron with schema pg_catalog;
-- Named schedules are updated on rerun, rather than creating duplicate jobs.
select cron.schedule(
  'vitra-cleanup-integration-limits',
  '17 * * * *',
  'select public.cleanup_integration_limits();'
);

commit;
