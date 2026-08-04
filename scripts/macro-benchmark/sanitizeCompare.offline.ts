/**
 * Offline A/B: sanitizeQuantity ON vs OFF on typical model misuse patterns.
 * No API key required — simulates raw LLM output where grams/ml land in quantity.
 *
 * Usage: npm run benchmark:sanitize-offline
 */

import { BENCHMARK_CASES } from './dataset.ts';
import { postProcessParsedItems } from './parseClient.ts';
import { scoreCase, aggregateScores } from './metrics.ts';
import type { ParsedFoodItem } from '../../supabase/functions/_shared/normalizeItems.ts';

/** Raw model outputs observed in the wild (gpt-4o / gemini putting g/ml in quantity). */
const MISUSE_SCENARIOS: Record<string, ParsedFoodItem[]> = {
  porridge: [
    { food_name: 'oats', calories: 150, protein: 5, carbs: 27, fats: 3, quantity: 40 },
    { food_name: 'semi-skimmed milk', calories: 96, protein: 7, carbs: 9, fats: 3.6, quantity: 200 },
  ],
  'protein-shake': [
    { food_name: 'whey protein', calories: 120, protein: 24, carbs: 3, fats: 1.5, quantity: 1 },
    { food_name: 'semi-skimmed milk', calories: 144, protein: 10, carbs: 14, fats: 5.4, quantity: 300 },
  ],
  'greek-yogurt-berries': [
    { food_name: 'Greek yogurt', calories: 90, protein: 15, carbs: 6, fats: 0.5, quantity: 150 },
    { food_name: 'blueberries', calories: 29, protein: 0.4, carbs: 7, fats: 0.2, quantity: 50 },
  ],
  'chicken-rice': [
    { food_name: 'grilled chicken breast', calories: 297, protein: 55, carbs: 0, fats: 6, quantity: 180 },
    { food_name: 'white rice', calories: 195, protein: 4, carbs: 43, fats: 0.5, quantity: 150 },
  ],
  'overnight-oats': [
    { food_name: 'oats', calories: 190, protein: 6.5, carbs: 34, fats: 3.5, quantity: 50 },
    { food_name: 'skyr', calories: 90, protein: 15, carbs: 6, fats: 0.5, quantity: 150 },
    { food_name: 'peanut butter', calories: 95, protein: 4, carbs: 3, fats: 8, quantity: 1 },
  ],
  'salmon-potato': [
    { food_name: 'baked salmon', calories: 309, protein: 34, carbs: 0, fats: 18, quantity: 150 },
    { food_name: 'baked potato', calories: 160, protein: 4, carbs: 37, fats: 0.2, quantity: 1 },
    { food_name: 'broccoli', calories: 55, protein: 4, carbs: 11, fats: 0.6, quantity: 1 },
  ],
  'two-boiled-eggs': [
    { food_name: 'boiled egg', calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3, quantity: 2 },
  ],
  'medium-banana': [
    { food_name: 'banana', calories: 105, protein: 1.3, carbs: 27, fats: 0.4, quantity: 1 },
  ],
};

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

const caseIds = Object.keys(MISUSE_SCENARIOS);
const cases = BENCHMARK_CASES.filter((c) => caseIds.includes(c.id));

const withScores = cases.map((testCase) => {
  const raw = MISUSE_SCENARIOS[testCase.id];
  return scoreCase(testCase, postProcessParsedItems(raw, true));
});

const withoutScores = cases.map((testCase) => {
  const raw = MISUSE_SCENARIOS[testCase.id];
  return scoreCase(testCase, postProcessParsedItems(raw, false));
});

console.log('Offline sanitizeQuantity A/B (simulated gram/ml-in-quantity misuse)\n');

for (let i = 0; i < cases.length; i++) {
  const tc = cases[i];
  const on = withScores[i];
  const off = withoutScores[i];
  const delta = off.calorieErrorPct - on.calorieErrorPct;
  const marker = delta > 5 ? 'sanitize wins' : delta < -5 ? 'raw wins' : 'similar';
  console.log(
    `${tc.id.padEnd(22)} ON ${fmtPct(on.calorieErrorPct).padStart(7)}  OFF ${fmtPct(off.calorieErrorPct).padStart(7)}  Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%  [${marker}]`,
  );
  if (Math.abs(delta) > 5) {
    const raw = MISUSE_SCENARIOS[tc.id];
    const fixed = postProcessParsedItems(raw, true);
    const broken = postProcessParsedItems(raw, false);
    console.log(`  raw qty: ${raw.map((i) => `${i.food_name}×${i.quantity}`).join(', ')}`);
    console.log(`  fixed:   ${fixed.map((i) => `${i.food_name}×${i.quantity}@${i.calories}kcal`).join(', ')}`);
    console.log(`  broken:  ${broken.map((i) => `${i.food_name}×${i.quantity}@${i.calories}kcal = ${Math.round(i.calories * i.quantity)}kcal line`).join(', ')}`);
  }
}

const withAgg = aggregateScores('sanitize ON (offline)', withScores);
const withoutAgg = aggregateScores('sanitize OFF (offline)', withoutScores);

console.log(`\n${'='.repeat(50)}`);
console.log(`Pass rate  ON ${(withAgg.passRate * 100).toFixed(0)}%  OFF ${(withoutAgg.passRate * 100).toFixed(0)}%`);
console.log(`Avg cal err ON ${fmtPct(withAgg.avgCalorieErrorPct)}  OFF ${fmtPct(withoutAgg.avgCalorieErrorPct)}`);
console.log(`\nRun live comparison when you have NANOGPT_API_KEY:`);
console.log(`  npm run benchmark:macros -- --compare-sanitize`);
