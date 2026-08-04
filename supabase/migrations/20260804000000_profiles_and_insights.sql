-- Profiles: display name and preferences
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/London',
  locale text not null default 'en-GB',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Daily AI insight cache (one per user per day)
create table if not exists public.daily_insights (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_date date not null,
  insight_text text not null,
  created_at timestamptz not null default now(),
  unique (user_id, insight_date)
);

alter table public.daily_insights enable row level security;

create policy "Users can read own insights"
  on public.daily_insights for select
  using (auth.uid() = user_id);

create policy "Users can insert own insights"
  on public.daily_insights for insert
  with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_name text;
begin
  raw_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  insert into public.profiles (id, display_name, onboarding_completed)
  values (new.id, raw_name, raw_name is not null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
