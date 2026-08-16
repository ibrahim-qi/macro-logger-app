/**
 * Mirrors supabase/functions parse-meal research-augmented flow.
 * Keep in sync when mealParseFlow.ts changes.
 */

import type { ParsedItem } from './metrics.ts';
import { normalizeItems, type ParsedFoodItem } from '../../supabase/functions/_shared/normalizeItems.ts';
import { parseMealWithResearch } from '../../supabase/functions/_shared/mealParseFlow.ts';

export interface ParseConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  interpretationModel?: string;
  extractionModel?: string;
  fallbackModel?: string;
  searchApiKey?: string;
}

export function postProcessParsedItems(items: ParsedFoodItem[]): ParsedItem[] {
  return normalizeItems(items);
}

export async function parseMealTextRaw(text: string, config: ParseConfig) {
  const result = await parseMealWithResearch(
    text,
    {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://nano-gpt.com/api/v1',
      model: config.model,
      interpretationModel: config.interpretationModel ?? process.env.NANOGPT_INTERPRETATION_MODEL ?? 'openai/gpt-5.6-terra',
      extractionModel:
        config.extractionModel ??
        process.env.NANOGPT_EXTRACTION_MODEL ??
        'google/gemini-3.5-flash-lite',
      fallbackModel: config.fallbackModel ?? process.env.NANOGPT_FALLBACK_MODEL ?? undefined,
    },
    {},
    { searchApiKey: config.searchApiKey ?? process.env.SERPER_API_KEY },
  );
  return result;
}

export async function parseMealText(text: string, config: ParseConfig): Promise<ParsedItem[]> {
  const result = await parseMealTextRaw(text, config);
  return postProcessParsedItems(result.items);
}
