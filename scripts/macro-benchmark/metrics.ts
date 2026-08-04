import type { BenchmarkCase, BenchmarkItem, BenchmarkTotals } from './dataset.ts';
import { sumBenchmarkItems } from './dataset.ts';

export interface ParsedItem {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface CaseScore {
  id: string;
  difficulty: BenchmarkCase['difficulty'];
  expected: BenchmarkTotals;
  predicted: BenchmarkTotals;
  calorieErrorPct: number;
  proteinErrorPct: number;
  carbsErrorPct: number;
  fatsErrorPct: number;
  itemMatchScore: number;
  withinBand: boolean;
  predictedItems: ParsedItem[];
}

export interface ItemBreakdown {
  expectedName: string;
  matched: boolean;
  expectedLineCalories: number;
  predictedLineCalories: number;
  calorieErrorPct: number;
  predictedName?: string;
}

function pctError(expected: number, predicted: number): number {
  if (expected <= 0) return predicted <= 0 ? 0 : 100;
  return (Math.abs(predicted - expected) / expected) * 100;
}

function tokenize(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function nameSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

export function getItemBreakdown(
  testCase: BenchmarkCase,
  predictedItems: ParsedItem[],
): ItemBreakdown[] {
  const used = new Set<number>();

  return testCase.items.map((exp) => {
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < predictedItems.length; i++) {
      if (used.has(i)) continue;
      const sim = nameSimilarity(exp.name, predictedItems[i].food_name);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    const expectedLineCalories = exp.calories * exp.quantity;
    if (bestIdx === -1 || bestSim < 0.25) {
      return {
        expectedName: exp.name,
        matched: false,
        expectedLineCalories,
        predictedLineCalories: 0,
        calorieErrorPct: 100,
      };
    }

    used.add(bestIdx);
    const pred = predictedItems[bestIdx];
    const predictedLineCalories = pred.calories * (pred.quantity || 1);

    return {
      expectedName: exp.name,
      matched: true,
      expectedLineCalories,
      predictedLineCalories,
      calorieErrorPct: pctError(expectedLineCalories, predictedLineCalories),
      predictedName: pred.food_name,
    };
  });
}

function sumParsedItems(items: ParsedItem[]): BenchmarkTotals {
  return items.reduce(
    (acc, item) => {
      const q = item.quantity || 1;
      acc.calories += (item.calories || 0) * q;
      acc.protein += (item.protein || 0) * q;
      acc.carbs += (item.carbs || 0) * q;
      acc.fats += (item.fats || 0) * q;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

/** Match predicted items to expected items and score per-item calorie accuracy */
function scoreItemMatching(expected: BenchmarkItem[], predicted: ParsedItem[]): number {
  if (expected.length === 0) return 0;
  const used = new Set<number>();
  let totalScore = 0;

  for (const exp of expected) {
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (used.has(i)) continue;
      const sim = nameSimilarity(exp.name, predicted[i].food_name);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx === -1 || bestSim < 0.25) continue;
    used.add(bestIdx);
    const pred = predicted[bestIdx];
    const expTotal = exp.calories * exp.quantity;
    const predTotal = pred.calories * (pred.quantity || 1);
    const err = pctError(expTotal, predTotal);
    totalScore += Math.max(0, 100 - err);
  }

  return totalScore / expected.length;
}

/** Acceptable error bands by difficulty (% error on calories and protein) */
const CALORIE_ERROR_BANDS: Record<BenchmarkCase['difficulty'], number> = {
  easy: 15,
  medium: 25,
  hard: 40,
};

const PROTEIN_ERROR_BANDS: Record<BenchmarkCase['difficulty'], number> = {
  easy: 20,
  medium: 30,
  hard: 45,
};

export function scoreCase(testCase: BenchmarkCase, predictedItems: ParsedItem[]): CaseScore {
  const expected = sumBenchmarkItems(testCase.items);
  const predicted = sumParsedItems(predictedItems);

  const calorieErrorPct = pctError(expected.calories, predicted.calories);
  const proteinErrorPct = pctError(expected.protein, predicted.protein);

  return {
    id: testCase.id,
    difficulty: testCase.difficulty,
    expected,
    predicted,
    calorieErrorPct,
    proteinErrorPct,
    carbsErrorPct: pctError(expected.carbs, predicted.carbs),
    fatsErrorPct: pctError(expected.fats, predicted.fats),
    itemMatchScore: scoreItemMatching(testCase.items, predictedItems),
    withinBand:
      calorieErrorPct <= CALORIE_ERROR_BANDS[testCase.difficulty] &&
      proteinErrorPct <= PROTEIN_ERROR_BANDS[testCase.difficulty],
    predictedItems,
  };
}

export interface AggregateScore {
  model: string;
  cases: number;
  avgCalorieErrorPct: number;
  medianCalorieErrorPct: number;
  avgProteinErrorPct: number;
  avgItemMatchScore: number;
  passRate: number;
  byDifficulty: Record<BenchmarkCase['difficulty'], { count: number; avgCalorieErrorPct: number; passRate: number }>;
}

export function aggregateScores(model: string, scores: CaseScore[]): AggregateScore {
  const calorieErrors = scores.map((s) => s.calorieErrorPct).sort((a, b) => a - b);
  const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

  const byDifficulty = (['easy', 'medium', 'hard'] as const).reduce(
    (acc, d) => {
      const subset = scores.filter((s) => s.difficulty === d);
      acc[d] = {
        count: subset.length,
        avgCalorieErrorPct: avg(subset.map((s) => s.calorieErrorPct)),
        passRate: subset.length ? subset.filter((s) => s.withinBand).length / subset.length : 0,
      };
      return acc;
    },
    {} as AggregateScore['byDifficulty'],
  );

  return {
    model,
    cases: scores.length,
    avgCalorieErrorPct: avg(calorieErrors),
    medianCalorieErrorPct: calorieErrors[Math.floor(calorieErrors.length / 2)] ?? 0,
    avgProteinErrorPct: avg(scores.map((s) => s.proteinErrorPct)),
    avgItemMatchScore: avg(scores.map((s) => s.itemMatchScore)),
    passRate: scores.length ? scores.filter((s) => s.withinBand).length / scores.length : 0,
    byDifficulty,
  };
}
