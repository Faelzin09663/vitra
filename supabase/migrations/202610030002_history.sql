begin;

-- This migration follows 202610030001_vitra.sql.
create table public.daily_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, recorded_on)
);
alter table public.daily_records enable row level security;
revoke all on public.daily_records from anon, authenticated;
grant select on public.daily_records to authenticated;
create policy "Read own daily history" on public.daily_records for select to authenticated
  using ((select auth.uid()) = user_id);

-- Daily archives are maintained atomically by the database, including the old
-- day before a client resets its dashboard. Clients cannot edit these directly.
create function public.archive_vitra_day() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  snapshot jsonb;
  snapshots jsonb[];
begin
  if tg_op = 'UPDATE' then snapshots := array[old.data, new.data];
  else snapshots := array[new.data]; end if;
  foreach snapshot in array snapshots loop
    if snapshot ->> 'day' ~ '^\d{2}/\d{2}/\d{4}$' then
      insert into public.daily_records (user_id, recorded_on, data)
      values (new.user_id, to_date(snapshot ->> 'day', 'DD/MM/YYYY'),
        jsonb_build_object(
          'day', snapshot -> 'day', 'water', coalesce(snapshot -> 'water', '0'::jsonb),
          'waterGoal', snapshot -> 'waterGoal', 'calorieGoal', snapshot -> 'calorieGoal',
          'meals', coalesce(snapshot -> 'meals', '[]'::jsonb),
          'sets', coalesce(snapshot -> 'sets', '{}'::jsonb)
        ))
      on conflict (user_id, recorded_on) do update set data = excluded.data, updated_at = now();
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.archive_vitra_day() from public, anon, authenticated;
create trigger archive_vitra_day after insert or update on public.user_data
  for each row execute function public.archive_vitra_day();

-- Backfill any existing dashboards without discarding their current records.
update public.user_data set data = data;
commit;
