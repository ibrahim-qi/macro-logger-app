export interface ParsedFoodItem {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  confidence?: 'high' | 'medium' | 'low';
  from_saved_food?: boolean;
}

/** Typical max for unlabeled counts (slices, pieces, etc.) */
const MAX_COUNTABLE_QUANTITY = 24;

/** Single line-item totals above this are almost certainly a quantity misuse bug */
const ABSURD_LINE_CALORIES = 2500;

const WEIGHT_IN_NAME = /\d+\s*(g|gram|grams|ml|millilitre|milliliters|milliliter|l|litre|liters|liter)\b/i;

/** Foods usually counted as discrete items — allow higher quantities */
const DISCRETE_COUNT_PATTERN =
  /\b(eggs?|slices?|pieces?|grapes?|wings?|cookies?|crisps?|rashers?|strips?|nuggets?|meatballs?|sausages?|bananas?|apples?|oranges?|crackers?|tortillas?|pancakes?|waffles?|almonds?|nuts?|walnuts?|cashews?|strawberries?|blueberries?|raspberries?|cherry|cherries|dates?|prawns?|shrimp|olives?)\b/i;

/** Values models often put in quantity when they mean grams/ml */
const COMMON_GRAM_ML_QUANTITIES = new Set([
  25, 30, 40, 50, 60, 75, 80, 100, 125, 150, 180, 200, 250, 300, 350, 400, 500,
]);

function hasWeightInName(foodName: string): boolean {
  return WEIGHT_IN_NAME.test(foodName);
}

function isLikelyDiscreteCount(item: ParsedFoodItem, quantity: number): boolean {
  if (!Number.isInteger(quantity) || quantity > 48) return false;
  return DISCRETE_COUNT_PATTERN.test(item.food_name);
}

function isLikelyWeightQuantity(quantity: number): boolean {
  return COMMON_GRAM_ML_QUANTITIES.has(quantity) || quantity >= 100;
}

/**
 * Some models put grams/ml in quantity (e.g. 300ml milk -> quantity=300).
 * Detect that and collapse to a single serving, keeping macros as-is.
 */
export function sanitizeQuantity(item: ParsedFoodItem): ParsedFoodItem {
  const quantity = Math.max(0.01, Number(item.quantity) || 1);
  const calories = Math.max(0, Number(item.calories) || 0);
  const totalCalories = calories * quantity;

  if (quantity <= MAX_COUNTABLE_QUANTITY || isLikelyDiscreteCount(item, quantity)) {
    return { ...item, quantity, calories };
  }

  const likelyWeightMisuse =
    totalCalories > ABSURD_LINE_CALORIES ||
    hasWeightInName(item.food_name) ||
    (isLikelyWeightQuantity(quantity) && calories <= 800 && !isLikelyDiscreteCount(item, quantity));

  if (!likelyWeightMisuse) {
    return { ...item, quantity, calories };
  }

  return {
    ...item,
    quantity: 1,
    calories,
    protein: Math.max(0, Number(item.protein) || 0),
    carbs: Math.max(0, Number(item.carbs) || 0),
    fats: Math.max(0, Number(item.fats) || 0),
  };
}

export function normalizeItems(items: ParsedFoodItem[]): ParsedFoodItem[] {
  return items.map((item) =>
    sanitizeQuantity({
      food_name: String(item.food_name).trim(),
      calories: Math.max(0, Number(item.calories) || 0),
      protein: Math.max(0, Number(item.protein) || 0),
      carbs: Math.max(0, Number(item.carbs) || 0),
      fats: Math.max(0, Number(item.fats) || 0),
      quantity: Math.max(0.01, Number(item.quantity) || 1),
      confidence: item.confidence,
    }),
  );
}
