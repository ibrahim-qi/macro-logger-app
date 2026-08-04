import type { ParsedFoodItem } from './normalizeItems.ts';

/** Flag items where stated calories diverge from macro math (4/4/9 rule). */
export function applyMacroSanity(items: ParsedFoodItem[]): ParsedFoodItem[] {
  return items.map((item) => {
    const protein = Math.max(0, Number(item.protein) || 0);
    const carbs = Math.max(0, Number(item.carbs) || 0);
    const fats = Math.max(0, Number(item.fats) || 0);
    const calories = Math.max(0, Number(item.calories) || 0);
    const computed = protein * 4 + carbs * 4 + fats * 9;

    if (calories <= 0) return item;

    const errorPct = Math.abs(computed - calories) / calories;
    if (errorPct <= 0.2) return item;

    const confidence = item.confidence === 'high' ? 'medium' : item.confidence;
    return { ...item, confidence };
  });
}
