import type { ParsedFoodItem } from '../types/mealParse';

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export function sumItemMacros(items: ParsedFoodItem[]): MacroTotals {
  return items.reduce(
    (acc, item) => {
      const q = item.quantity || 1;
      acc.calories += item.calories * q;
      acc.protein += (item.protein ?? 0) * q;
      acc.carbs += (item.carbs ?? 0) * q;
      acc.fats += (item.fats ?? 0) * q;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

export function getMealPeriod(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 15) return 'Lunch';
  if (hour < 18) return 'Snack';
  return 'Dinner';
}
