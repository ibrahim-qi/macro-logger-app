import type { CriticalTokens } from './score.ts';

export interface TranscriptionFixture {
  id: string;
  /** Relative path under the fixture directory (optional for mock-only cases). */
  audio?: string;
  mimeType?: string;
  /** Ground-truth spoken meal (human reference; not used to rewrite STT). */
  expectedTranscript?: string;
  criticalTokens: CriticalTokens;
  /**
   * Offline mock STT output for scoring/contract tests without provider calls.
   * Live bake-off ignores this when audio is present and --live is set.
   */
  mockSttText?: string;
  notes?: string;
}

export interface FixtureManifest {
  version: 1;
  description?: string;
  fixtures: TranscriptionFixture[];
}

export interface FixtureCaseResult {
  id: string;
  mode: 'mock' | 'live';
  transcript: string;
  criticalTokenAccuracy: number;
  matchedCount: number;
  expectedCount: number;
  missedTokens: string[];
  latencyMs?: number;
  failure?: string;
  costEstimateUsd?: number;
}

export interface BenchmarkSummary {
  generatedAt: string;
  mode: 'mock' | 'live';
  provider?: string;
  model?: string;
  fixtureCount: number;
  scoredCount: number;
  failureCount: number;
  meanCriticalTokenAccuracy: number;
  passRate: number;
  /** Fixtures with criticalTokenAccuracy === 1. */
  perfectCount: number;
  latency: {
    count: number;
    p50: number;
    p95: number;
    mean: number;
  };
  approximateCostUsd: number;
  failures: Array<{ id: string; failure: string }>;
  cases: FixtureCaseResult[];
}
