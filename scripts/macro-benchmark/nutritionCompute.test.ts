import {
  computeNutrition,
  extractDirectEvidenceFacts,
  hasCompleteNutrition,
  validateEvidenceFact,
  validateMacroConsistency,
} from '../../supabase/functions/_shared/nutritionCompute.ts';
import type {
  InterpretedMealItem,
  NutritionEvidenceFact,
} from '../../supabase/functions/_shared/mealParsePrompt.ts';
import type { ItemSearchResult } from '../../supabase/functions/_shared/webSearch.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function close(actual: number, expected: number, tolerance = 0.11): void {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, got ${actual}`);
}

const chicken: InterpretedMealItem = {
  item_id: 'item_1',
  food_name: 'cooked chicken thigh',
  preparation: 'cooked, boneless',
  quantity: 1,
  unit: 'serving',
  portion_assumption: '180g cooked edible portion',
  reference_weight_g: 180,
  reference_volume_ml: null,
  search_query: 'cooked boneless chicken thigh nutrition',
};

const evidence: NutritionEvidenceFact = {
  item_id: 'item_1',
  basis: 'per_100g',
  basis_amount: 100,
  calories: 177,
  protein: 24,
  carbs: 0,
  fats: 9,
  serving_weight_g: null,
  serving_volume_ml: null,
  confidence: 'high',
  source_title: 'UK nutrition source',
  source_url: 'https://example.org.uk/chicken',
  evidence_quote: 'Per 100g: 177 kcal, protein 24g, carbohydrate 0g, fat 9g.',
};

const search: ItemSearchResult = {
  item_id: 'item_1',
  food_name: chicken.food_name,
  query: 'chicken UK',
  status: 'ok',
  snippets: [{
    title: evidence.source_title,
    link: evidence.source_url,
    snippet: `Nutrition facts. ${evidence.evidence_quote} Values are for cooked meat.`,
  }],
};

const grounded = validateEvidenceFact(evidence, search);
assert(grounded.valid, grounded.reason ?? 'Expected grounded evidence');

const direct = extractDirectEvidenceFacts([{
  ...search,
  snippets: [{
    title: 'Direct UK label',
    link: 'https://example.org.uk/direct',
    snippet: 'Per 100g: 177 kcal, protein 24g, carbohydrate 0g, fat 9g.',
  }],
}]);
assert(direct.length === 1, 'Complete explicit snippets should skip AI extraction');
assert(direct[0].basis === 'per_100g' && direct[0].protein === 24, 'Direct extraction must preserve source basis');
assert(
  extractDirectEvidenceFacts([{
    ...search,
    snippets: [{
      title: 'Incomplete UK label',
      link: 'https://example.org.uk/incomplete',
      snippet: 'Per 100g: 177 kcal and protein 24g.',
    }],
  }]).length === 0,
  'Incomplete snippets must remain for the extraction model',
);

const computed = computeNutrition(chicken, evidence);
assert(computed, 'Expected per-100g nutrition to compute');
assert(computed.calories === 319, `Expected 319 calories, got ${computed.calories}`);
close(computed.protein, 43.2);
close(computed.carbs, 0);
close(computed.fats, 16.2);

const drink: InterpretedMealItem = {
  ...chicken,
  item_id: 'item_2',
  food_name: 'drink',
  quantity: 1,
  reference_weight_g: null,
  reference_volume_ml: 250,
};
const drinkValues = computeNutrition(drink, {
  ...evidence,
  item_id: 'item_2',
  basis: 'per_100ml',
  basis_amount: 100,
  calories: 40,
  protein: 2,
  carbs: 5,
  fats: 1,
});
assert(drinkValues, 'Expected per-100ml nutrition to compute');
assert(drinkValues.calories === 100, 'Volume scaling must use millilitres');
close(drinkValues.protein, 5);

const countItem: InterpretedMealItem = {
  ...chicken,
  item_id: 'item_3',
  food_name: 'banana',
  quantity: 1,
  unit: 'count',
  reference_weight_g: 118,
};
const countValues = computeNutrition(countItem, {
  ...evidence,
  item_id: 'item_3',
  calories: 89,
  protein: 1.1,
  carbs: 22.8,
  fats: 0.3,
});
assert(countValues, 'Expected count item to scale from its inferred edible weight');
assert(countValues.calories === 105, `Reference-frame slip: expected 105, got ${countValues.calories}`);

assert(
  !computeNutrition({ ...chicken, item_id: 'different_item' }, evidence),
  'Facts must never cross item IDs',
);
assert(
  !validateEvidenceFact(
    { ...evidence, evidence_quote: 'This quote was invented: 177, 24, 0, 9.' },
    search,
  ).valid,
  'Invented evidence quotes must be rejected',
);
assert(
  !hasCompleteNutrition({ ...evidence, fats: null }),
  'Incomplete evidence must use the fallback path',
);

assert(
  validateMacroConsistency({ calories: 200, protein: 20, carbs: 20, fats: 4 }).status === 'ok',
  'Reasonably consistent macros should pass',
);
assert(
  validateMacroConsistency({ calories: 500, protein: 5, carbs: 5, fats: 1 }).status === 'review',
  'Large Atwater divergence should be marked for review',
);

console.log('All nutrition compute checks passed.');
