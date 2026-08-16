import type {
  InterpretedMealItem,
  NutritionEvidenceFact,
  NutritionFactBase,
} from './mealParsePrompt.ts';
import type { ItemSearchResult, SearchSnippet } from './webSearch.ts';

export interface ComputedNutrition {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  factor: number;
}

export interface MacroValidation {
  status: 'ok' | 'review';
  atwater_error_pct: number | null;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** True when a fact has a usable calorie value and basis. Macros may be null
 *  (kcal-only sources) — accepted and surfaced as unknown rather than rejected. */
export function hasCompleteNutrition(fact: NutritionFactBase): boolean {
  return (
    finiteNonNegative(fact.calories) &&
    finiteNonNegative(fact.basis_amount) &&
    fact.basis_amount > 0
  );
}

function normalizeEvidenceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function numericTokens(value: string): number[] {
  const matches = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches
    .map(Number)
    .filter((number) => Number.isFinite(number));
}

function quoteContainsNumber(quote: string, expected: number): boolean {
  return numericTokens(quote).some((actual) => {
    const tolerance = Math.max(0.11, Math.abs(expected) * 0.005);
    return Math.abs(actual - expected) <= tolerance;
  });
}

function matchingSnippet(
  fact: NutritionEvidenceFact,
  result: ItemSearchResult,
): SearchSnippet | undefined {
  return result.snippets.find(
    (snippet) =>
      snippet.title === fact.source_title &&
      snippet.link === fact.source_url,
  );
}

export interface EvidenceValidationResult {
  valid: boolean;
  reason?: string;
}

function labelledGrams(text: string, labels: string): number | null {
  const afterLabel = new RegExp(
    `\\b(?:${labels})\\b[^\\d]{0,16}(\\d+(?:\\.\\d+)?)\\s*g\\b`,
    'i',
  ).exec(text);
  if (afterLabel) return Number(afterLabel[1]);

  const beforeLabel = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*g\\b[^.;,]{0,16}\\b(?:${labels})\\b`,
    'i',
  ).exec(text);
  return beforeLabel ? Number(beforeLabel[1]) : null;
}

/**
 * Strict fast path for complete, explicitly based snippets. Ambiguous snippets
 * remain for the extraction model; this function never guesses a basis or value.
 */
export function extractDirectEvidenceFacts(
  results: ItemSearchResult[],
): NutritionEvidenceFact[] {
  const facts: NutritionEvidenceFact[] = [];

  for (const result of results) {
    if (result.status !== 'ok') continue;
    for (const snippet of result.snippets) {
      const basisMatch = snippet.snippet.match(/\bper\s*100\s*(g|ml)\b/i);
      if (!basisMatch) continue;

      const calorieMatch = snippet.snippet.match(/\b(\d+(?:\.\d+)?)\s*kcal\b/i);
      const protein = labelledGrams(snippet.snippet, 'protein');
      const carbs = labelledGrams(snippet.snippet, 'carbohydrates?|carbs?');
      const fats = labelledGrams(snippet.snippet, '(?:total\\s+)?fat');
      if (!calorieMatch || !finiteNonNegative(Number(calorieMatch[1]))) continue;

      facts.push({
        item_id: result.item_id,
        basis: basisMatch[1].toLowerCase() === 'ml' ? 'per_100ml' : 'per_100g',
        basis_amount: 100,
        calories: Number(calorieMatch[1]),
        protein,
        carbs,
        fats,
        serving_weight_g: null,
        serving_volume_ml: null,
        confidence: 'high',
        source_title: snippet.title,
        source_url: snippet.link,
        evidence_quote: snippet.snippet,
      });
      break;
    }
  }
  return facts;
}

/** Ensure a model extraction is grounded in the exact item-bound Serper evidence. */
export function validateEvidenceFact(
  fact: NutritionEvidenceFact,
  result: ItemSearchResult | undefined,
): EvidenceValidationResult {
  if (!result || result.item_id !== fact.item_id) {
    return { valid: false, reason: 'Evidence was not attached to this item' };
  }
  if (!hasCompleteNutrition(fact)) {
    return { valid: false, reason: 'Evidence did not contain a complete nutrition set' };
  }

  const snippet = matchingSnippet(fact, result);
  if (!snippet) {
    return { valid: false, reason: 'Source title or URL was not returned for this item' };
  }

  const quote = normalizeEvidenceText(fact.evidence_quote);
  const source = normalizeEvidenceText(snippet.snippet);
  if (!quote || !source.includes(quote)) {
    return { valid: false, reason: 'Evidence quote was not verbatim source text' };
  }

  const values = [fact.calories, fact.protein, fact.carbs, fact.fats]
    .filter((value): value is number => value != null);
  if (!values.every((value) => quoteContainsNumber(fact.evidence_quote, value))) {
    return { valid: false, reason: 'Evidence quote did not support every nutrition value' };
  }

  return { valid: true };
}

function scaleFactor(item: InterpretedMealItem, fact: NutritionFactBase): number | null {
  if (!Number.isFinite(fact.basis_amount) || fact.basis_amount <= 0) return null;

  switch (fact.basis) {
    case 'per_100g': {
      const mass = item.reference_weight_g ?? fact.serving_weight_g;
      if (mass && mass > 0) return mass / fact.basis_amount;
      // Volume-only items (drinks) resolved to per-100g evidence: approximate
      // ~1g/ml so the related-food fallback never leaves a drink unavailable.
      const volume = item.reference_volume_ml ?? fact.serving_volume_ml;
      if (volume && volume > 0) return volume / fact.basis_amount;
      return null;
    }
    case 'per_100ml':
      return (item.reference_volume_ml ?? fact.serving_volume_ml) &&
        (item.reference_volume_ml ?? fact.serving_volume_ml)! > 0
        ? (item.reference_volume_ml ?? fact.serving_volume_ml)! / fact.basis_amount
        : null;
    case 'per_item':
      return 1;
    case 'per_serving': {
      if (
        item.reference_weight_g &&
        fact.serving_weight_g &&
        item.reference_weight_g > 0 &&
        fact.serving_weight_g > 0
      ) {
        return item.reference_weight_g / fact.serving_weight_g;
      }
      if (
        item.reference_volume_ml &&
        fact.serving_volume_ml &&
        item.reference_volume_ml > 0 &&
        fact.serving_volume_ml > 0
      ) {
        return item.reference_volume_ml / fact.serving_volume_ml;
      }
      return 1;
    }
  }
}

function roundMacro(value: number): number {
  return Math.round(Math.max(0, value) * 10) / 10;
}

/** Compute per-unit macros. Quantity remains separate and is never applied here. */
export function computeNutrition(
  item: InterpretedMealItem,
  fact: NutritionFactBase,
): ComputedNutrition | null {
  if (fact.item_id !== item.item_id || !hasCompleteNutrition(fact)) return null;
  const factor = scaleFactor(item, fact);
  if (factor === null || !Number.isFinite(factor) || factor <= 0) return null;

  return {
    calories: Math.round((fact.calories as number) * factor),
    protein: fact.protein != null ? roundMacro((fact.protein as number) * factor) : null,
    carbs: fact.carbs != null ? roundMacro((fact.carbs as number) * factor) : null,
    fats: fact.fats != null ? roundMacro((fact.fats as number) * factor) : null,
    factor,
  };
}

/**
 * Labels can legitimately diverge from 4/4/9 due to fibre, polyols, alcohol, and
 * rounding. This metadata informs review; it never rewrites source calories.
 */
export function validateMacroConsistency(values: {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
}): MacroValidation {
  if (!Number.isFinite(values.calories) || values.calories <= 0) {
    return { status: 'review', atwater_error_pct: null };
  }
  // Kcal-only source: macros unknown, so there is no Atwater check to run.
  if (values.protein == null || values.carbs == null || values.fats == null) {
    return { status: 'ok', atwater_error_pct: null };
  }
  const computed = values.protein * 4 + values.carbs * 4 + values.fats * 9;
  const error = Math.abs(computed - values.calories) / values.calories;
  return {
    status: error <= 0.25 ? 'ok' : 'review',
    atwater_error_pct: Math.round(error * 1000) / 10,
  };
}
