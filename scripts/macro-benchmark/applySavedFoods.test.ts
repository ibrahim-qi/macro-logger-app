import { applySavedFoods } from '../../supabase/functions/_shared/applySavedFoods.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const saved = [
  { food_name: 'Scrambled eggs', calories: 70, protein: 6, carbs: 0.5, fats: 5 },
  { food_name: 'Protein shake', calories: 264, protein: 34, carbs: 17, fats: 6.9 },
  { food_name: 'cookie', calories: 50, protein: 1, carbs: 7, fats: 2 },
];

const applied = applySavedFoods(
  [
    {
      food_name: 'Scrambled eggs',
      calories: 90,
      protein: 7,
      carbs: 1,
      fats: 6,
      quantity: 2,
      confidence: 'medium',
      portion_assumption: 'Assumed medium eggs',
      source_note: 'CoFID',
    },
    {
      food_name: 'scrambled egg',
      calories: 90,
      protein: 7,
      carbs: 1,
      fats: 6,
      quantity: 1,
      confidence: 'medium',
    },
    {
      food_name: 'Banana',
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fats: 0.4,
      quantity: 1,
      confidence: 'high',
    },
    {
      food_name: 'cookies',
      calories: 60,
      protein: 1,
      carbs: 8,
      fats: 2,
      quantity: 2,
      confidence: 'medium',
    },
  ],
  saved,
);

assert(applied[0].calories === 70, 'exact name match overwrites macros');
assert(applied[0].from_saved_food === true, 'mark saved food source');
assert(applied[0].quantity === 2, 'preserve quantity');
assert(applied[0].portion_assumption === undefined, 'clear AI portion assumption on saved match');
assert(applied[0].source_note === 'Your saved food', 'replace AI source with saved food label');
assert(applied[1].calories === 70, 'singular/plural variant matches saved food');
assert(applied[1].from_saved_food === true, 'singular variant marked as saved');
assert(applied[1].food_name === 'Scrambled eggs', 'canonical saved name applied');
assert(applied[2].calories === 105, 'unrelated food unchanged');
assert(applied[3].calories === 50, '-es plural matches saved cookie name');
assert(applied[3].from_saved_food === true, 'cookie plural marked as saved');
assert(applied[3].food_name === 'cookie', 'canonical saved name applied for -es plural');

console.log('All saved food matching checks passed.');
