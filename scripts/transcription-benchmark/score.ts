/**
 * Nutrition-critical token scoring for STT fixtures.
 * Measures whether amounts, units, brands, foods, prep, and negation survive —
 * not generic word-error rate.
 */

export type CriticalTokenCategory =
  | 'amounts'
  | 'units'
  | 'brands'
  | 'foods'
  | 'prep'
  | 'negation';

export type CriticalTokens = Partial<Record<CriticalTokenCategory, string[]>>;

export interface CriticalTokenScore {
  category: CriticalTokenCategory;
  expected: string[];
  matched: string[];
  missed: string[];
  hitRate: number;
}

export interface TranscriptScore {
  criticalTokenAccuracy: number;
  categoryScores: CriticalTokenScore[];
  expectedCount: number;
  matchedCount: number;
  exactNormalizedMatch: boolean;
}

const CATEGORIES: CriticalTokenCategory[] = [
  'amounts',
  'units',
  'brands',
  'foods',
  'prep',
  'negation',
];

/** Normalize for loose containment checks without changing nutrition meaning. */
export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s'%.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenPresent(haystack: string, needle: string): boolean {
  const n = normalizeForMatch(needle);
  if (!n) return true;
  if (haystack.includes(n)) return true;

  // Allow "150 g" vs "150g" and "two" vs "2" only when explicitly listed as expected.
  const compactHay = haystack.replace(/\s+/g, '');
  const compactNeedle = n.replace(/\s+/g, '');
  return compactNeedle.length > 0 && compactHay.includes(compactNeedle);
}

export function scoreCriticalTokens(
  transcript: string,
  expected: CriticalTokens,
): TranscriptScore {
  const haystack = normalizeForMatch(transcript);
  const categoryScores: CriticalTokenScore[] = [];
  let expectedCount = 0;
  let matchedCount = 0;

  for (const category of CATEGORIES) {
    const tokens = (expected[category] ?? [])
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 0) continue;

    const matched: string[] = [];
    const missed: string[] = [];
    for (const token of tokens) {
      expectedCount += 1;
      if (tokenPresent(haystack, token)) {
        matched.push(token);
        matchedCount += 1;
      } else {
        missed.push(token);
      }
    }

    categoryScores.push({
      category,
      expected: tokens,
      matched,
      missed,
      hitRate: tokens.length === 0 ? 1 : matched.length / tokens.length,
    });
  }

  const criticalTokenAccuracy = expectedCount === 0
    ? (normalizeForMatch(transcript).length > 0 ? 1 : 0)
    : matchedCount / expectedCount;

  return {
    criticalTokenAccuracy,
    categoryScores,
    expectedCount,
    matchedCount,
    exactNormalizedMatch: false,
  };
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedAsc[low];
  const weight = rank - low;
  return Math.round(
    (sortedAsc[low] * (1 - weight) + sortedAsc[high] * weight) * 1000,
  ) / 1000;
}

export interface LatencySummary {
  count: number;
  p50: number;
  p95: number;
  mean: number;
}

export function summarizeLatencies(latenciesMs: number[]): LatencySummary {
  const sorted = [...latenciesMs].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { count: 0, p50: 0, p95: 0, mean: 0 };
  }
  const mean = sorted.reduce((sum, n) => sum + n, 0) / sorted.length;
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    mean,
  };
}
