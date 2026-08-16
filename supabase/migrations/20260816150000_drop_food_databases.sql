-- Revert the "own food database / self-training" experiment. The parser now
-- relies solely on Serper (Google) verification: no Open Food Facts, no
-- nutrition cache, no synthetic training dataset.

select cron.unschedule('generate-training-data-daily');

drop table if exists public.parse_training_examples;
drop table if exists public.app_config;
drop table if exists public.food_nutrition_cache;
