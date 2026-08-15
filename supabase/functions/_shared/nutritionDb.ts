/** Authoritative nutrition-database lookup (Open Food Facts) for generic and
 *  unlabelled foods. Faster and more reliable than web search for foods that
 *  don't need a brand-specific label. Anything OFF misses falls back to Serper
 *  in the caller. */

export interface NutritionDbHit {
  food_name: string;
  calories: number | null; // per 100g
  protein: number | null; // per 100g
  carbs: number | null; // per 100g
  fats: number | null; // per 100g
  source_url: string;
}

const OFF_BASE = 'https://uk.openfoodfacts.org';
const OFF_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 120;

const cache = new Map<string, { hit: NutritionDbHit | null; at: number }>();

function cacheKey(foodName: string): string {
  return foodName.trim().toLowerCase();
}

function getCached(key: string): NutritionDbHit | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.hit;
}

function setCached(key: string, hit: NutritionDbHit | null): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { hit, at: Date.now() });
}

function positiveOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function lookupNutritionDb(foodName: string): Promise<NutritionDbHit | null> {
  const key = cacheKey(foodName);
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const url =
      `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}` +
      `&json=1&page_size=1&fields=product_name,code,nutriments`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Soha macro logger / 1.0' },
      signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OFF ${response.status}`);

    const payload = await response.json();
    const product = payload?.products?.[0];
    const nutriments = product?.nutriments ?? {};
    const hit: NutritionDbHit = {
      food_name: String(product?.product_name ?? foodName),
      calories: positiveOrNull(nutriments['energy-kcal_100g']),
      protein: positiveOrNull(nutriments['proteins_100g']),
      carbs: positiveOrNull(nutriments['carbohydrates_100g']),
      fats: positiveOrNull(nutriments['fat_100g']),
      source_url: product?.code
        ? `${OFF_BASE}/product/${product.code}`
        : `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}`,
    };

    if (hit.calories == null) {
      setCached(key, null);
      return null;
    }
    setCached(key, hit);
    return hit;
  } catch (error) {
    console.warn('[nutrition-db] lookup failed', { foodName, error: String(error) });
    setCached(key, null);
    return null;
  }
}
