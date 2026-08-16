-- Self-owned fine-tuning dataset: (transcript -> verified items) pairs.
-- Populated by the generate-training-data Edge Function (service role). Each
-- row's items are source-verified by the parse pipeline (Open Food Facts /
-- Serper) — never AI estimates. Keyed on transcript so re-runs are idempotent.
create table if not exists public.parse_training_examples (
  transcript text primary key,
  items jsonb not null,
  notes text,
  source text not null default 'synthetic',
  parse_path text,
  created_at timestamptz not null default now()
);

alter table public.parse_training_examples enable row level security;

-- No public policies: only the service role (the generator function, and a
-- future export/fine-tune job) can read or write. Client roles cannot touch it.
