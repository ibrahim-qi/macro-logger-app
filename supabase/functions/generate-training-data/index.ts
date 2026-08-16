import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  parseMealWithResearch,
  type NanoGptConfig,
} from '../_shared/mealParseFlow.ts';
import { generateSyntheticMeals } from '../_shared/syntheticMeals.ts';
import type { ParsedFoodItem } from '../_shared/normalizeItems.ts';

/** Defaults. Each meal costs several LLM + Serper/OFF calls, so keep the batch
 *  small. A scheduled run should stay well under the Edge Function wall clock. */
const DEFAULT_COUNT = 10;
const MAX_COUNT = 40;

function getTrainingConfig(): NanoGptConfig {
  const apiKey = Deno.env.get('NANOGPT_API_KEY');
  if (!apiKey) throw new Error('NANOGPT_API_KEY is not configured');
  return {
    apiKey,
    baseUrl: Deno.env.get('NANOGPT_BASE_URL') ?? 'https://nano-gpt.com/api/v1',
    model: Deno.env.get('NANOGPT_PARSE_MODEL') ?? 'google/gemini-3.6-flash',
    interpretationModel: Deno.env.get('NANOGPT_INTERPRETATION_MODEL') ?? 'openai/gpt-5.6-terra',
    extractionModel: Deno.env.get('NANOGPT_EXTRACTION_MODEL') ?? 'google/gemini-3.5-flash-lite',
    fallbackModel: Deno.env.get('NANOGPT_FALLBACK_MODEL') || undefined,
  };
}

/** Only keep meals whose every item resolved to a real source. Anything
 *  'unavailable' or estimated would poison the training labels. */
function isCleanTrainingMeal(items: ParsedFoodItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((item) => item.evidence_status === 'uk_evidence');
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Gate: this function spends real money on LLM/Serper calls, so it must never
  // be publicly triggerable. Accept the service-role key or a configured cron
  // secret (for scheduled invocation without exposing the service key).
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('TRAINING_CRON_SECRET');
  const authorized =
    (Boolean(serviceKey) && req.headers.get('Authorization') === `Bearer ${serviceKey}`) ||
    (Boolean(cronSecret) && req.headers.get('x-cron-secret') === cronSecret);
  if (!authorized) return jsonResponse({ error: 'Unauthorized' }, 401);

  let count = DEFAULT_COUNT;
  let seed: number | undefined;
  if (req.method === 'POST') {
    try {
      const body = await req.json() as { count?: number; seed?: number };
      if (typeof body.count === 'number') {
        count = Math.max(1, Math.min(MAX_COUNT, Math.floor(body.count)));
      }
      if (typeof body.seed === 'number') seed = body.seed;
    } catch {
      // Non-JSON body — fall back to defaults.
    }
  }

  const config = getTrainingConfig();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const meals = generateSyntheticMeals(count, seed ?? Math.floor(Math.random() * 1e9));

  let generated = 0;
  let parsed = 0;
  let stored = 0;
  let rejected = 0;
  let unclean = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const mealText of meals) {
    generated++;
    try {
      const result = await parseMealWithResearch(mealText, config, {}, {});
      if (!isCleanTrainingMeal(result.items)) {
        unclean++;
        continue;
      }
      const { error } = await supabase
        .from('parse_training_examples')
        .upsert(
          {
            transcript: mealText,
            items: result.items,
            notes: result.notes ?? null,
            source: 'synthetic',
            parse_path: result.parse_path ?? null,
          },
          { onConflict: 'transcript', ignoreDuplicates: true },
        );
      if (error) {
        failed++;
        errors.push(`${mealText}: ${error.message}`);
      } else {
        stored++;
      }
      parsed++;
    } catch (err) {
      rejected++;
      if (err instanceof Error) errors.push(`${mealText}: ${err.message}`);
    }
  }

  return jsonResponse({
    generated,
    parsed,
    stored,
    rejected,
    unclean,
    failed,
    errors: errors.slice(0, 10),
  });
});
