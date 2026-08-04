/** Heuristic: simple explicit meals skip interpret + search (single LLM call). */

const UK_BRAND_PATTERN =
  /\b(mcdonald'?s?|greggs|costa|pret|tesco|sainsbury'?s?|asda|morrisons|boots|subway|kfc|burger king|starbucks|domino'?s?|pizza hut|nando'?s?|wagamama|itsu|leon|wasabi|walkers|cadbury|gregg|costa coffee|pret a manger|big mac|quarter pounder|sausage roll|meal deal)\b/i;

const VAGUE_PORTION_PATTERN =
  /\b(handful|some|bowl of|bit of|a few|big lunch|big dinner|meal deal|approx|about|roughly|around|generous|scoop of|splash of)\b/i;

const VAGUE_DRINK_SIZE_PATTERN =
  /\b(large|medium|small)\s+(latte|cappuccino|flat white|mocha|coffee|hot chocolate|americano)\b/i;

/** Combined meals with multiple components need interpret + research. */
const MULTI_ITEM_PATTERN =
  /\s(?:and|plus)\s|,\s|\bwith\b/i;

/** Foods where unstated variant (fat %, raw/cooked, type) materially changes macros. */
const AMBIGUOUS_FOOD_PATTERN =
  /\b(greek\s+yoghurt|greek\s+yogurt|yoghurt|yogurt|milk|kefir|cottage\s+cheese|chicken\s+thigh|chicken\s+breast|chicken\s+wing|mince|minced|beef|pork|lamb|salmon|cod|tuna|rice|pasta|porridge|oats)\b/i;

/** User or prep method already narrowed the variant — safe for fast path. */
const SPECIFIED_VARIANT_PATTERN =
  /\b(0%|fat[- ]free|full[- ]fat|semi[- ]skimmed|skimmed|whole\s+milk|almond\s+milk|oat\s+milk|soya\s+milk|soy\s+milk|coconut\s+milk|raw|cooked|brown\s+rice|white\s+rice|wholemeal|grilled|fried|baked|roasted|boiled|poached|steamed|smoked)\b/i;

const GRAMS_MEAT_PATTERN =
  /\b\d+\s*g\b.*\b(chicken|beef|pork|lamb|mince|minced|salmon|cod|tuna|thigh|breast|wing)\b|\b(chicken|beef|pork|lamb|mince|minced|salmon|cod|tuna|thigh|breast|wing)\b.*\b\d+\s*g\b/i;

const COOKING_STATE_PATTERN =
  /\b(raw|cooked|grilled|fried|baked|roasted|boiled|poached|steamed|smoked)\b/i;

export function shouldUseFastParse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 240) return false;
  if (UK_BRAND_PATTERN.test(trimmed)) return false;
  if (VAGUE_PORTION_PATTERN.test(trimmed)) return false;
  if (VAGUE_DRINK_SIZE_PATTERN.test(trimmed)) return false;
  if (MULTI_ITEM_PATTERN.test(trimmed)) return false;
  if (GRAMS_MEAT_PATTERN.test(trimmed) && !COOKING_STATE_PATTERN.test(trimmed)) return false;
  if (AMBIGUOUS_FOOD_PATTERN.test(trimmed) && !SPECIFIED_VARIANT_PATTERN.test(trimmed)) {
    return false;
  }
  return true;
}
