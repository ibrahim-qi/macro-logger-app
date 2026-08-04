export type EvidenceStatus = 'uk_evidence' | 'ai_estimate' | 'user_saved' | 'unavailable';

export interface ParsedFoodItem {
  item_id?: string;
  food_name: string;
  preparation?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  unit?: 'count' | 'serving';
  confidence?: 'high' | 'medium' | 'low';
  from_saved_food?: boolean;
  portion_assumption?: string;
  source_note?: string;
  source_title?: string;
  source_url?: string;
  evidence_quote?: string;
  evidence_status?: EvidenceStatus;
  reference_weight_g?: number;
  reference_volume_ml?: number;
  macro_validation?: {
    status: 'ok' | 'review';
    atwater_error_pct: number | null;
  };
}

function positive(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function nonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

/**
 * Boundary cleanup only. It cannot reinterpret quantity, weight, or meal meaning;
 * those are enforced by the structured interpretation contract.
 */
export function normalizeItems(items: ParsedFoodItem[]): ParsedFoodItem[] {
  return items.map((item) => ({
    ...item,
    item_id: item.item_id?.trim() || undefined,
    food_name: String(item.food_name).trim(),
    preparation: item.preparation?.trim() || undefined,
    calories: nonNegative(item.calories),
    protein: nonNegative(item.protein),
    carbs: nonNegative(item.carbs),
    fats: nonNegative(item.fats),
    quantity: positive(item.quantity) ?? 1,
    unit: item.unit === 'count' ? 'count' : 'serving',
    portion_assumption: item.portion_assumption?.trim() || undefined,
    source_note: item.source_note?.trim() || undefined,
    source_title: item.source_title?.trim() || undefined,
    source_url: item.source_url?.trim() || undefined,
    evidence_quote: item.evidence_quote?.trim() || undefined,
    reference_weight_g: positive(item.reference_weight_g),
    reference_volume_ml: positive(item.reference_volume_ml),
  }));
}
