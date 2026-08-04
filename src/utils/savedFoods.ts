import { supabase } from '../supabaseClient';

export interface SavedFoodPayload {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export function normalizeFoodName(name: string): string {
  return name.trim();
}

export function isSameFoodName(a: string, b: string): boolean {
  return normalizeFoodName(a).toLowerCase() === normalizeFoodName(b).toLowerCase();
}

export async function upsertSavedFood(userId: string, food: SavedFoodPayload): Promise<void> {
  const food_name = normalizeFoodName(food.food_name);
  if (!food_name) return;

  const payload = {
    food_name,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fats: food.fats,
  };

  const { data: existing, error: lookupError } = await supabase
    .from('saved_foods')
    .select('id, food_name')
    .eq('user_id', userId);

  if (lookupError) throw lookupError;

  const match = (existing ?? []).find((row) => isSameFoodName(row.food_name, food_name));

  if (match) {
    const { error } = await supabase
      .from('saved_foods')
      .update(payload)
      .eq('id', match.id)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('saved_foods')
    .insert({ ...payload, user_id: userId });

  if (error) {
    if (error.code === '23505') {
      const { error: updateError } = await supabase
        .from('saved_foods')
        .update(payload)
        .eq('user_id', userId)
        .eq('food_name', food_name);
      if (updateError) throw updateError;
      return;
    }
    throw error;
  }
}

export async function upsertSavedFoods(userId: string, foods: SavedFoodPayload[]): Promise<void> {
  for (const food of foods) {
    await upsertSavedFood(userId, food);
  }
}

export async function fetchSavedFoodNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_foods')
    .select('food_name')
    .eq('user_id', userId)
    .order('food_name');

  if (error) throw error;
  return (data ?? []).map((row) => row.food_name);
}

export function isFoodNameSaved(name: string, savedNames: string[]): boolean {
  return savedNames.some((saved) => isSameFoodName(saved, name));
}
