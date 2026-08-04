import {
  applySavedFoods,
  findBestSavedFoodMatch,
  scoreFoodNameMatch,
} from '../../supabase/functions/_shared/applySavedFoods.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(scoreFoodNameMatch('Scrambled eggs', 'Scrambled eggs') === 1, 'exact match');
assert(scoreFoodNameMatch('2 scrambled eggs', 'Scrambled eggs') >= 0.72, 'partial egg match');
assert(scoreFoodNameMatch('banana', 'Scrambled eggs') < 0.72, 'unrelated foods');

const saved = [
  { food_name: 'Scrambled eggs', calories: 70, protein: 6, carbs: 0.5, fats: 5 },
  { food_name: 'Protein shake', calories: 264, protein: 34, carbs: 17, fats: 6.9 },
];

const match = findBestSavedFoodMatch('scrambled egg', saved);
assert(match?.food_name === 'Scrambled eggs', 'find best match');
assert(match?.calories === 70, 'match calories');

const applied = applySavedFoods(
  [
    {
      food_name: 'Scrambled Egg',
      calories: 90,
      protein: 7,
      carbs: 1,
      fats: 6,
      quantity: 2,
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
  ],
  saved,
);

assert(applied[0].calories === 70, 'overwrite saved food macros');
assert(applied[0].from_saved_food === true, 'mark saved food source');
assert(applied[0].confidence === 'high', 'boost confidence');
assert(applied[0].quantity === 2, 'preserve quantity');
assert(applied[1].calories === 105, 'leave non-matches alone');

console.log('All saved food matching checks passed.');
