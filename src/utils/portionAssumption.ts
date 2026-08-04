import type { ParsedFoodItem } from '../types/mealParse';

export interface ReferenceAmount {
  value: number;
  unit: 'g' | 'ml';
}

export function extractReferenceAmount(
  item: Pick<ParsedFoodItem, 'reference_weight_g' | 'reference_volume_ml' | 'portion_assumption'>,
): ReferenceAmount | null {
  const weight = Number(item.reference_weight_g);
  if (Number.isFinite(weight) && weight > 0) return { value: Math.round(weight), unit: 'g' };

  const volume = Number(item.reference_volume_ml);
  if (Number.isFinite(volume) && volume > 0) return { value: Math.round(volume), unit: 'ml' };

  const text = item.portion_assumption?.trim();
  const match = text?.match(/\b(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value: Math.round(value), unit: match[2].toLowerCase() as 'g' | 'ml' };
}

/** Gram weight the per-unit macros are based on (from model or parsed from assumption). */
export function extractReferenceWeightG(
  item: Pick<ParsedFoodItem, 'reference_weight_g' | 'reference_volume_ml' | 'portion_assumption'>,
): number | null {
  const amount = extractReferenceAmount(item);
  return amount?.unit === 'g' ? amount.value : null;
}

/** Turn verbose parser assumptions into a short serving label for review. */
export function compactPortionAssumption(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;

  const text = raw.trim();
  const assumed = text.match(/\bAssumed\s+(.+?)(?:\s+based on|\s+from|\s+\(|\.|$)/i);
  if (assumed?.[1]) {
    return cleanServingPhrase(assumed[1]);
  }

  const estimated = text.match(/\b(?:Using|Estimated at|Estimated)\s+(.+?)(?:\s+based on|\s+from|\.|$)/i);
  if (estimated?.[1]) {
    return cleanServingPhrase(estimated[1]);
  }

  const weight = text.match(/\b(\d+(?:\.\d+)?\s*(?:g|ml|kg|oz)\b)/i);
  if (weight?.[1]) {
    return cleanServingPhrase(weight[1]);
  }

  const stripped = text
    .replace(/^Portion size and .+?\.?\s*/i, '')
    .replace(/^Rice type and portion size not specified\.?\s*/i, '')
    .replace(/^.*?not specified\.?\s*(Assumed\s+)?/i, '')
    .trim();

  if (!stripped) return null;
  if (stripped.length <= 42) return cleanServingPhrase(stripped);

  return `${cleanServingPhrase(stripped).slice(0, 39).trim()}…`;
}

export function formatServingLabel(
  item: Pick<ParsedFoodItem, 'reference_weight_g' | 'reference_volume_ml' | 'portion_assumption'>,
): string | null {
  const amount = extractReferenceAmount(item);
  if (!amount) return compactPortionAssumption(item.portion_assumption);

  const detail = stripLeadingAmount(item.portion_assumption);
  const compact = detail ? compactPortionAssumption(detail) : null;
  const normalizedCompact = compact ? normalizeServingDetail(compact, amount) : null;

  if (normalizedCompact && !/^estimated portion$/i.test(normalizedCompact)) {
    const label = `${amount.value}${amount.unit} · ${normalizedCompact}`;
    return label.length <= 44 ? label : `${amount.value}${amount.unit}`;
  }

  return `${amount.value}${amount.unit}`;
}

export function formatPortionAssumptionWithAmount(
  previous: string | undefined,
  amount: number,
  unit: 'g' | 'ml',
  foodName: string,
): string {
  const trimmed = previous?.trim();
  if (trimmed) {
    const withoutLeadingAmount = trimmed.replace(/^\d+(?:\.\d+)?\s*(?:g|ml)\b\s*/i, '').trim();
    if (withoutLeadingAmount) return `${amount}${unit} ${withoutLeadingAmount}`;
  }

  return `${amount}${unit} ${foodName}`.trim();
}

export function servingWeightPresets(baseG: number): number[] {
  const rounded = Math.round(baseG / 5) * 5;
  const candidates = [
    Math.max(25, Math.round(rounded * 0.75 / 5) * 5),
    rounded,
    Math.round(rounded * 1.25 / 5) * 5,
    Math.round(rounded * 1.5 / 5) * 5,
  ].filter((g) => g >= 25 && g <= 600);

  return [...new Set(candidates)].sort((a, b) => a - b).slice(0, 4);
}

function stripLeadingAmount(text: string | undefined): string {
  return text?.replace(/^\d+(?:\.\d+)?\s*(?:g|ml)\b\s*/i, '').trim() ?? '';
}

function normalizeServingDetail(detail: string, amount: ReferenceAmount): string | null {
  const cleaned = cleanServingPhrase(detail)
    .replace(new RegExp(`^${amount.value}\\s*${amount.unit}\\b`, 'i'), '')
    .replace(new RegExp(`\\b${amount.value}\\s*${amount.unit}\\b`, 'ig'), '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function cleanServingPhrase(phrase: string): string {
  return phrase
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/[\])]+$/g, '')
    .replace(/^[\[(]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
