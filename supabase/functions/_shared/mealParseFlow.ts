import { normalizeItems, type ParsedFoodItem } from './normalizeItems.ts';
import { applyMacroSanity } from './macroSanity.ts';
import {
  buildEstimateSystemPrompt,
  buildEstimateUserMessage,
  buildInterpretSystemPrompt,
  MEAL_INTERPRET_SCHEMA,
  MEAL_PARSE_SCHEMA,
  PARSE_TEMPERATURE,
  type InterpretResult,
  type ParsePromptContext,
} from './mealParsePrompt.ts';
import { shouldUseFastParse } from './parseFastPath.ts';
import {
  collectSearchQueries,
  formatResearchForPrompt,
  getSearchApiKey,
  runMealResearch,
} from './webSearch.ts';

export interface ParseMealFlowResult {
  items: ParsedFoodItem[];
  notes?: string;
  research_used: boolean;
  searches_run: number;
  parse_path?: 'fast' | 'research';
  research_available?: boolean;
}

interface NanoGptConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_MAX_SEARCHES = 2;

async function callNanoGptJson<T>(
  config: NanoGptConfig,
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: PARSE_TEMPERATURE,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`NanoGPT error (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const rawText = payload?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('NanoGPT returned an empty response');

  return JSON.parse(rawText) as T;
}

function parseConfidence(value: unknown): 'high' | 'medium' | 'low' | undefined {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return undefined;
}

function toParsedItems(raw: {
  items: Array<Record<string, unknown>>;
}): ParsedFoodItem[] {
  return raw.items.map((item) => ({
    food_name: String(item.food_name).trim(),
    calories: Math.max(0, Number(item.calories) || 0),
    protein: Math.max(0, Number(item.protein) || 0),
    carbs: Math.max(0, Number(item.carbs) || 0),
    fats: Math.max(0, Number(item.fats) || 0),
    quantity: Math.max(0.01, Number(item.quantity) || 1),
    confidence: parseConfidence(item.confidence),
    portion_assumption: String(item.portion_assumption ?? '').trim() || undefined,
    source_note: String(item.source_note ?? '').trim() || undefined,
  }));
}

function finalizeItems(raw: { items: Array<Record<string, unknown>>; notes?: string }): {
  items: ParsedFoodItem[];
  notes?: string;
} {
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new Error('No food items could be parsed from that description');
  }
  return {
    items: applyMacroSanity(normalizeItems(toParsedItems(raw))),
    notes: raw.notes?.trim() || undefined,
  };
}

/** One LLM call — simple meals with explicit portions only. */
async function parseMealFast(
  mealText: string,
  config: NanoGptConfig,
  context: ParsePromptContext,
): Promise<ParseMealFlowResult> {
  const estimated = await callNanoGptJson<{ items: Array<Record<string, unknown>>; notes?: string }>(
    config,
    buildEstimateSystemPrompt(context),
    mealText,
    'meal_parse',
    MEAL_PARSE_SCHEMA,
  );

  const { items, notes } = finalizeItems(estimated);
  return { items, notes, research_used: false, searches_run: 0, parse_path: 'fast', research_available: true };
}

/** Interpret → UK search → estimate. */
async function parseMealResearch(
  mealText: string,
  config: NanoGptConfig,
  context: ParsePromptContext,
  options?: { searchApiKey?: string; maxSearches?: number },
): Promise<ParseMealFlowResult> {
  const interpreted = await callNanoGptJson<InterpretResult>(
    config,
    buildInterpretSystemPrompt(context),
    mealText,
    'meal_interpret',
    MEAL_INTERPRET_SCHEMA,
  );

  if (!Array.isArray(interpreted.items) || interpreted.items.length === 0) {
    throw new Error('No food items could be interpreted from that description');
  }

  const searchApiKey = options?.searchApiKey ?? getSearchApiKey();
  const maxSearches = options?.maxSearches ?? DEFAULT_MAX_SEARCHES;
  const queries = collectSearchQueries(interpreted.items, maxSearches);

  let researchBlock = '';
  let searchesRun = 0;
  const researchAvailable = Boolean(searchApiKey);

  if (searchApiKey && queries.length) {
    const results = await runMealResearch(queries, searchApiKey, maxSearches);
    searchesRun = results.length;
    researchBlock = formatResearchForPrompt(results);
  }

  const estimated = await callNanoGptJson<{ items: Array<Record<string, unknown>>; notes?: string }>(
    config,
    buildEstimateSystemPrompt(context),
    buildEstimateUserMessage(mealText, interpreted, researchBlock),
    'meal_parse',
    MEAL_PARSE_SCHEMA,
  );

  const { items, notes } = finalizeItems(estimated);
  const researchNote = !researchAvailable && queries.length > 0
    ? 'UK web lookup is not configured — estimates use the model only.'
    : undefined;
  const mergedNotes = [notes, researchNote].filter(Boolean).join(' ').trim() || undefined;

  return {
    items,
    notes: mergedNotes,
    research_used: searchesRun > 0,
    searches_run: searchesRun,
    parse_path: 'research',
    research_available: researchAvailable,
  };
}

export async function parseMealWithResearch(
  mealText: string,
  config: NanoGptConfig,
  context: ParsePromptContext = {},
  options?: { searchApiKey?: string; maxSearches?: number },
): Promise<ParseMealFlowResult> {
  if (shouldUseFastParse(mealText)) {
    try {
      return await parseMealFast(mealText, config, context);
    } catch {
      // Fall back to full research flow on fast-path failure.
    }
  }

  return parseMealResearch(mealText, config, context, options);
}
