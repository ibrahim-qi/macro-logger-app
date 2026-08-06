import assert from 'node:assert/strict';
import {
  normalizeForMatch,
  percentile,
  scoreCriticalTokens,
  summarizeLatencies,
} from './score.ts';
import { shouldRejectNoSpeechProb } from '../../supabase/functions/_shared/stt/noSpeech.ts';
import type { SttResult } from '../../supabase/functions/_shared/stt/types.ts';

function testNormalize() {
  assert.equal(normalizeForMatch('  150g  Eggs! '), '150g eggs');
}

function testCriticalTokenHit() {
  const score = scoreCriticalTokens(
    'two scrambled eggs about 150 grams with no butter',
    {
      amounts: ['two', '150'],
      units: ['grams'],
      foods: ['eggs'],
      prep: ['scrambled'],
      negation: ['no butter'],
    },
  );
  assert.equal(score.expectedCount, 6);
  assert.equal(score.matchedCount, 6);
  assert.equal(score.criticalTokenAccuracy, 1);
}

function testCriticalTokenMiss() {
  const score = scoreCriticalTokens(
    'two scrambled eggs about 50 grams',
    {
      amounts: ['150'],
      units: ['grams'],
      foods: ['eggs'],
    },
  );
  assert.equal(score.matchedCount, 2);
  assert.ok(score.criticalTokenAccuracy < 1);
  assert.deepEqual(
    score.categoryScores.find((entry) => entry.category === 'amounts')?.missed,
    ['150'],
  );
}

function testCompactUnitMatch() {
  const score = scoreCriticalTokens('150g chicken', {
    amounts: ['150'],
    units: ['g'],
    foods: ['chicken'],
  });
  assert.equal(score.criticalTokenAccuracy, 1);
}

function testPercentileAndLatency() {
  assert.equal(percentile([10, 20, 30, 40, 50], 50), 30);
  const summary = summarizeLatencies([100, 200, 300, 400, 1000]);
  assert.equal(summary.count, 5);
  assert.equal(summary.p50, 300);
  assert.equal(summary.p95, 880);
}

function testNoSpeechGate() {
  const highSilence: Pick<SttResult, 'text' | 'segments' | 'noSpeechProbMean'> = {
    text: 'hello there',
    segments: [
      { noSpeechProb: 0.9 },
      { noSpeechProb: 0.92 },
    ],
  };
  assert.equal(shouldRejectNoSpeechProb(highSilence), true);

  const mealWithNoise: Pick<SttResult, 'text' | 'segments' | 'noSpeechProbMean'> = {
    text: 'two eggs on toast',
    noSpeechProbMean: 0.7,
    segments: [
      { noSpeechProb: 0.7 },
      { noSpeechProb: 0.7 },
    ],
  };
  assert.equal(shouldRejectNoSpeechProb(mealWithNoise), false);

  const meanHighNoMeal: Pick<SttResult, 'text' | 'segments' | 'noSpeechProbMean'> = {
    text: 'walking to the shop',
    noSpeechProbMean: 0.7,
    segments: [
      { noSpeechProb: 0.7 },
      { noSpeechProb: 0.7 },
    ],
  };
  assert.equal(shouldRejectNoSpeechProb(meanHighNoMeal), true);
}

function main() {
  testNormalize();
  testCriticalTokenHit();
  testCriticalTokenMiss();
  testCompactUnitMatch();
  testPercentileAndLatency();
  testNoSpeechGate();
  console.log('All transcription benchmark contract checks passed.');
}

main();
