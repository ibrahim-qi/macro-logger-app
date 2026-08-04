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
  searchApiKey?: string;
  /** Default true — set false to benchmark raw model quantity output */
  sanitizeQuantity?: boolean;
}

export function postProcessParsedItems(
  items: ParsedFoodItem[],
  sanitizeQuantity = true,
): ParsedItem[] {
  return normalizeItems(items, { sanitizeQuantity });
}

export async function parseMealTextRaw(text: string, config: ParseConfig) {
  const result = await parseMealWithResearch(
    text,
    {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://nano-gpt.com/api/v1',
      model: config.model,
    },
    {},
    { searchApiKey: config.searchApiKey ?? process.env.SERPER_API_KEY },
  );
  return result;
}

export async function parseMealText(text: string, config: ParseConfig): Promise<ParsedItem[]> {
  const result = await parseMealTextRaw(text, config);
  return postProcessParsedItems(result.items, config.sanitizeQuantity !== false);
}
