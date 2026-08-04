import type { InterpretedMealItem, MealInterpretation } from './mealParsePrompt.ts';

const EXPLICIT_COUNT =
  /\b(?:(\d+(?:\.\d+)?)|(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))\b/gi;
const EXPLICIT_MULTI_PORTION =
  /\b(?:(\d+(?:\.\d+)?)|(one|two|three|four|five|six|seven|eight|nine|ten))\s+(?:portions?|servings?|helpings?|bags?|boxes?|packs?|sheets?|slices?)\b/gi;
const WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** Typical total weight for one eaten portion of small composed foods (nuggets, wings, fries). */
const SINGLE_PORTION_WEIGHT_MIN_G = 60;
const SINGLE_PORTION_WEIGHT_MAX_G = 300;
/** Per-piece weight above this is implausible for nuggets, bites, etc. */
const IMPLAUSIBLE_SINGLE_PIECE_G = 50;
/** quantity × reference_weight_g above this strongly suggests a double-count mistake. */
const IMPLAUSIBLE_TOTAL_WEIGHT_G = 500;

function countTokenValue(digit: string | undefined, word: string | undefined): number | null {
  if (digit) {
    const value = Number(digit);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (word) {
    return WORD_TO_NUMBER[word.toLowerCase()] ?? null;
  }
  return null;
}

function isWeightOrVolumeToken(mealText: string, startIndex: number, tokenLength: number): boolean {
  const after = mealText.slice(startIndex + tokenLength).trimStart();
  return /^(?:g|ml|kg|oz|grams?|millilitres?|milliliters?|litres?|liters?)\b/i.test(after);
}

function foodKeywords(foodName: string): string[] {
  return foodName
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function textNearFood(mealText: string, startIndex: number, windowChars: number, foodName: string): boolean {
  const keywords = foodKeywords(foodName);
  if (!keywords.length) return false;
  const window = mealText.slice(startIndex, startIndex + windowChars).toLowerCase();
  return keywords.some((keyword) => window.includes(keyword));
}

function parseCountTokens(mealText: string): Array<{ value: number; index: number }> {
  const tokens: Array<{ value: number; index: number }> = [];
  let match: RegExpExecArray | null;
  EXPLICIT_COUNT.lastIndex = 0;

  while ((match = EXPLICIT_COUNT.exec(mealText)) !== null) {
    if (isWeightOrVolumeToken(mealText, match.index, match[0].length)) continue;
    const value = countTokenValue(match[1], match[2]);
    if (value !== null) tokens.push({ value, index: match.index });
  }

  return tokens;
}

/** Count that applies to this item — not meal-wide gram weights or unrelated items. */
function parseItemExplicitCount(
  mealText: string,
  item: InterpretedMealItem,
  itemCount: number,
): number | null {
  const tokens = parseCountTokens(mealText);
  if (!tokens.length) return null;

  if (itemCount === 1) {
    return tokens[0]?.value ?? null;
  }

  for (const token of tokens) {
    if (textNearFood(mealText, token.index, 80, item.food_name)) {
      return token.value;
    }
  }

  return null;
}

function itemHasExplicitMultiPortion(
  mealText: string,
  item: InterpretedMealItem,
  itemCount: number,
): boolean {
  let match: RegExpExecArray | null;
  EXPLICIT_MULTI_PORTION.lastIndex = 0;

  while ((match = EXPLICIT_MULTI_PORTION.exec(mealText)) !== null) {
    if (itemCount === 1) return true;
    if (textNearFood(mealText, match.index, 80, item.food_name)) return true;
  }

  return false;
}

function itemAllowsMultiQuantity(
  mealText: string,
  item: InterpretedMealItem,
  itemCount: number,
): boolean {
  return parseItemExplicitCount(mealText, item, itemCount) !== null
    || itemHasExplicitMultiPortion(mealText, item, itemCount);
}

function appendSanityNote(previous: string, note: string): string {
  const trimmed = previous.trim();
  if (!trimmed) return note;
  if (trimmed.toLowerCase().includes(note.toLowerCase())) return trimmed;
  return `${trimmed} (${note})`;
}

/**
 * Fix common interpretation mistakes where the model treats a typical piece count
 * (e.g. 6 nuggets) as quantity while also assigning a full serving weight per unit.
 */
export function sanifyInterpretationPortions(
  interpretation: MealInterpretation,
  mealText: string,
): MealInterpretation {
  const itemCount = interpretation.items.length;
  const items = interpretation.items.map((item) =>
    sanifyInterpretationItem(item, mealText, itemCount),
  );

  return { ...interpretation, items };
}

function sanifyInterpretationItem(
  item: InterpretedMealItem,
  mealText: string,
  itemCount: number,
): InterpretedMealItem {
  const allowMultiQuantity = itemAllowsMultiQuantity(mealText, item, itemCount);
  const refG = item.reference_weight_g;
  const quantity = item.quantity;

  if (
    !allowMultiQuantity
    && quantity > 1
    && item.unit === 'serving'
  ) {
    return {
      ...item,
      quantity: 1,
      portion_assumption: appendSanityNote(
        item.portion_assumption,
        'assumed one serving because no portion count was stated',
      ),
    };
  }

  if (!refG || quantity <= 1) {
    return item;
  }

  const servingSizedReference = refG >= SINGLE_PORTION_WEIGHT_MIN_G
    && refG <= SINGLE_PORTION_WEIGHT_MAX_G;
  const implausibleTotalWeight = quantity * refG > IMPLAUSIBLE_TOTAL_WEIGHT_G;

  if (
    item.unit === 'count'
    && quantity > 1
    && refG >= IMPLAUSIBLE_SINGLE_PIECE_G
    && (implausibleTotalWeight || (!allowMultiQuantity && servingSizedReference))
  ) {
    return {
      ...item,
      quantity: 1,
      unit: 'serving',
      reference_weight_g: refG,
      portion_assumption: appendSanityNote(
        item.portion_assumption,
        implausibleTotalWeight
          ? `assumed one ${refG}g portion; ${quantity}×${refG}g looked implausible`
          : `assumed one ${refG}g portion because no count was stated`,
      ),
    };
  }

  return item;
}
