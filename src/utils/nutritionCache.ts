/** Capture user-confirmed macros as authoritative ground truth for future parses.
 *  Writes per-100g values to food_nutrition_cache with source 'user', which the
 *  parser prefers over cached lookups and fresh web/DB sources. */

import { supabase } from '../supabaseClient';

export interface FoodCorrection {
  food_name: string;
  calories_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

export async function captureCorrections(
  userId: string,
  corrections: FoodCorrection[],
): Promise<void> {
  if (!corrections.length) return;
  const rows = corrections.map((correction) => ({
    user_id: userId,
    food_name: correction.food_name.trim().toLowerCase(),
    calories_100g: correction.calories_100g,
    protein_100g: correction.protein_100g,
    carbs_100g: correction.carbs_100g,
    fat_100g: correction.fat_100g,
    source: 'user',
    source_url: '',
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('food_nutrition_cache')
    .upsert(rows, { onConflict: 'user_id,food_name' });
  if (error) console.warn('Correction capture failed:', error.message);
}
