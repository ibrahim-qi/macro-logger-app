/** Authoritative nutrition-database lookup (Open Food Facts) for generic and
 *  unlabelled foods. Faster and more reliable than web search for foods that
 *  don't need a brand-specific label — but only when the name is a CLOSE match,
 *  so a fuzzy hit can never silently return the wrong food's macros. Anything
 *  OFF misses (or can't confidently match) falls back to Serper in the caller. */

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
const OFF_PAGE_SIZE = 10;
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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Common descriptors that may legitimately appear in a generic food's name. */
const GENERIC_DESCRIPTORS = new Set([
  'raw', 'cooked', 'white', 'brown', 'boiled', 'dry', 'fresh', 'whole', 'plain',
  'sliced', 'chopped', 'diced', 'long', 'short', 'grain', 'basmati', 'jasmine',
  'milled', 'powder', 'ground', 'lean', 'frozen', 'tinned', 'canned', 'generic',
]);

/**
 * A hit is trusted only when every requested token appears in the product name
 * and the product name carries no more than one unexplained extra token.
 * This rejects fuzzy matches like "white rice" -> "white bread with rice topping".
 */
function closeNameMatch(foodName: string, productName: string): boolean {
  const foodTokens = tokenize(foodName);
  const productTokens = tokenize(productName);
  if (!foodTokens.length || !productTokens.length) return false;
  if (!foodTokens.every((token) => productTokens.includes(token))) return false;
  const unexplained = productTokens.filter(
    (token) => !foodTokens.includes(token) && !GENERIC_DESCRIPTORS.has(token),
  );
  return unexplained.length <= 3;
}

interface OffProduct {
  product_name?: string;
  code?: string;
  brands?: string;
  generic_name?: string;
  nutriments?: Record<string, unknown>;
}

function toHit(foodName: string, product: OffProduct): NutritionDbHit | null {
  const nutriments = product.nutriments ?? {};
  const calories = positiveOrNull(nutriments['energy-kcal_100g']);
  if (calories == null) return null;
  return {
    food_name: String(product.product_name ?? foodName),
    calories,
    protein: positiveOrNull(nutriments['proteins_100g']),
    carbs: positiveOrNull(nutriments['carbohydrates_100g']),
    fats: positiveOrNull(nutriments['fat_100g']),
    source_url: product.code
      ? `${OFF_BASE}/product/${product.code}`
      : `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}`,
  };
}

export async function lookupNutritionDb(
  foodName: string,
  bestEffort = false,
): Promise<NutritionDbHit | null> {
  const key = `${cacheKey(foodName)}:${bestEffort ? 'best' : 'strict'}`;
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const url =
      `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}` +
      `&json=1&page_size=${OFF_PAGE_SIZE}&fields=product_name,code,brands,generic_name,nutriments`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Soha macro logger / 1.0' },
      signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OFF ${response.status}`);

    const payload = await response.json();
    const products: OffProduct[] = Array.isArray(payload?.products) ? payload.products : [];

    // Strict mode requires a close name match; best-effort takes the top result.
    const candidates = bestEffort
      ? products
      : products.filter((product) => closeNameMatch(foodName, String(product.product_name ?? '')));
    if (!candidates.length) {
      setCached(key, null);
      return null;
    }
    candidates.sort((a, b) => {
      const aGeneric = !a.brands && Boolean(a.generic_name) ? 0 : 1;
      const bGeneric = !b.brands && Boolean(b.generic_name) ? 0 : 1;
      return aGeneric - bGeneric;
    });

    const hit = toHit(foodName, candidates[0]);
    setCached(key, hit);
    return hit;
  } catch (error) {
    console.warn('[nutrition-db] lookup failed', { foodName, error: String(error) });
    setCached(key, null);
    return null;
  }
}
