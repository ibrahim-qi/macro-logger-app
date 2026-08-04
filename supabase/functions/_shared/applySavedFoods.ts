import type { ParsedFoodItem } from './normalizeItems.ts';

export interface SavedFoodMacros {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

/** Conservative singular form for egg/toast-style plurals only — not fuzzy matching. */
function singularize(name: string): string {
  // berry → berries, not cookie → cookies (…kies is just … + s)
  if (name.endsWith('ies') && name.length > 4 && !/(?:ckies|ggies|ppies|ovies|eries|kies)$/.test(name)) {
    return `${name.slice(0, -3)}y`;
  }
  if (name.endsWith('oes') && name.length > 4) {
    return name.slice(0, -2);
  }
  if (/(?:ses|xes|zes|ches|shes)$/.test(name) && name.length > 4) {
    return name.slice(0, -2);
  }
  if (name.endsWith('s') && !name.endsWith('ss') && name.length > 3) {
    return name.slice(0, -1);
  }
  return name;
}

function lookupSavedFood(
  foodName: string,
  savedByName: Map<string, SavedFoodMacros>,
): SavedFoodMacros | undefined {
  const normalized = normalizeName(foodName);
  return savedByName.get(normalized) ?? savedByName.get(singularize(normalized));
}

/** Override AI macros when the parsed name matches a saved food (exact or singular/plural). */
export function applySavedFoods(
  items: ParsedFoodItem[],
  savedFoods: SavedFoodMacros[],
): ParsedFoodItem[] {
  if (!savedFoods.length) return items;

  const savedByName = new Map<string, SavedFoodMacros>();
  for (const food of savedFoods) {
    const normalized = normalizeName(food.food_name);
    savedByName.set(normalized, food);
    savedByName.set(singularize(normalized), food);
  }

  return items.map((item) => {
    const match = lookupSavedFood(item.food_name, savedByName);
    if (!match) return item;

    return {
      ...item,
      food_name: match.food_name,
      calories: Math.max(0, Number(match.calories) || 0),
      protein: Math.max(0, Number(match.protein) || 0),
      carbs: Math.max(0, Number(match.carbs) || 0),
      fats: Math.max(0, Number(match.fats) || 0),
      confidence: 'high',
      from_saved_food: true,
      portion_assumption: undefined,
      source_note: 'Your saved food',
    };
  });
}
