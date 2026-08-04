import type {
  BenchmarkCase,
  BenchmarkItem,
  BenchmarkRange,
  BenchmarkTotals,
} from './dataset.ts';
import { sumBenchmarkItems } from './dataset.ts';

export type EvidenceStatus = 'uk_evidence' | 'ai_estimate' | 'user_saved' | 'unavailable';

export interface ParsedItem {
  item_id?: string;
  food_name: string;
  preparation?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  unit?: 'count' | 'serving';
  reference_weight_g?: number;
  reference_volume_ml?: number;
  evidence_status?: EvidenceStatus;
  source_title?: string;
  source_url?: string;
  evidence_quote?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface ItemBreakdown {
  expectedName: string;
  matched: boolean;
  expectedLineCalories: number;
  predictedLineCalories: number;
  calorieErrorPct: number;
  proteinErrorPct: number;
  carbsErrorPct: number;
  fatsErrorPct: number;
  expectedMacros: BenchmarkTotals;
  predictedMacros: BenchmarkTotals;
  predictedName?: string;
  expectedQuantity?: BenchmarkRange;
  predictedQuantity?: number;
  quantityCorrect?: boolean;
  expectedUnit?: BenchmarkItem['expectedUnit'];
  predictedUnit?: ParsedItem['unit'];
  unitCorrect?: boolean;
  expectedReferenceWeightG?: BenchmarkRange;
  predictedReferenceWeightG?: number;
  referenceWeightCorrect?: boolean;
  expectedReferenceVolumeMl?: BenchmarkRange;
  predictedReferenceVolumeMl?: number;
  referenceVolumeCorrect?: boolean;
  evidenceStatus?: ParsedItem['evidence_status'];
  evidenceStatusValid: boolean;
  sourceMetadataComplete: boolean;
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
  expectedItemCount: number;
  predictedItemCount: number;
  itemCountCorrect: boolean;
  matchedItemCount: number;
  itemMatchScore: number;
  structuralScore: number;
  quantityPassRate?: number;
  unitPassRate?: number;
  referenceAmountPassRate?: number;
  evidenceStatusCoverage: number;
  sourceMetadataRate: number;
  evidenceStatusCounts: Record<EvidenceStatus | 'missing', number>;
  nutritionWithinBand: boolean;
  structureWithinBand: boolean;
  withinBand: boolean;
  itemBreakdown: ItemBreakdown[];
  predictedItems: ParsedItem[];
  durationMs?: number;
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
  for (const token of ta) if (tb.has(token)) overlap += 1;
  return overlap / Math.max(ta.size, tb.size);
}

function inRange(value: number | undefined, range: BenchmarkRange): boolean {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= range.min &&
    value <= range.max;
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function evidenceStatusValid(item: ParsedItem): boolean {
  return item.evidence_status === 'uk_evidence' ||
    item.evidence_status === 'ai_estimate' ||
    item.evidence_status === 'user_saved' ||
    item.evidence_status === 'unavailable';
}

function sourceMetadataComplete(item: ParsedItem): boolean {
  if (!evidenceStatusValid(item)) return false;
  if (item.evidence_status === 'uk_evidence') {
    return hasText(item.source_title) &&
      /^https?:\/\//i.test(item.source_url?.trim() ?? '') &&
      hasText(item.evidence_quote);
  }
  if (item.evidence_status === 'ai_estimate' || item.evidence_status === 'user_saved') {
    return hasText(item.source_title);
  }
  return false;
}

function emptyMacros(): BenchmarkTotals {
  return { calories: 0, protein: 0, carbs: 0, fats: 0 };
}

function itemMacros(item: BenchmarkItem | ParsedItem): BenchmarkTotals {
  return {
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0,
    carbs: Number(item.carbs) || 0,
    fats: Number(item.fats) || 0,
  };
}

function missingBreakdown(exp: BenchmarkItem): ItemBreakdown {
  const expectedMacros = itemMacros(exp);
  return {
    expectedName: exp.name,
    matched: false,
    expectedLineCalories: exp.calories * exp.quantity,
    predictedLineCalories: 0,
    calorieErrorPct: 100,
    proteinErrorPct: exp.protein > 0 ? 100 : 0,
    carbsErrorPct: exp.carbs > 0 ? 100 : 0,
    fatsErrorPct: exp.fats > 0 ? 100 : 0,
    expectedMacros,
    predictedMacros: emptyMacros(),
    expectedQuantity: exp.expectedQuantity,
    quantityCorrect: exp.expectedQuantity ? false : undefined,
    expectedUnit: exp.expectedUnit,
    unitCorrect: exp.expectedUnit ? false : undefined,
    expectedReferenceWeightG: exp.expectedReferenceWeightG,
    referenceWeightCorrect: exp.expectedReferenceWeightG ? false : undefined,
    expectedReferenceVolumeMl: exp.expectedReferenceVolumeMl,
    referenceVolumeCorrect: exp.expectedReferenceVolumeMl ? false : undefined,
    evidenceStatusValid: false,
    sourceMetadataComplete: false,
  };
}

export function getItemBreakdown(
  testCase: BenchmarkCase,
  predictedItems: ParsedItem[],
): ItemBreakdown[] {
  const used = new Set<number>();

  return testCase.items.map((exp) => {
    let bestIdx = -1;
    let bestSim = 0;
    for (let index = 0; index < predictedItems.length; index += 1) {
      if (used.has(index)) continue;
      const similarity = nameSimilarity(exp.name, predictedItems[index].food_name);
      if (similarity > bestSim) {
        bestSim = similarity;
        bestIdx = index;
      }
    }

    if (bestIdx === -1 || bestSim < 0.25) return missingBreakdown(exp);

    used.add(bestIdx);
    const predictedItem = predictedItems[bestIdx];
    const expectedMacros = itemMacros(exp);
    const predictedMacros = itemMacros(predictedItem);
    const predictedQuantity = Number.isFinite(predictedItem.quantity)
      ? predictedItem.quantity
      : 1;

    return {
      expectedName: exp.name,
      matched: true,
      expectedLineCalories: exp.calories * exp.quantity,
      predictedLineCalories: predictedItem.calories * predictedQuantity,
      calorieErrorPct: pctError(exp.calories, predictedItem.calories),
      proteinErrorPct: pctError(exp.protein, predictedItem.protein),
      carbsErrorPct: pctError(exp.carbs, predictedItem.carbs),
      fatsErrorPct: pctError(exp.fats, predictedItem.fats),
      expectedMacros,
      predictedMacros,
      predictedName: predictedItem.food_name,
      expectedQuantity: exp.expectedQuantity,
      predictedQuantity,
      quantityCorrect: exp.expectedQuantity
        ? inRange(predictedQuantity, exp.expectedQuantity)
        : undefined,
      expectedUnit: exp.expectedUnit,
      predictedUnit: predictedItem.unit,
      unitCorrect: exp.expectedUnit
        ? predictedItem.unit === exp.expectedUnit
        : undefined,
      expectedReferenceWeightG: exp.expectedReferenceWeightG,
      predictedReferenceWeightG: predictedItem.reference_weight_g,
      referenceWeightCorrect: exp.expectedReferenceWeightG
        ? inRange(predictedItem.reference_weight_g, exp.expectedReferenceWeightG)
        : undefined,
      expectedReferenceVolumeMl: exp.expectedReferenceVolumeMl,
      predictedReferenceVolumeMl: predictedItem.reference_volume_ml,
      referenceVolumeCorrect: exp.expectedReferenceVolumeMl
        ? inRange(predictedItem.reference_volume_ml, exp.expectedReferenceVolumeMl)
        : undefined,
      evidenceStatus: predictedItem.evidence_status,
      evidenceStatusValid: evidenceStatusValid(predictedItem),
      sourceMetadataComplete: sourceMetadataComplete(predictedItem),
    };
  });
}

function sumParsedItems(items: ParsedItem[]): BenchmarkTotals {
  return items.reduce(
    (acc, item) => {
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0
        ? item.quantity
        : 1;
      acc.calories += (Number(item.calories) || 0) * quantity;
      acc.protein += (Number(item.protein) || 0) * quantity;
      acc.carbs += (Number(item.carbs) || 0) * quantity;
      acc.fats += (Number(item.fats) || 0) * quantity;
      return acc;
    },
    emptyMacros(),
  );
}

function passRate(values: Array<boolean | undefined>): number | undefined {
  const checked = values.filter((value): value is boolean => typeof value === 'boolean');
  if (!checked.length) return undefined;
  return checked.filter(Boolean).length / checked.length;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function scoreItemMatching(breakdown: ItemBreakdown[]): number {
  if (!breakdown.length) return 0;
  return average(breakdown.map((item) => (
    item.matched ? Math.max(0, 100 - item.calorieErrorPct) : 0
  )));
}

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
  const itemBreakdown = getItemBreakdown(testCase, predictedItems);
  const matchedItemCount = itemBreakdown.filter((item) => item.matched).length;
  const itemCountCorrect = predictedItems.length === testCase.items.length;
  const quantityPassRate = passRate(itemBreakdown.map((item) => item.quantityCorrect));
  const unitPassRate = passRate(itemBreakdown.map((item) => item.unitCorrect));
  const referenceAmountPassRate = passRate(itemBreakdown.flatMap((item) => [
    item.referenceWeightCorrect,
    item.referenceVolumeCorrect,
  ]));
  const structuralParts = [
    itemCountCorrect ? 1 : 0,
    testCase.items.length ? matchedItemCount / testCase.items.length : 1,
    quantityPassRate,
    unitPassRate,
    referenceAmountPassRate,
  ].filter((value): value is number => typeof value === 'number');
  const calorieErrorPct = pctError(expected.calories, predicted.calories);
  const proteinErrorPct = pctError(expected.protein, predicted.protein);
  const nutritionWithinBand =
    calorieErrorPct <= CALORIE_ERROR_BANDS[testCase.difficulty] &&
    proteinErrorPct <= PROTEIN_ERROR_BANDS[testCase.difficulty];
  const structureWithinBand =
    itemCountCorrect &&
    matchedItemCount === testCase.items.length &&
    (quantityPassRate === undefined || quantityPassRate === 1) &&
    (unitPassRate === undefined || unitPassRate === 1) &&
    (referenceAmountPassRate === undefined || referenceAmountPassRate === 1);
  const evidenceStatusCounts: CaseScore['evidenceStatusCounts'] = {
    uk_evidence: 0,
    ai_estimate: 0,
    user_saved: 0,
    unavailable: 0,
    missing: 0,
  };
  for (const item of predictedItems) {
    const status = evidenceStatusValid(item) ? item.evidence_status : 'missing';
    evidenceStatusCounts[status ?? 'missing'] += 1;
  }

  return {
    id: testCase.id,
    difficulty: testCase.difficulty,
    expected,
    predicted,
    calorieErrorPct,
    proteinErrorPct,
    carbsErrorPct: pctError(expected.carbs, predicted.carbs),
    fatsErrorPct: pctError(expected.fats, predicted.fats),
    expectedItemCount: testCase.items.length,
    predictedItemCount: predictedItems.length,
    itemCountCorrect,
    matchedItemCount,
    itemMatchScore: scoreItemMatching(itemBreakdown),
    structuralScore: average(structuralParts) * 100,
    quantityPassRate,
    unitPassRate,
    referenceAmountPassRate,
    evidenceStatusCoverage: predictedItems.length
      ? predictedItems.filter(evidenceStatusValid).length / predictedItems.length
      : 0,
    sourceMetadataRate: predictedItems.length
      ? predictedItems.filter(sourceMetadataComplete).length / predictedItems.length
      : 0,
    evidenceStatusCounts,
    nutritionWithinBand,
    structureWithinBand,
    withinBand: nutritionWithinBand && structureWithinBand,
    itemBreakdown,
    predictedItems,
  };
}

export interface TimingStats {
  p50: number;
  p95: number;
}

export interface AggregateScore {
  model: string;
  cases: number;
  avgCalorieErrorPct: number;
  medianCalorieErrorPct: number;
  avgProteinErrorPct: number;
  avgCarbsErrorPct: number;
  avgFatsErrorPct: number;
  avgItemMatchScore: number;
  avgStructuralScore: number;
  itemCountAccuracy: number;
  avgEvidenceStatusCoverage: number;
  avgSourceMetadataRate: number;
  passRate: number;
  byDifficulty: Record<BenchmarkCase['difficulty'], {
    count: number;
    avgCalorieErrorPct: number;
    avgStructuralScore: number;
    passRate: number;
  }>;
  timingMs?: TimingStats;
  timingByDifficulty?: Record<BenchmarkCase['difficulty'], TimingStats & { count: number }>;
}

function percentile(sorted: number[], percentileValue: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

function timingStats(values: number[]): TimingStats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
  };
}

export function aggregateScores(model: string, scores: CaseScore[]): AggregateScore {
  const calorieErrors = scores.map((score) => score.calorieErrorPct).sort((a, b) => a - b);
  const byDifficulty = (['easy', 'medium', 'hard'] as const).reduce(
    (acc, difficulty) => {
      const subset = scores.filter((score) => score.difficulty === difficulty);
      acc[difficulty] = {
        count: subset.length,
        avgCalorieErrorPct: average(subset.map((score) => score.calorieErrorPct)),
        avgStructuralScore: average(subset.map((score) => score.structuralScore)),
        passRate: subset.length
          ? subset.filter((score) => score.withinBand).length / subset.length
          : 0,
      };
      return acc;
    },
    {} as AggregateScore['byDifficulty'],
  );
  const durations = scores
    .map((score) => score.durationMs)
    .filter((value): value is number => typeof value === 'number');
  const timingByDifficulty = (['easy', 'medium', 'hard'] as const).reduce(
    (acc, difficulty) => {
      const subset = scores
        .filter((score) => score.difficulty === difficulty)
        .map((score) => score.durationMs)
        .filter((value): value is number => typeof value === 'number');
      if (subset.length) acc[difficulty] = { count: subset.length, ...timingStats(subset) };
      return acc;
    },
    {} as NonNullable<AggregateScore['timingByDifficulty']>,
  );

  return {
    model,
    cases: scores.length,
    avgCalorieErrorPct: average(calorieErrors),
    medianCalorieErrorPct: calorieErrors[Math.floor(calorieErrors.length / 2)] ?? 0,
    avgProteinErrorPct: average(scores.map((score) => score.proteinErrorPct)),
    avgCarbsErrorPct: average(scores.map((score) => score.carbsErrorPct)),
    avgFatsErrorPct: average(scores.map((score) => score.fatsErrorPct)),
    avgItemMatchScore: average(scores.map((score) => score.itemMatchScore)),
    avgStructuralScore: average(scores.map((score) => score.structuralScore)),
    itemCountAccuracy: scores.length
      ? scores.filter((score) => score.itemCountCorrect).length / scores.length
      : 0,
    avgEvidenceStatusCoverage: average(scores.map((score) => score.evidenceStatusCoverage)),
    avgSourceMetadataRate: average(scores.map((score) => score.sourceMetadataRate)),
    passRate: scores.length
      ? scores.filter((score) => score.withinBand).length / scores.length
      : 0,
    byDifficulty,
    timingMs: durations.length ? timingStats(durations) : undefined,
    timingByDifficulty: Object.keys(timingByDifficulty).length ? timingByDifficulty : undefined,
  };
}
