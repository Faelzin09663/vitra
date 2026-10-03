begin;

-- Passwords and identity are managed exclusively by Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  email text not null,
  created_at timestamptz not null default now()
);

-- One private dashboard per user. The JSON document preserves the current app model.
create table public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.user_data from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.user_data to authenticated;

create policy "Read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Read own dashboard" on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own dashboard" on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own dashboard" on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, trim(new.raw_user_meta_data ->> 'full_name'), new.email);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
create trigger on_auth_email_updated after update of email on auth.users
  for each row execute function public.sync_profile_email();

create function public.touch_user_data() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_user_data() from public, anon, authenticated;
create trigger user_data_updated before update on public.user_data
  for each row execute function public.touch_user_data();

commit;
