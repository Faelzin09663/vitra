begin;

create table if not exists public.ai_quota_settings (
  kind text primary key check (kind in ('meal', 'body_photo', 'coach_chat')),
  requests_limit integer not null check (requests_limit between 1 and 10000),
  period text not null check (period in ('hour', 'day'))
);
alter table public.ai_quota_settings enable row level security;
revoke all on public.ai_quota_settings from public, anon, authenticated;
grant all on public.ai_quota_settings to service_role;
insert into public.ai_quota_settings (kind, requests_limit, period)
values ('meal', 20, 'hour'), ('body_photo', 5, 'day'), ('coach_chat', 30, 'hour')
on conflict (kind) do nothing;

create table if not exists public.ai_request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null references public.ai_quota_settings(kind),
  bucket timestamptz not null,
  requests integer not null default 1 check (requests > 0),
  primary key (user_id, kind, bucket)
);
alter table public.ai_request_limits enable row level security;
revoke all on public.ai_request_limits from public, anon, authenticated;
grant all on public.ai_request_limits to service_role;
create index if not exists ai_request_limits_bucket_idx on public.ai_request_limits (bucket);
-- The PK indexes per-user buckets; no client quota access or reset is allowed.

-- Carry over old counters without granting another allowance on deployment/rerun.
insert into public.ai_request_limits (user_id, kind, bucket, requests)
select user_id, 'meal', hour_bucket, requests from public.meal_analysis_limits
on conflict (user_id, kind, bucket) do update
  set requests = greatest(public.ai_request_limits.requests, excluded.requests);

create or replace function public.consume_ai_request(owner uuid, kind text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  quota_kind text;
  quota_limit integer;
  quota_period text;
  quota_bucket timestamptz;
  accepted integer;
begin
  if owner is null or kind is null then return false; end if;
  case kind
    when 'meal' then quota_kind := 'meal';
    when 'body_photo' then quota_kind := 'body_photo';
    when 'coach' then quota_kind := 'coach_chat';
    when 'chat' then quota_kind := 'coach_chat';
    else return false;
  end case;
  select s.requests_limit, s.period into quota_limit, quota_period
    from public.ai_quota_settings s where s.kind = quota_kind;
  if quota_limit is null then return false; end if;
  quota_bucket := date_trunc(quota_period, now() at time zone 'UTC') at time zone 'UTC';
  insert into public.ai_request_limits as limits (user_id, kind, bucket, requests)
  values (owner, quota_kind, quota_bucket, 1)
  on conflict on constraint ai_request_limits_pkey do update
    set requests = limits.requests + 1 where limits.requests < quota_limit
  returning requests into accepted;
  return accepted is not null;
end;
$$;
revoke execute on function public.consume_ai_request(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_ai_request(uuid, text) to service_role;

-- Keeps previously deployed callers compatible with the shared quota.
create or replace function public.consume_meal_analysis(owner uuid)
returns boolean language sql security definer set search_path = '' as $$
  select public.consume_ai_request(owner, 'meal');
$$;
revoke execute on function public.consume_meal_analysis(uuid) from public, anon, authenticated;
grant execute on function public.consume_meal_analysis(uuid) to service_role;

create or replace function public.cleanup_integration_limits()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.meal_analysis_limits where hour_bucket < now() - interval '7 days';
  delete from public.health_steps_limits where hour_bucket < now() - interval '7 days';
  delete from public.ai_request_limits where bucket < now() - interval '7 days';
end;
$$;
revoke execute on function public.cleanup_integration_limits() from public, anon, authenticated;
grant execute on function public.cleanup_integration_limits() to service_role;
-- Reuse the existing named cron job. No duplicates on rerun.
select cron.schedule('vitra-cleanup-integration-limits', '17 * * * *', 'select public.cleanup_integration_limits();');

commit;
