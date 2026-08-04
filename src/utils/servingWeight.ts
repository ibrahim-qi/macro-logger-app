import type { ParsedFoodItem } from '../types/mealParse';
import {
  extractReferenceAmount,
  extractReferenceWeightG,
  formatPortionAssumptionWithAmount,
  formatServingLabel,
  servingWeightPresets,
} from './portionAssumption';

export {
  extractReferenceAmount,
  extractReferenceWeightG,
  formatServingLabel,
  servingWeightPresets,
};

export function scaleItemByReferenceAmount(
  item: ParsedFoodItem,
  newAmount: number,
): ParsedFoodItem {
  const base = extractReferenceAmount(item);
  if (!base || base.value <= 0 || newAmount <= 0) {
    return item;
  }

  const ratio = newAmount / base.value;
  return {
    ...item,
    reference_weight_g: base.unit === 'g' ? newAmount : undefined,
    reference_volume_ml: base.unit === 'ml' ? newAmount : undefined,
    calories: Math.max(0, Math.round(item.calories * ratio)),
    protein: Math.max(0, Math.round(item.protein * ratio * 10) / 10),
    carbs: Math.max(0, Math.round(item.carbs * ratio * 10) / 10),
    fats: Math.max(0, Math.round(item.fats * ratio * 10) / 10),
    portion_assumption: formatPortionAssumptionWithAmount(
      item.portion_assumption,
      newAmount,
      base.unit,
      item.food_name,
    ),
    from_saved_food: false,
    evidence_status: 'ai_estimate',
    source_note: `${item.source_note ?? 'Estimate'} · adjusted by user`,
  };
}

export function scaleItemByWeight(item: ParsedFoodItem, newWeightG: number): ParsedFoodItem {
  return scaleItemByReferenceAmount(
    { ...item, reference_volume_ml: undefined, reference_weight_g: extractReferenceWeightG(item) ?? undefined },
    newWeightG,
  );
}
