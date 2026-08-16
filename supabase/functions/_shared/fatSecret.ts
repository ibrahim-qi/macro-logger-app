/** FatSecret Platform API lookup — structured food-name → macros with verified
 *  UK country data. Requires FATSECRET_CLIENT_ID + FATSECRET_CLIENT_SECRET
 *  (OAuth2 client-credentials). Returns per-100g values; no LLM extraction. */

export interface NutritionDbHit {
  food_name: string;
  calories: number | null; // per 100g
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  source_url: string;
}

export interface FatSecretConfig {
  clientId: string;
  clientSecret: string;
}

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // tokens live ~24h; refresh early
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 120;

let cachedToken: { token: string; at: number } | null = null;
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

async function getAccessToken(config: FatSecretConfig): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < TOKEN_TTL_MS) return cachedToken.token;
  const basic = btoa(`${config.clientId}:${config.clientSecret}`);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials&scope=basic',
  });
  if (!response.ok) throw new Error(`FatSecret token ${response.status}`);
  const payload = await response.json();
  const token = String(payload?.access_token ?? '');
  if (!token) throw new Error('FatSecret token missing');
  cachedToken = { token, at: Date.now() };
  return token;
}

interface Serving {
  metric_serving_amount?: string | number;
  metric_serving_unit?: string;
  calories?: string | number;
  protein?: string | number;
  carbohydrate?: string | number;
  fat?: string | number;
}

export async function lookupNutritionDb(
  foodName: string,
  config: FatSecretConfig,
): Promise<NutritionDbHit | null> {
  const key = cacheKey(foodName);
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const token = await getAccessToken(config);

    const searchUrl =
      `${API_URL}?method=foods.search&search_expression=${encodeURIComponent(foodName)}` +
      `&format=json&region=GB&language=en&max_results=5`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!searchResponse.ok) throw new Error(`FatSecret search ${searchResponse.status}`);
    const searchPayload = await searchResponse.json();
    const rawFoods = searchPayload?.foods?.food;
    const foods = Array.isArray(rawFoods) ? rawFoods : rawFoods ? [rawFoods] : [];
    if (!foods.length) {
      setCached(key, null);
      return null;
    }
    const food = foods[0];

    const getUrl =
      `${API_URL}?method=food.get.v2&food_id=${encodeURIComponent(String(food.food_id))}&format=json`;
    const getResponse = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!getResponse.ok) throw new Error(`FatSecret get ${getResponse.status}`);
    const getPayload = await getResponse.json();
    const rawServings = getPayload?.food?.servings?.serving;
    const servings: Serving[] = Array.isArray(rawServings) ? rawServings : rawServings ? [rawServings] : [];
    if (!servings.length) {
      setCached(key, null);
      return null;
    }

    const source_url = `https://www.fatsecret.com/calories-nutrition/search?q=${encodeURIComponent(foodName)}`;
    let hit: NutritionDbHit | null = null;

    // Prefer the explicit 100g serving; otherwise scale a metric-weight serving.
    const hundred = servings.find(
      (serving) => serving.metric_serving_unit === 'g' && Number(serving.metric_serving_amount) === 100,
    );
    if (hundred) {
      hit = {
        food_name: String(food.food_name ?? foodName),
        calories: positiveOrNull(hundred.calories),
        protein: positiveOrNull(hundred.protein),
        carbs: positiveOrNull(hundred.carbohydrate),
        fats: positiveOrNull(hundred.fat),
        source_url,
      };
    } else {
      const weighted = servings.find(
        (serving) =>
          serving.metric_serving_unit === 'g' && positiveOrNull(serving.metric_serving_amount) != null,
      );
      if (weighted) {
        const amount = positiveOrNull(weighted.metric_serving_amount) ?? 0;
        const scale = amount > 0 ? 100 / amount : 0;
        if (scale > 0) {
          hit = {
            food_name: String(food.food_name ?? foodName),
            calories: scaleValue(weighted.calories, scale),
            protein: scaleValue(weighted.protein, scale),
            carbs: scaleValue(weighted.carbohydrate, scale),
            fats: scaleValue(weighted.fat, scale),
            source_url,
          };
        }
      }
    }

    if (!hit || hit.calories == null) {
      setCached(key, null);
      return null;
    }
    setCached(key, hit);
    return hit;
  } catch (error) {
    console.warn('[fatsecret] lookup failed', { foodName, error: String(error) });
    setCached(key, null);
    return null;
  }
}

function scaleValue(value: unknown, scale: number): number | null {
  const number = positiveOrNull(value);
  return number == null ? null : number * scale;
}
