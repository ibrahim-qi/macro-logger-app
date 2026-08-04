import { normalizeItems, sanitizeQuantity } from '../../supabase/functions/_shared/normalizeItems.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const cases: Array<{ label: string; input: Parameters<typeof sanitizeQuantity>[0]; expectQty: number; expectCals: number }> = [
  {
    label: 'gpt-4o milk misuse',
    input: { food_name: 'Semi-skimmed milk', calories: 150, protein: 10, carbs: 14, fats: 5, quantity: 300 },
    expectQty: 1,
    expectCals: 150,
  },
  {
    label: 'gpt-4o oats misuse',
    input: { food_name: 'Oats', calories: 150, protein: 5, carbs: 27, fats: 3, quantity: 40 },
    expectQty: 1,
    expectCals: 150,
  },
  {
    label: 'gpt-4o yogurt misuse',
    input: { food_name: 'Greek yogurt', calories: 150, protein: 15, carbs: 6, fats: 0.5, quantity: 150 },
    expectQty: 1,
    expectCals: 150,
  },
  {
    label: 'valid two eggs',
    input: { food_name: 'Scrambled Egg', calories: 70, protein: 6, carbs: 0.5, fats: 5, quantity: 2 },
    expectQty: 2,
    expectCals: 70,
  },
  {
    label: 'valid twelve grapes',
    input: { food_name: 'grapes', calories: 5, protein: 0.1, carbs: 1.2, fats: 0, quantity: 12 },
    expectQty: 12,
    expectCals: 5,
  },
  {
    label: 'twenty scrambled eggs',
    input: { food_name: 'Scrambled Egg', calories: 90, protein: 7, carbs: 1, fats: 7, quantity: 20 },
    expectQty: 20,
    expectCals: 90,
  },
  {
    label: 'twenty-five almonds',
    input: { food_name: 'Almonds', calories: 7, protein: 0.3, carbs: 0.2, fats: 0.6, quantity: 25 },
    expectQty: 25,
    expectCals: 7,
  },
];

for (const c of cases) {
  const out = sanitizeQuantity(c.input);
  assert(out.quantity === c.expectQty, `${c.label}: expected qty ${c.expectQty}, got ${out.quantity}`);
  assert(out.calories === c.expectCals, `${c.label}: expected cals ${c.expectCals}, got ${out.calories}`);
}

const batch = normalizeItems([
  { food_name: 'Whey protein', calories: 120, protein: 24, carbs: 3, fats: 1.5, quantity: 1 },
  { food_name: 'Semi-skimmed milk', calories: 150, protein: 10, carbs: 14, fats: 5, quantity: 300 },
]);
assert(batch[1].quantity === 1 && batch[1].calories === 150, 'batch normalize failed');

console.log(`All ${cases.length + 1} quantity normalization checks passed.`);
