/** Persistent food → macros cache, keyed per user. Populated by verified lookups
 *  (source 'ai') and user corrections (source 'user'). This is the app's own
 *  self-growing nutrition database. */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CachedFood {
  calories_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  source: 'ai' | 'user';
  source_url: string;
}

export interface FoodCache {
  get(foodName: string): Promise<CachedFood | null>;
  set(foodName: string, hit: CachedFood): Promise<void>;
}

export function createFoodCache(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): FoodCache {
  return {
    async get(foodName: string): Promise<CachedFood | null> {
      const key = foodName.trim().toLowerCase();
      const { data, error } = await supabase
        .from('food_nutrition_cache')
        .select('calories_100g, protein_100g, carbs_100g, fat_100g, source, source_url')
        .eq('user_id', userId)
        .eq('food_name', key)
        .maybeSingle();
      if (error || !data) return null;
      return {
        calories_100g: data.calories_100g != null ? Number(data.calories_100g) : null,
        protein_100g: data.protein_100g != null ? Number(data.protein_100g) : null,
        carbs_100g: data.carbs_100g != null ? Number(data.carbs_100g) : null,
        fat_100g: data.fat_100g != null ? Number(data.fat_100g) : null,
        source: data.source === 'user' ? 'user' : 'ai',
        source_url: data.source_url ?? '',
      };
    },
    async set(foodName: string, hit: CachedFood): Promise<void> {
      const key = foodName.trim().toLowerCase();
      await supabase.from('food_nutrition_cache').upsert(
        {
          user_id: userId,
          food_name: key,
          calories_100g: hit.calories_100g,
          protein_100g: hit.protein_100g,
          carbs_100g: hit.carbs_100g,
          fat_100g: hit.fat_100g,
          source: hit.source,
          source_url: hit.source_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,food_name' },
      );
    },
  };
}
