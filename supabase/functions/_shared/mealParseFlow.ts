import { applyMacroSanity } from './macroSanity.ts';
import { sanifyInterpretationPortions } from './interpretationPortionSanity.ts';
import { findSavedFoodMatch, type SavedFoodMacros } from './applySavedFoods.ts';
import { ParseRejectionError } from './parseRejection.ts';
import { MEAL_HINT } from './transcriptValidation.ts';
import {
  buildEvidenceUserMessage,
  buildFallbackUserMessage,
  buildInterpretationSystemPrompt,
  EVIDENCE_EXTRACTION_SYSTEM_PROMPT,
  FALLBACK_ESTIMATION_SYSTEM_PROMPT,
  MEAL_INTERPRETATION_SCHEMA,
  NUTRITION_EVIDENCE_SCHEMA,
  NUTRITION_FALLBACK_SCHEMA,
  PARSE_TEMPERATURE,
  type InterpretedMealItem,
  type MealInterpretation,
  type NutritionEvidenceFact,
  type NutritionFallbackFact,
  type NutritionFactBase,
  type ParsePromptContext,
} from './mealParsePrompt.ts';
import {
  computeNutrition,
  extractDirectEvidenceFacts,
  validateEvidenceFact,
  type ComputedNutrition,
} from './nutritionCompute.ts';
import {
  formatItemResearchForPrompt,
  getSearchApiKey,
  searchMealItems,
  UK_BRAND_NAME_PATTERN,
  type ItemSearchResult,
} from './webSearch.ts';
import { normalizeItems, type ParsedFoodItem } from './normalizeItems.ts';

export interface ParseMealFlowResult {
  items: ParsedFoodItem[];
  notes?: string;
  research_used: boolean;
  searches_run: number;
  parse_path?: 'fast' | 'research';
  research_available?: boolean;
  timings?: ParseTimings;
}

export interface ParseTimings {
  interpretation_ms: number;
  serper_ms?: number;
  extraction_ms?: number;
  fallback_ms?: number;
  total_ms: number;
  path: 'fast' | 'research';
}

export interface NanoGptConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  interpretationModel?: string;
  extractionModel?: string;
  fallbackModel?: string;
}

export type ParseProgressStage = 'identifying' | 'looking_up' | 'estimating';

interface ParseFlowOptions {
  searchApiKey?: string;
  maxSearches?: number;
  onProgress?: (stage: ParseProgressStage) => void;
}

