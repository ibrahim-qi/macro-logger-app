import { applyMacroSanity } from './macroSanity.ts';
import { sanifyInterpretationPortions } from './interpretationPortionSanity.ts';
import { findSavedFoodMatch, type SavedFoodMacros } from './applySavedFoods.ts';
import { ParseRejectionError } from './parseRejection.ts';
import { MEAL_HINT } from './transcriptValidation.ts';
import {
  buildEvidenceUserMessage,
  buildInterpretationSystemPrompt,
  buildRelatedFoodUserMessage,
  buildSelfCheckUserMessage,
  EVIDENCE_EXTRACTION_SYSTEM_PROMPT,
  INTERPRETATION_SELF_CHECK_SYSTEM_PROMPT,
  MEAL_INTERPRETATION_SCHEMA,
  NUTRITION_EVIDENCE_SCHEMA,
  PARSE_TEMPERATURE,
  RELATED_FOOD_SCHEMA,
  RELATED_FOOD_SYSTEM_PROMPT,
  type InterpretedMealItem,
  type MealInterpretation,
  type NutritionEvidenceFact,
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
  reasoningEffort: string = 'low',
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
      if (includeReasoningEffort) body.reasoning_effort = reasoningEffort;

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

async function selfCheckInterpretation(
  config: NanoGptConfig,
  mealText: string,
  interpretation: MealInterpretation,
): Promise<MealInterpretation> {
  try {
    const raw = await callNanoGptJson<MealInterpretation>(
      config,
      config.interpretationModel ?? config.model,
      INTERPRETATION_SELF_CHECK_SYSTEM_PROMPT,
      buildSelfCheckUserMessage(mealText, interpretation.items),
      'meal_interpretation_refined',
      MEAL_INTERPRETATION_SCHEMA as unknown as Record<string, unknown>,
      INTERPRETATION_MAX_TOKENS,
      'medium',
    );
    const corrected = normalizeInterpretation(raw);
    // Preserve the validated input assessment; the self-check only refines items.
    corrected.input_assessment = interpretation.input_assessment;
    // Guard: never lose items the first pass correctly found. If the self-check
    // returns fewer items (partial drop or merge), keep the first pass.
    if (corrected.items.length < interpretation.items.length) return interpretation;
    return corrected;
  } catch (error) {
    console.warn('[parse] interpretation self-check failed; keeping first pass', error);
    return interpretation;
  }
}

interface ResolvedNutrition {
  values: ComputedNutrition;
  fact: NutritionFactBase;
  evidence_status: 'uk_evidence' | 'related_match';
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

async function proposeRelatedFoods(
  config: NanoGptConfig,
  mealText: string,
  items: InterpretedMealItem[],
): Promise<Map<string, { food_name: string; search_query: string }>> {
  const replacements = new Map<string, { food_name: string; search_query: string }>();
  try {
    const raw = await callNanoGptJson<{
      replacements: Array<{ item_id: string; food_name: string; search_query: string }>;
    }>(
      config,
      config.extractionModel ?? config.model,
      RELATED_FOOD_SYSTEM_PROMPT,
      buildRelatedFoodUserMessage(mealText, items),
      'related_food',
      RELATED_FOOD_SCHEMA as unknown as Record<string, unknown>,
      EXTRACTION_MAX_TOKENS,
    );
    for (const replacement of raw.replacements ?? []) {
      const itemId = String(replacement.item_id ?? '').trim();
      const foodName = String(replacement.food_name ?? '').trim();
      if (itemId && foodName) {
        replacements.set(itemId, { food_name: foodName, search_query: '' });
      }
    }
  } catch (error) {
    console.warn('[parse] related-food proposal failed', error);
  }
  return replacements;
}

/** Strip brand tokens from a food name so a prepared/branded item can be
 *  generalized deterministically when the related-food model proposes nothing. */
function stripBrand(foodName: string): string {
  return foodName.replace(UK_BRAND_NAME_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

/** Tag a resolution that came from a generalized (related) food rather than the
 *  exact item, so the review sheet can show it is a closest match — still
 *  source-verified, never an estimate. */
function markAsRelated(
  value: ResolvedNutrition,
  genericFoodName: string,
): ResolvedNutrition {
  return {
    ...value,
    fact: {
      ...value.fact,
      confidence: value.fact.confidence === 'high' ? 'medium' : value.fact.confidence,
    },
    evidence_status: 'related_match',
    source_note: `Closest verified match: ${genericFoodName}`,
  };
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
    'high',
  );
  const firstPass = sanifyInterpretationPortions(
    normalizeInterpretation(rawInterpretation),
    mealText,
  );
  rejectInterpretation(firstPass, mealText);
  const interpretation = sanifyInterpretationPortions(
    await selfCheckInterpretation(config, mealText, firstPass),
    mealText,
  );
  rejectInterpretation(interpretation, mealText);
  const interpretationMs = Math.round(nowMs() - interpretationStartedAt);

  const savedByItem = new Map<string, SavedFoodMacros>();
  for (const item of interpretation.items) {
    const saved = findSavedFoodMatch(item.food_name, context.savedFoods ?? [], mealText);
    if (saved) savedByItem.set(item.item_id, saved);
  }

  const resolved = new Map<string, ResolvedNutrition>();

  const researchItems = interpretation.items.filter(
    (item) => !savedByItem.has(item.item_id),
  );

  let research: ItemSearchResult[] = [];
  let serperMs: number | undefined;
  let extractionMs: number | undefined;

  if (researchItems.length && searchApiKey) {
    onProgress?.('looking_up');
    const searchStartedAt = nowMs();
    research = await searchMealItems(researchItems, searchApiKey, {
      maxItems: options?.maxSearches,
    });
    serperMs = Math.round(nowMs() - searchStartedAt);

    // Direct facts from snippets (no LLM).
    for (const [itemId, value] of evidenceResolutions(
      extractDirectEvidenceFacts(research),
      researchItems,
      research,
    )) {
      resolved.set(itemId, value);
    }

    // LLM extraction for the rest — strict, only when the snippet supports it.
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

  // Related-food fallback — never leave an item "unavailable". If the exact
  // food couldn't be verified, generalize it and verify the closest match
  // against Google so every item still resolves to a real source.
  const stillUnresolved = researchItems.filter((item) => !resolved.has(item.item_id));
  if (stillUnresolved.length && searchApiKey) {
    const related = await proposeRelatedFoods(config, mealText, stillUnresolved);
    const generalized: InterpretedMealItem[] = [];
    for (const item of stillUnresolved) {
      const replacement = related.get(item.item_id);
      const name = (replacement?.food_name || stripBrand(item.food_name)).trim();
      if (!name) continue;
      generalized.push({
        ...item,
        food_name: name,
        // General nutrition query — prepared foods rarely publish per-100g, so
        // ask broadly and let the extractor pick per-serving/per-100g.
        search_query: `${name} calories protein carbs fat`,
      });
    }
    console.log('[parse] related-food fallback', {
      unresolved: stillUnresolved.map((i) => i.food_name),
      proposed: Array.from(related.values()).map((r) => r.food_name),
      generalized: generalized.map((i) => i.food_name),
    });
    if (generalized.length) {
      const fallbackResearch = await searchMealItems(generalized, searchApiKey, {
        maxItems: options?.maxSearches,
        relaxed: true,
      });

      for (const [itemId, value] of evidenceResolutions(
        extractDirectEvidenceFacts(fallbackResearch),
        generalized,
        fallbackResearch,
      )) {
        const generic = generalized.find((item) => item.item_id === itemId);
        resolved.set(itemId, markAsRelated(value, generic?.food_name ?? ''));
      }

      const stillGeneralized = generalized.filter((item) => !resolved.has(item.item_id));
      if (stillGeneralized.length) {
        for (const [itemId, value] of (await extractEvidenceBatches(
          config,
          mealText,
          stillGeneralized,
          fallbackResearch,
        )).entries()) {
          const generic = generalized.find((item) => item.item_id === itemId);
          resolved.set(itemId, markAsRelated(value, generic?.food_name ?? ''));
        }
      }
    }
  }
  onProgress?.('estimating');

  const items = applyMacroSanity(
    normalizeItems(interpretation.items.map((item) => {
      const saved = savedByItem.get(item.item_id);
      return saved ? savedFoodItem(item, saved) : resolvedItem(item, resolved.get(item.item_id));
    })),
  );

  const evidenceCount = items.filter((item) => item.evidence_status === 'uk_evidence').length;
  const unavailableCount = items.filter((item) => item.evidence_status === 'unavailable').length;
  const notes = [
    interpretation.notes,
    unavailableCount
      ? `${unavailableCount} item${unavailableCount === 1 ? '' : 's'} could not be verified; review before logging.`
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
    total_ms: Math.round(nowMs() - startedAt),
    path,
  });
}
