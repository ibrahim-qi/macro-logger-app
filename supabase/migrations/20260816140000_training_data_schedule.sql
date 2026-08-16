-- Run the synthetic training-data generator daily (off-peak). The generator
-- spends LLM/Serper money, so it is gated by a scoped cron secret. The secret
-- lives in app_config (seeded out-of-band via the service role) and as the Edge
-- Function's TRAINING_CRON_SECRET env var — it is NOT committed in this file.
-- The Authorization header uses the public anon key (already shipped to clients)
-- only to pass the Edge Function's JWT gate; the real gate is x-cron-secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;
-- No public policies: readable only by service role (and postgres cron jobs).

select cron.schedule(
  'generate-training-data-daily',
  '0 3 * * *',  -- 03:00 UTC daily
  $$
  select net.http_post(
    url := 'https://mpecczwugkzvimxtgstg.supabase.co/functions/v1/generate-training-data',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wZWNjend1Z2t6dmlteHRnc3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzgzMTgsImV4cCI6MjA2MjY1NDMxOH0.e1fE5qbhNQmJ-nEn8cWpcNptTTROK05z3l64LLMd5WM',
      'x-cron-secret', coalesce((select value from public.app_config where key = 'training_cron_secret'), ''),
      'Content-Type', 'application/json'
    ),
    body := '{"count": 10}'
  );
  $$
);