const INTERPRETATION_MAX_TOKENS = 3200;
const EXTRACTION_MAX_TOKENS = 1800;
const EXTRACTION_BATCH_SIZE = 6;
const FALLBACK_MAX_TOKENS = 1600;
const FALLBACK_BATCH_SIZE = 5;
const FALLBACK_SINGLE_MAX_TOKENS = 900;
const NANOGPT_TIMEOUT_MS = 45_000;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isParseTimingEnabled(): boolean {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get(name: string): string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  return (
    runtime.Deno?.env?.get('PARSE_TIMING') === '1' ||
    runtime.process?.env?.PARSE_TIMING === '1'
  );
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function attachTimings(
  result: ParseMealFlowResult,
  timings: ParseTimings,
): ParseMealFlowResult {
  if (isParseTimingEnabled()) console.log('[timing]', timings);
  return isParseTimingEnabled() ? { ...result, timings } : result;
}

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function callNanoGptJson<T>(
  config: NanoGptConfig,
  model: string,
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens: number,
): Promise<T> {
  let lastError: unknown;
  let includeReasoningEffort = true;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model,
        temperature: PARSE_TEMPERATURE,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: schemaName, strict: true, schema },
        },
      };
      if (includeReasoningEffort) body.reasoning_effort = 'low';

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(NANOGPT_TIMEOUT_MS),
      });

      if (!response.ok) {
        const detail = await response.text();
        if (
          response.status === 400 &&
          includeReasoningEffort &&
          /reasoning[_ -]?effort|unknown parameter|unsupported/i.test(detail)
        ) {
          includeReasoningEffort = false;
          lastError = new Error(`NanoGPT compatibility retry: ${detail.slice(0, 200)}`);
          continue;
        }
        const error = new Error(`NanoGPT error (${response.status}): ${detail}`);
        if (retryableStatus(response.status) && attempt < 2) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const payload = await response.json();
      const choice = payload?.choices?.[0];
      if (choice?.finish_reason === 'length') {
        throw new Error(`NanoGPT ${schemaName} response was truncated`);
      }
      const raw = choice?.message?.content;
      if (!raw) throw new Error(`NanoGPT ${schemaName} returned an empty response`);
      return JSON.parse(raw) as T;
    } catch (error) {
      lastError = error;
      if (
        error instanceof Error &&
        /^NanoGPT error \(4/.test(error.message)
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function positiveOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeInterpretation(raw: MealInterpretation): MealInterpretation {
  const seen = new Set<string>();
  const items = (Array.isArray(raw.items) ? raw.items : []).map((item, index) => {
    const generatedId = `item_${index + 1}`;
    const requestedId = String(item.item_id ?? '').trim();
    const itemId = requestedId && !seen.has(requestedId) ? requestedId : generatedId;
    seen.add(itemId);

    const foodName = String(item.food_name ?? '').trim();
    const quantity = Number(item.quantity);
    if (!foodName || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('The interpretation model returned an invalid meal item');
    }

    return {
      item_id: itemId,
      food_name: foodName,
      preparation: String(item.preparation ?? '').trim(),
      quantity,
      unit: item.unit === 'count' ? 'count' as const : 'serving' as const,
      portion_assumption: String(item.portion_assumption ?? '').trim(),
      reference_weight_g: positiveOrNull(item.reference_weight_g),
      reference_volume_ml: positiveOrNull(item.reference_volume_ml),
      search_query: String(item.search_query ?? '').trim(),
    };
  });

  return {
    input_assessment: raw.input_assessment,
    items,
    notes: String(raw.notes ?? '').trim(),
  };
}

function rejectInterpretation(
  interpretation: MealInterpretation,
  mealText: string,
): void {
  if (interpretation.input_assessment === 'nothing_eaten') {
    throw new ParseRejectionError('nothing_eaten', mealText, 4);
  }
  if (interpretation.input_assessment === 'no_food' || !interpretation.items.length) {
    throw new ParseRejectionError('no_meal_detected', mealText, 4);
  }
  const allNamesEmpty = interpretation.items.every((item) => !item.food_name);
  if (
    allNamesEmpty &&
    !MEAL_HINT.test(mealText) &&
    !UK_BRAND_NAME_PATTERN.test(mealText) &&
    !/\d/.test(mealText)
  ) {
    throw new ParseRejectionError('no_meal_detected', mealText, 4);
  }
}

interface ResolvedNutrition {
  values: ComputedNutrition;
  fact: NutritionFactBase;
  evidence_status: 'uk_evidence' | 'ai_estimate';
  source_note: string;
  source_title?: string;
  source_url?: string;
  evidence_quote?: string;
}

function evidenceResolutions(
  facts: NutritionEvidenceFact[],
  items: InterpretedMealItem[],
  research: ItemSearchResult[],
): Map<string, ResolvedNutrition> {
  const itemById = new Map(items.map((item) => [item.item_id, item]));
  const researchById = new Map(research.map((result) => [result.item_id, result]));
  const resolved = new Map<string, ResolvedNutrition>();

  for (const fact of facts) {
    if (resolved.has(fact.item_id)) continue;
    const item = itemById.get(fact.item_id);
    if (!item) continue;
    const validation = validateEvidenceFact(fact, researchById.get(fact.item_id));
    if (!validation.valid) {
      console.warn('[parse] rejected ungrounded evidence', {
        item_id: fact.item_id,
        reason: validation.reason,
      });
      continue;
    }
    const values = computeNutrition(item, fact);
    if (!values) continue;
    resolved.set(fact.item_id, {
      values,
      fact,
      evidence_status: 'uk_evidence',
      source_note: fact.source_title,
      source_title: fact.source_title,
      source_url: fact.source_url,
      evidence_quote: fact.evidence_quote,
    });
  }
  return resolved;
}

function fallbackResolutions(
  facts: NutritionFallbackFact[],
  items: InterpretedMealItem[],
): Map<string, ResolvedNutrition> {
  const itemById = new Map(items.map((item) => [item.item_id, item]));
  const resolved = new Map<string, ResolvedNutrition>();
  for (const fact of facts) {
    if (resolved.has(fact.item_id)) continue;
    const item = itemById.get(fact.item_id);
    if (!item) continue;
    const values = computeNutrition(item, fact);
    if (!values) continue;
    resolved.set(fact.item_id, {
      values,
      fact,
      evidence_status: 'ai_estimate',
      source_note: `AI estimate${fact.estimate_note ? ` — ${fact.estimate_note}` : ''}`,
      source_title: 'AI estimate',
    });
  }
  return resolved;
}

async function extractEvidenceBatches(
  config: NanoGptConfig,
  mealText: string,
  items: InterpretedMealItem[],
  research: ItemSearchResult[],
): Promise<Map<string, ResolvedNutrition>> {
  const resolved = new Map<string, ResolvedNutrition>();
  const researchById = new Map(research.map((result) => [result.item_id, result]));

  for (const batch of chunkArray(items, EXTRACTION_BATCH_SIZE)) {
    const batchResearch = batch
      .map((item) => researchById.get(item.item_id))
      .filter((result): result is ItemSearchResult => Boolean(result));
    if (!batchResearch.length) continue;

    try {
      const extracted = await callNanoGptJson<{ facts: NutritionEvidenceFact[] }>(
        config,
        config.extractionModel ?? config.model,
        EVIDENCE_EXTRACTION_SYSTEM_PROMPT,
        buildEvidenceUserMessage(mealText, batch, formatItemResearchForPrompt(batchResearch)),
        'nutrition_evidence',
        NUTRITION_EVIDENCE_SCHEMA as unknown as Record<string, unknown>,
        EXTRACTION_MAX_TOKENS,
      );
      for (const [itemId, value] of evidenceResolutions(
        extracted.facts ?? [],
        batch,
        research,
      )) {
        resolved.set(itemId, value);
      }
    } catch (error) {
      console.error('[parse] evidence extraction batch failed', error);
    }
  }

  return resolved;
}

async function estimateFallbackBatches(
  config: NanoGptConfig,
  mealText: string,
  items: InterpretedMealItem[],
): Promise<Map<string, ResolvedNutrition>> {
  const resolved = new Map<string, ResolvedNutrition>();

  for (const batch of chunkArray(items, FALLBACK_BATCH_SIZE)) {
    try {
      const fallback = await callNanoGptJson<{ facts: NutritionFallbackFact[] }>(
        config,
        config.fallbackModel ?? config.model,
        FALLBACK_ESTIMATION_SYSTEM_PROMPT,
        buildFallbackUserMessage(mealText, batch),
        'nutrition_fallback',
        NUTRITION_FALLBACK_SCHEMA as unknown as Record<string, unknown>,
        FALLBACK_MAX_TOKENS,
      );
      for (const [itemId, value] of fallbackResolutions(
        fallback.facts ?? [],
        batch,
      )) {
        resolved.set(itemId, value);
      }
    } catch (error) {
      console.error('[parse] AI nutrition fallback batch failed', error);
    }
  }

  const remaining = items.filter((item) => !resolved.has(item.item_id));
  for (const item of remaining) {
    try {
      const fallback = await callNanoGptJson<{ facts: NutritionFallbackFact[] }>(
        config,
        config.fallbackModel ?? config.model,
        FALLBACK_ESTIMATION_SYSTEM_PROMPT,
        buildFallbackUserMessage(mealText, [item]),
        'nutrition_fallback',
        NUTRITION_FALLBACK_SCHEMA as unknown as Record<string, unknown>,
        FALLBACK_SINGLE_MAX_TOKENS,
      );
      for (const [itemId, value] of fallbackResolutions(
        fallback.facts ?? [],
        [item],
      )) {
        resolved.set(itemId, value);
      }
    } catch (error) {
      console.error('[parse] AI nutrition fallback single-item failed', {
        item_id: item.item_id,
        food_name: item.food_name,
      }, error);
    }
  }

  return resolved;
}

function savedFoodItem(
  item: InterpretedMealItem,
  saved: SavedFoodMacros,
): ParsedFoodItem {
  return {
    item_id: item.item_id,
    food_name: saved.food_name,
    preparation: item.preparation || undefined,
    calories: Math.max(0, Number(saved.calories) || 0),
    protein: Math.max(0, Number(saved.protein) || 0),
    carbs: Math.max(0, Number(saved.carbs) || 0),
    fats: Math.max(0, Number(saved.fats) || 0),
    quantity: item.quantity,
    unit: item.unit,
    confidence: 'high',
    from_saved_food: true,
    portion_assumption: item.portion_assumption || undefined,
    reference_weight_g: item.reference_weight_g ?? undefined,
    reference_volume_ml: item.reference_volume_ml ?? undefined,
    evidence_status: 'user_saved',
    source_note: 'Your saved food',
    source_title: 'Your saved food',
  };
}

function resolvedItem(
  item: InterpretedMealItem,
  resolved: ResolvedNutrition | undefined,
): ParsedFoodItem {
  if (!resolved) {
    return {
      item_id: item.item_id,
      food_name: item.food_name,
      preparation: item.preparation || undefined,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      quantity: item.quantity,
      unit: item.unit,
      confidence: 'low',
      portion_assumption: item.portion_assumption || undefined,
      reference_weight_g: item.reference_weight_g ?? undefined,
      reference_volume_ml: item.reference_volume_ml ?? undefined,
      evidence_status: 'unavailable',
      source_note: 'Nutrition unavailable — review before logging',
    };
  }

  return {
    item_id: item.item_id,
    food_name: item.food_name,
    preparation: item.preparation || undefined,
    calories: resolved.values.calories,
    protein: resolved.values.protein,
    carbs: resolved.values.carbs,
    fats: resolved.values.fats,
    quantity: item.quantity,
    unit: item.unit,
    confidence: resolved.fact.confidence,
    portion_assumption: item.portion_assumption || undefined,
    reference_weight_g:
      item.reference_weight_g ??
      resolved.fact.serving_weight_g ??
      undefined,
    reference_volume_ml:
      item.reference_volume_ml ??
      resolved.fact.serving_volume_ml ??
      undefined,
    evidence_status: resolved.evidence_status,
    source_note: resolved.source_note,
    source_title: resolved.source_title,
    source_url: resolved.source_url,
    evidence_quote: resolved.evidence_quote,
  };
}

export async function parseMealWithResearch(
  mealText: string,
  config: NanoGptConfig,
  context: ParsePromptContext = {},
  options?: ParseFlowOptions,
): Promise<ParseMealFlowResult> {
  const startedAt = nowMs();
  const onProgress = options?.onProgress;
  const searchApiKey = options?.searchApiKey ?? getSearchApiKey();

  onProgress?.('identifying');
  const interpretationStartedAt = nowMs();
  const rawInterpretation = await callNanoGptJson<MealInterpretation>(
    config,
    config.interpretationModel ?? config.model,
    buildInterpretationSystemPrompt(context),
    mealText,
    'meal_interpretation',
    MEAL_INTERPRETATION_SCHEMA as unknown as Record<string, unknown>,
    INTERPRETATION_MAX_TOKENS,
  );
  const interpretation = sanifyInterpretationPortions(
    normalizeInterpretation(rawInterpretation),
    mealText,
  );
  rejectInterpretation(interpretation, mealText);
  const interpretationMs = Math.round(nowMs() - interpretationStartedAt);

  const savedByItem = new Map<string, SavedFoodMacros>();
  for (const item of interpretation.items) {
    const saved = findSavedFoodMatch(item.food_name, context.savedFoods ?? [], mealText);
    if (saved) savedByItem.set(item.item_id, saved);
  }
  const researchItems = interpretation.items.filter((item) => !savedByItem.has(item.item_id));

  let research: ItemSearchResult[] = [];
  let serperMs: number | undefined;
  let extractionMs: number | undefined;
  const resolved = new Map<string, ResolvedNutrition>();

  if (researchItems.length && searchApiKey) {
    onProgress?.('looking_up');
    const searchStartedAt = nowMs();
    research = await searchMealItems(researchItems, searchApiKey, {
      maxItems: options?.maxSearches,
    });
    serperMs = Math.round(nowMs() - searchStartedAt);

    for (const [itemId, value] of evidenceResolutions(
      extractDirectEvidenceFacts(research),
      researchItems,
      research,
    )) {
      resolved.set(itemId, value);
    }

    const usableIds = new Set(
      research
        .filter((result) => result.status === 'ok' && result.snippets.length)
        .map((result) => result.item_id),
    );
    const evidencedItems = researchItems.filter(
      (item) => usableIds.has(item.item_id) && !resolved.has(item.item_id),
    );

    if (evidencedItems.length) {
      const extractionStartedAt = nowMs();
      for (const [itemId, value] of (await extractEvidenceBatches(
        config,
        mealText,
        evidencedItems,
        research,
      )).entries()) {
        resolved.set(itemId, value);
      }
      extractionMs = Math.round(nowMs() - extractionStartedAt);
    }
  }

  const fallbackItems = researchItems.filter((item) => !resolved.has(item.item_id));
  let fallbackMs: number | undefined;
  if (fallbackItems.length) {
    onProgress?.('estimating');
    const fallbackStartedAt = nowMs();
    for (const [itemId, value] of (await estimateFallbackBatches(
      config,
      mealText,
      fallbackItems,
    )).entries()) {
      resolved.set(itemId, value);
    }
    fallbackMs = Math.round(nowMs() - fallbackStartedAt);
  } else {
    onProgress?.('estimating');
  }

  const items = applyMacroSanity(
    normalizeItems(interpretation.items.map((item) => {
      const saved = savedByItem.get(item.item_id);
      return saved ? savedFoodItem(item, saved) : resolvedItem(item, resolved.get(item.item_id));
    })),
  );

  const evidenceCount = items.filter((item) => item.evidence_status === 'uk_evidence').length;
  const estimateCount = items.filter((item) => item.evidence_status === 'ai_estimate').length;
  const unavailableCount = items.filter((item) => item.evidence_status === 'unavailable').length;
  const notes = [
    interpretation.notes,
    estimateCount ? `${estimateCount} item${estimateCount === 1 ? '' : 's'} used an AI estimate.` : '',
    unavailableCount
      ? `${unavailableCount} item${unavailableCount === 1 ? '' : 's'} could not be estimated; review before logging.`
      : '',
  ].filter(Boolean).join(' ').trim() || undefined;
  const path = evidenceCount > 0 ? 'research' as const : 'fast' as const;

  return attachTimings({
    items,
    notes,
    research_used: evidenceCount > 0,
    searches_run: research.length,
    parse_path: path,
    research_available: Boolean(searchApiKey),
  }, {
    interpretation_ms: interpretationMs,
    serper_ms: serperMs,
    extraction_ms: extractionMs,
    fallback_ms: fallbackMs,
    total_ms: Math.round(nowMs() - startedAt),
    path,
  });
}
