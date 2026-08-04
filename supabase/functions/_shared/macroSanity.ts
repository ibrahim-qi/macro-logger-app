import type { ParsedFoodItem } from './normalizeItems.ts';
import { validateMacroConsistency } from './nutritionCompute.ts';

/** Attach review metadata without rewriting label/model calories. */
export function applyMacroSanity(items: ParsedFoodItem[]): ParsedFoodItem[] {
  return items.map((item) => ({
    ...item,
    macro_validation: validateMacroConsistency(item),
  }));
}
