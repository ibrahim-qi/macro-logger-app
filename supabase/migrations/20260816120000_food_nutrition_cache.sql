-- Self-populating nutrition cache: verified food -> per-100g macros, keyed per user.
-- Populated by verified lookups (source 'ai') and later by user corrections (source 'user').
create table if not exists public.food_nutrition_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  calories_100g numeric,
  protein_100g numeric,
  carbs_100g numeric,
  fat_100g numeric,
  source text not null default 'ai',
  source_url text,
  updated_at timestamptz not null default now(),
  primary key (user_id, food_name)
);

alter table public.food_nutrition_cache enable row level security;

create policy "food_nutrition_cache_owner_access"
  on public.food_nutrition_cache
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
