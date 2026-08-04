import type { ParsedFoodItem } from './normalizeItems.ts';

export interface SavedFoodMacros {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const MATCH_THRESHOLD = 0.72;
const MIN_CONTAINS_LENGTH = 5;

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function scoreFoodNameMatch(parsedName: string, savedName: string): number {
  const parsed = parsedName.toLowerCase().trim();
  const saved = savedName.toLowerCase().trim();

  if (!parsed || !saved) return 0;
  if (parsed === saved) return 1;

  // Avoid matching generic words to longer saved names (e.g. "toast" -> "avocado toast")
  if (parsed.includes(saved) || saved.includes(parsed)) {
    const shorter = Math.min(parsed.length, saved.length);
    const longer = Math.max(parsed.length, saved.length);
    if (shorter >= MIN_CONTAINS_LENGTH && shorter / longer >= 0.45) return 0.88;
  }

  const parsedTokens = new Set(tokenize(parsedName));
  const savedTokens = new Set(tokenize(savedName));
  if (parsedTokens.size === 0 || savedTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of parsedTokens) {
    if (savedTokens.has(token)) overlap++;
  }

  return overlap / Math.max(parsedTokens.size, savedTokens.size);
}

export function findBestSavedFoodMatch(
  parsedName: string,
  savedFoods: SavedFoodMacros[],
): SavedFoodMacros | null {
  let best: SavedFoodMacros | null = null;
  let bestScore = 0;

  for (const saved of savedFoods) {
    const score = scoreFoodNameMatch(parsedName, saved.food_name);
    if (score > bestScore) {
      bestScore = score;
      best = saved;
    }
  }

  return bestScore >= MATCH_THRESHOLD ? best : null;
}

/** Overwrite parsed macros when a saved food matches — deterministic, not LLM-dependent. */
export function applySavedFoods(
  items: ParsedFoodItem[],
  savedFoods: SavedFoodMacros[],
): ParsedFoodItem[] {
  if (!savedFoods.length) return items;

  const usedSaved = new Set<string>();

  return items.map((item) => {
    const candidates = savedFoods.filter((saved) => !usedSaved.has(saved.food_name.toLowerCase()));
    const match = findBestSavedFoodMatch(item.food_name, candidates);
    if (!match) return item;

    usedSaved.add(match.food_name.toLowerCase());

    return {
      ...item,
      food_name: match.food_name,
      calories: Math.max(0, Number(match.calories) || 0),
      protein: Math.max(0, Number(match.protein) || 0),
      carbs: Math.max(0, Number(match.carbs) || 0),
      fats: Math.max(0, Number(match.fats) || 0),
      confidence: 'high',
      from_saved_food: true,
    };
  });
}
