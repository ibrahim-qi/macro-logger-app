import {
  sanifyInterpretationPortions,
} from '../../supabase/functions/_shared/interpretationPortionSanity.ts';
import type { InterpretedMealItem } from '../../supabase/functions/_shared/mealParsePrompt.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function item(overrides: Partial<InterpretedMealItem> & Pick<InterpretedMealItem, 'quantity'>): InterpretedMealItem {
  return {
    item_id: 'item_1',
    food_name: 'chicken nuggets',
    preparation: 'breaded',
    unit: 'count',
    portion_assumption: 'Assumed 6 nuggets',
    reference_weight_g: 120,
    reference_volume_ml: null,
    search_query: 'chicken nuggets uk nutrition',
    ...overrides,
  };
}

const vagueNuggets = sanifyInterpretationPortions(
  { input_assessment: 'meal', notes: '', items: [item({ quantity: 6 })] },
  'I had some chicken nuggets',
).items[0];

assert(vagueNuggets.quantity === 1, 'Vague nuggets should collapse to one serving');
assert(vagueNuggets.unit === 'serving', 'Vague nuggets should use serving unit');
assert(vagueNuggets.reference_weight_g === 120, 'Vague nuggets should keep total portion weight');

const explicitSix = sanifyInterpretationPortions(
  { input_assessment: 'meal', notes: '', items: [item({ quantity: 6 })] },
  '6 chicken nuggets',
).items[0];

assert(explicitSix.quantity === 1, 'Six nuggets with serving-sized ref should collapse to one portion');
assert(explicitSix.unit === 'serving', 'Explicit six nuggets should become one serving');
assert(explicitSix.reference_weight_g === 120, 'Explicit six nuggets should keep total portion weight');

const twoThighs = sanifyInterpretationPortions(
  {
    input_assessment: 'meal',
    notes: '',
    items: [item({
      food_name: 'chicken thigh',
      quantity: 2,
      unit: 'count',
      reference_weight_g: 130,
      portion_assumption: 'two thighs at 130g each',
    })],
  },
  'two chicken thighs',
).items[0];

assert(twoThighs.quantity === 2, 'Explicit large pieces should keep count');
assert(twoThighs.reference_weight_g === 130, 'Large per-piece weights should not be divided');

const twoPortions = sanifyInterpretationPortions(
  {
    input_assessment: 'meal',
    notes: '',
    items: [item({
      quantity: 2,
      unit: 'serving',
      reference_weight_g: 100,
      portion_assumption: 'two portions',
    })],
  },
  'two portions of chicken nuggets',
).items[0];

assert(twoPortions.quantity === 2, 'Explicit multi-portion wording should keep quantity');

const nuggetsWithRice = sanifyInterpretationPortions(
  {
    input_assessment: 'meal',
    notes: '',
    items: [
      item({ item_id: 'item_1', quantity: 6 }),
      item({
        item_id: 'item_2',
        food_name: 'white rice',
        quantity: 1,
        unit: 'serving',
        reference_weight_g: 80,
        portion_assumption: '80g cooked rice',
      }),
    ],
  },
  'chicken nuggets and 80g rice',
).items[0];

assert(nuggetsWithRice.quantity === 1, 'Nuggets should still collapse when another item has a gram weight');
assert(nuggetsWithRice.unit === 'serving', 'Nuggets in mixed meal should become one serving');

const twoBreasts = sanifyInterpretationPortions(
  {
    input_assessment: 'meal',
    notes: '',
    items: [item({
      food_name: 'chicken breast',
      quantity: 2,
      unit: 'count',
      reference_weight_g: 90,
      portion_assumption: 'two breasts at 90g each',
    })],
  },
  'two chicken breasts',
).items[0];

assert(twoBreasts.quantity === 2, 'Two chicken breasts should keep count');
assert(twoBreasts.reference_weight_g === 90, 'Per-piece breast weight should stay unchanged');

console.log('All interpretation portion sanity checks passed.');
