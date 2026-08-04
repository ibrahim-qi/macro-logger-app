-- Core app tables, RLS, summary RPCs, and timezone-aware day filtering

-- ---------------------------------------------------------------------------
-- food_entries
-- ---------------------------------------------------------------------------
create table if not exists public.food_entries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_name text not null,
  calories numeric not null,
  protein numeric,
  carbs numeric,
  fats numeric,
  quantity numeric not null default 1
);

create index if not exists food_entries_user_id_created_at_idx
  on public.food_entries (user_id, created_at desc);

alter table public.food_entries enable row level security;

drop policy if exists "Users can read own food entries" on public.food_entries;
create policy "Users can read own food entries"
  on public.food_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own food entries" on public.food_entries;
create policy "Users can insert own food entries"
  on public.food_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own food entries" on public.food_entries;
create policy "Users can update own food entries"
  on public.food_entries for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own food entries" on public.food_entries;
create policy "Users can delete own food entries"
  on public.food_entries for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- saved_foods
-- ---------------------------------------------------------------------------
create table if not exists public.saved_foods (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_name text not null,
  calories numeric not null,
  protein numeric,
  carbs numeric,
  fats numeric
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_foods_user_id_food_name_key'
      and conrelid = 'public.saved_foods'::regclass
  ) then
    alter table public.saved_foods
      add constraint saved_foods_user_id_food_name_key unique (user_id, food_name);
  end if;
end $$;

alter table public.saved_foods enable row level security;

drop policy if exists "Users can read own saved foods" on public.saved_foods;
create policy "Users can read own saved foods"
  on public.saved_foods for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved foods" on public.saved_foods;
create policy "Users can insert own saved foods"
  on public.saved_foods for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own saved foods" on public.saved_foods;
create policy "Users can update own saved foods"
  on public.saved_foods for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own saved foods" on public.saved_foods;
create policy "Users can delete own saved foods"
  on public.saved_foods for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_goals
-- ---------------------------------------------------------------------------
create table if not exists public.user_goals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  daily_calories_goal numeric not null,
  daily_protein_goal numeric not null,
  daily_carbs_goal numeric not null,
  daily_fats_goal numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_goals_user_id_key'
      and conrelid = 'public.user_goals'::regclass
  ) then
    alter table public.user_goals
      add constraint user_goals_user_id_key unique (user_id);
  end if;
end $$;

alter table public.user_goals enable row level security;

drop policy if exists "Users can read own goals" on public.user_goals;
create policy "Users can read own goals"
  on public.user_goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own goals" on public.user_goals;
create policy "Users can insert own goals"
  on public.user_goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own goals" on public.user_goals;
create policy "Users can update own goals"
  on public.user_goals for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own goals" on public.user_goals;
create policy "Users can delete own goals"
  on public.user_goals for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime for food_entries
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'food_entries'
  ) then
    alter publication supabase_realtime add table public.food_entries;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Timezone helper
-- ---------------------------------------------------------------------------
create or replace function public.get_user_timezone(p_user_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select timezone from public.profiles where id = p_user_id),
    'UTC'
  );
$$;

-- Drop legacy summary RPCs first (return types may differ)
drop function if exists public.get_weekly_summary(uuid, date);
drop function if exists public.get_monthly_summary(uuid, integer, integer);

-- ---------------------------------------------------------------------------
-- Weekly summary (Sunday-start week in the user's timezone)
-- ---------------------------------------------------------------------------
create function public.get_weekly_summary(
  p_user_id uuid,
  p_target_date date
)
returns table (
  total_calories numeric,
  total_protein numeric,
  total_carbs numeric,
  total_fats numeric,
  entry_count bigint,
  days_logged bigint,
  week_start_display text,
  week_end_display text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_week_start date;
  v_week_end date;
  v_range_start timestamptz;
  v_range_end timestamptz;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;

  v_tz := public.get_user_timezone(p_user_id);
  v_week_start := p_target_date - extract(dow from p_target_date)::int;
  v_week_end := v_week_start + 6;

  v_range_start := v_week_start::timestamp at time zone v_tz;
  v_range_end := (v_week_end::timestamp + time '23:59:59.999') at time zone v_tz;

  return query
  select
    coalesce(sum(f.calories * coalesce(f.quantity, 1)), 0)::numeric as total_calories,
    coalesce(sum(f.protein * coalesce(f.quantity, 1)), 0)::numeric as total_protein,
    coalesce(sum(f.carbs * coalesce(f.quantity, 1)), 0)::numeric as total_carbs,
    coalesce(sum(f.fats * coalesce(f.quantity, 1)), 0)::numeric as total_fats,
    count(*)::bigint as entry_count,
    count(distinct (f.created_at at time zone v_tz)::date)::bigint as days_logged,
    to_char(v_week_start, 'YYYY-MM-DD') as week_start_display,
    to_char(v_week_end, 'YYYY-MM-DD') as week_end_display
  from public.food_entries f
  where f.user_id = p_user_id
    and f.created_at >= v_range_start
    and f.created_at <= v_range_end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Monthly summary (calendar month in the user's timezone)
-- ---------------------------------------------------------------------------
create function public.get_monthly_summary(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  total_calories numeric,
  total_protein numeric,
  total_carbs numeric,
  total_fats numeric,
  entry_count bigint,
  days_logged bigint,
  month_display text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_month_start date;
  v_month_end date;
  v_range_start timestamptz;
  v_range_end timestamptz;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;

  v_tz := public.get_user_timezone(p_user_id);
  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  v_range_start := v_month_start::timestamp at time zone v_tz;
  v_range_end := (v_month_end::timestamp + time '23:59:59.999') at time zone v_tz;

  return query
  select
    coalesce(sum(f.calories * coalesce(f.quantity, 1)), 0)::numeric as total_calories,
    coalesce(sum(f.protein * coalesce(f.quantity, 1)), 0)::numeric as total_protein,
    coalesce(sum(f.carbs * coalesce(f.quantity, 1)), 0)::numeric as total_carbs,
    coalesce(sum(f.fats * coalesce(f.quantity, 1)), 0)::numeric as total_fats,
    count(*)::bigint as entry_count,
    count(distinct (f.created_at at time zone v_tz)::date)::bigint as days_logged,
    to_char(v_month_start, 'FMMonth YYYY') as month_display
  from public.food_entries f
  where f.user_id = p_user_id
    and f.created_at >= v_range_start
    and f.created_at <= v_range_end;
end;
$$;

grant execute on function public.get_user_timezone(uuid) to authenticated;
grant execute on function public.get_weekly_summary(uuid, date) to authenticated;
grant execute on function public.get_monthly_summary(uuid, integer, integer) to authenticated;

-- Store browser timezone on signup when provided
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_name text;
  raw_tz text;
begin
  raw_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  raw_tz := nullif(trim(coalesce(new.raw_user_meta_data->>'timezone', '')), '');

  insert into public.profiles (id, display_name, timezone, onboarding_completed)
  values (
    new.id,
    raw_name,
    coalesce(raw_tz, 'Europe/London'),
    raw_name is not null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
