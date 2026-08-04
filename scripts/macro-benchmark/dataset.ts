/**
 * Ground-truth macro benchmarks for Sahha parse-meal evaluation.
 * Values are per-unit macros (calories, protein, carbs, fats) × quantity = meal total.
 * Sources: McDonald's UK nutrition, USDA FoodData Central, CoFID-style averages.
 */

export interface BenchmarkItem {
  /** Canonical label used for fuzzy item matching in scoring */
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
}

export interface BenchmarkCase {
  id: string;
  input: string;
  items: BenchmarkItem[];
  source: string;
  /** vague | specific | branded — affects expected error band */
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface BenchmarkTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export function sumBenchmarkItems(items: BenchmarkItem[]): BenchmarkTotals {
  return items.reduce(
    (acc, item) => {
      const q = item.quantity;
      acc.calories += item.calories * q;
      acc.protein += item.protein * q;
      acc.carbs += item.carbs * q;
      acc.fats += item.fats * q;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

/** Curated set — expand over time with your own logged meals + verified labels */
export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'two-boiled-eggs',
    input: '2 boiled eggs',
    difficulty: 'easy',
    source: 'USDA: 1 large egg ~6.3g protein, ~78 kcal',
    items: [{ name: 'boiled egg', calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3, quantity: 2 }],
  },
  {
    id: 'one-boiled-egg',
    input: 'one boiled egg',
    difficulty: 'easy',
    source: 'USDA: 1 large egg ~6.3g protein',
    items: [{ name: 'boiled egg', calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3, quantity: 1 }],
  },
  {
    id: 'two-eggs-toast',
    input: '2 scrambled eggs and 2 slices of white toast with butter',
    difficulty: 'medium',
    source: 'USDA averages: 1 large egg ~70 kcal; 1 toast slice ~80 kcal + ~5 kcal butter',
    items: [
      { name: 'egg', calories: 70, protein: 6, carbs: 0.5, fats: 5, quantity: 2 },
      { name: 'toast', calories: 80, protein: 3, carbs: 15, fats: 1, quantity: 2 },
      { name: 'butter', calories: 5, protein: 0, carbs: 0, fats: 0.5, quantity: 2 },
    ],
  },
  {
    id: 'chicken-rice',
    input: 'grilled chicken breast about 180 grams with 150 grams cooked white rice',
    difficulty: 'medium',
    source: 'USDA: chicken breast cooked ~165 kcal/100g; white rice cooked ~130 kcal/100g',
    items: [
      { name: 'chicken breast', calories: 297, protein: 55, carbs: 0, fats: 6, quantity: 1 },
      { name: 'white rice', calories: 195, protein: 4, carbs: 43, fats: 0.5, quantity: 1 },
    ],
  },
  {
    id: 'medium-banana',
    input: 'one medium banana',
    difficulty: 'easy',
    source: 'USDA: medium banana ~118g, ~105 kcal',
    items: [{ name: 'banana', calories: 105, protein: 1.3, carbs: 27, fats: 0.4, quantity: 1 }],
  },
  {
    id: 'big-mac',
    input: 'McDonald\'s Big Mac',
    difficulty: 'easy',
    source: 'McDonald\'s UK nutrition (2024): 508 kcal per burger',
    items: [{ name: 'Big Mac', calories: 508, protein: 27, carbs: 41, fats: 25, quantity: 1 }],
  },
  {
    id: 'porridge',
    input: 'bowl of porridge made with 40g oats and 200ml semi-skimmed milk',
    difficulty: 'medium',
    source: 'UK average: 40g dry oats ~150 kcal; 200ml semi-skimmed ~96 kcal',
    items: [
      { name: 'oats', calories: 150, protein: 5, carbs: 27, fats: 3, quantity: 1 },
      { name: 'semi-skimmed milk', calories: 96, protein: 7, carbs: 9, fats: 3.6, quantity: 1 },
    ],
  },
  {
    id: 'latte',
    input: 'large latte with semi-skimmed milk',
    difficulty: 'hard',
    source: 'Coffee shop average: large latte ~220ml milk ≈ 120–150 kcal',
    items: [{ name: 'latte', calories: 135, protein: 7, carbs: 10, fats: 7, quantity: 1 }],
  },
  {
    id: 'greek-yogurt-berries',
    input: '150g Greek yogurt with a handful of blueberries',
    difficulty: 'hard',
    source: 'USDA: 150g 0% Greek yogurt ~90 kcal; ~50g blueberries ~29 kcal',
    items: [
      { name: 'Greek yogurt', calories: 90, protein: 15, carbs: 6, fats: 0.5, quantity: 1 },
      { name: 'blueberries', calories: 29, protein: 0.4, carbs: 7, fats: 0.2, quantity: 1 },
    ],
  },
  {
    id: 'salmon-potato',
    input: '150g baked salmon fillet with a medium baked potato and broccoli',
    difficulty: 'medium',
    source: 'USDA cooked salmon ~206 kcal/100g; medium baked potato ~160 kcal; broccoli side ~55 kcal',
    items: [
      { name: 'salmon', calories: 309, protein: 34, carbs: 0, fats: 18, quantity: 1 },
      { name: 'baked potato', calories: 160, protein: 4, carbs: 37, fats: 0.2, quantity: 1 },
      { name: 'broccoli', calories: 55, protein: 4, carbs: 11, fats: 0.6, quantity: 1 },
    ],
  },
  {
    id: 'meal-deal',
    input: 'meal deal: chicken sandwich, walkers crisps, and a diet coke',
    difficulty: 'hard',
    source: 'UK meal deal averages: sandwich ~350 kcal, crisps ~150 kcal, diet coke 0',
    items: [
      { name: 'chicken sandwich', calories: 350, protein: 18, carbs: 38, fats: 12, quantity: 1 },
      { name: 'crisps', calories: 150, protein: 2, carbs: 15, fats: 9, quantity: 1 },
      { name: 'diet coke', calories: 0, protein: 0, carbs: 0, fats: 0, quantity: 1 },
    ],
  },
  {
    id: 'protein-shake',
    input: 'one scoop whey protein with 300ml semi-skimmed milk',
    difficulty: 'medium',
    source: 'Typical whey scoop ~120 kcal + 300ml semi-skimmed ~144 kcal',
    items: [
      { name: 'whey protein', calories: 120, protein: 24, carbs: 3, fats: 1.5, quantity: 1 },
      { name: 'semi-skimmed milk', calories: 144, protein: 10, carbs: 14, fats: 5.4, quantity: 1 },
    ],
  },
  {
    id: 'vague-lunch',
    input: 'had a big lunch, chicken wrap and some chips',
    difficulty: 'hard',
    source: 'Wide acceptable band: wrap ~400 kcal, small chips ~300 kcal',
    items: [
      { name: 'chicken wrap', calories: 400, protein: 22, carbs: 35, fats: 18, quantity: 1 },
      { name: 'chips', calories: 300, protein: 4, carbs: 38, fats: 15, quantity: 1 },
    ],
  },
  {
    id: 'overnight-oats',
    input: 'overnight oats with 50g oats, 150g skyr, and a tablespoon of peanut butter',
    difficulty: 'medium',
    source: '50g oats ~190 kcal; 150g skyr ~90 kcal; 1 tbsp PB ~95 kcal',
    items: [
      { name: 'oats', calories: 190, protein: 6.5, carbs: 34, fats: 3.5, quantity: 1 },
      { name: 'skyr', calories: 90, protein: 15, carbs: 6, fats: 0.5, quantity: 1 },
      { name: 'peanut butter', calories: 95, protein: 4, carbs: 3, fats: 8, quantity: 1 },
    ],
  },
  {
    id: 'greggs-sausage-roll',
    input: "Greggs sausage roll",
    difficulty: 'easy',
    source: 'Greggs UK official (2024): 348 kcal per roll (103g), 9.2g protein',
    items: [{ name: 'sausage roll', calories: 348, protein: 9.2, carbs: 24, fats: 24, quantity: 1 }],
  },
  {
    id: 'costa-large-latte',
    input: 'Costa large latte with semi-skimmed milk',
    difficulty: 'medium',
    source: 'Costa UK: large latte semi-skimmed in store ~472ml, 198 kcal, ~15g protein',
    items: [{ name: 'latte', calories: 198, protein: 14.9, carbs: 21.4, fats: 6.8, quantity: 1 }],
  },
  {
    id: 'pret-ham-cheese',
    input: 'Pret ham and cheese baguette',
    difficulty: 'easy',
    source: 'Pret UK official: Ham & Cheese malted bread, 531 kcal, 30g protein',
    items: [{ name: 'ham and cheese', calories: 531, protein: 30, carbs: 42.7, fats: 25.8, quantity: 1 }],
  },
  {
    id: 'two-slices-sourdough',
    input: '2 slices of sourdough toast',
    difficulty: 'medium',
    source: 'UK average thick sourdough slice ~95 kcal; white toast benchmark ~80 kcal',
    items: [{ name: 'sourdough toast', calories: 95, protein: 3.5, carbs: 17, fats: 1.2, quantity: 2 }],
  },
  {
    id: 'plain-kefir-200ml',
    input: '200ml plain kefir',
    difficulty: 'medium',
    source: 'CoFID-style: 200ml plain low-fat kefir ~96 kcal, ~7g protein',
    items: [{ name: 'plain kefir', calories: 96, protein: 7, carbs: 9, fats: 3.6, quantity: 1 }],
  },
  {
    id: 'chicken-thighs-180g',
    input: '180g boneless skinless chicken thighs',
    difficulty: 'medium',
    source: 'USDA cooked thigh meat ~177 kcal/100g → ~318 kcal for 180g',
    items: [{ name: 'chicken thigh', calories: 318, protein: 38, carbs: 0, fats: 18, quantity: 1 }],
  },
  {
    id: 'two-chicken-thighs',
    input: '2 boneless skinless chicken thighs',
    difficulty: 'medium',
    source: 'UK average medium cooked thigh ~200 kcal each (size varies widely)',
    items: [{ name: 'chicken thigh', calories: 200, protein: 26, carbs: 0, fats: 10, quantity: 2 }],
  },
];
