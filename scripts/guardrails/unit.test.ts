import { BENCHMARK_CASES } from '../macro-benchmark/dataset.ts';
import {
  evaluateTranscriptGate,
  detectNothingEaten,
} from '../../supabase/functions/_shared/transcriptValidation.ts';
import {
  assertRecordingHasSpeech,
  assertTranscriptLooksLikeFood,
} from '../../src/utils/transcriptValidation.ts';
import { ParseRejectionError } from '../../src/utils/parseRejection.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertRejects(input: string, expected: 'no_speech' | 'nothing_eaten' | 'no_meal_detected') {
  const code = evaluateTranscriptGate(input);
  assert(code === expected, `Expected ${expected} for "${input}", got ${code ?? 'pass'}`);
  try {
    assertTranscriptLooksLikeFood(input);
    throw new Error(`assertTranscriptLooksLikeFood should reject "${input}"`);
  } catch (err) {
    assert(err instanceof ParseRejectionError, `Expected ParseRejectionError for "${input}"`);
    assert((err as ParseRejectionError).code === expected, `Wrong rejection code for "${input}"`);
  }
}

function assertPasses(input: string) {
  const code = evaluateTranscriptGate(input);
  assert(code === null, `Expected pass for "${input}", got ${code}`);
  assert(assertTranscriptLooksLikeFood(input) === input.trim(), `Normalized pass for "${input}"`);
}

const rejectCases: Array<{ input: string; code: 'no_speech' | 'nothing_eaten' }> = [
  { input: '', code: 'no_speech' },
  { input: 'Hello?', code: 'no_speech' },
  { input: 'Thank you.', code: 'no_speech' },
  { input: 'Thanks for watching!', code: 'no_speech' },
  { input: 'you', code: 'no_speech' },
  { input: 'Testing, one two three', code: 'no_speech' },
  { input: 'the the the the', code: 'no_speech' },
  { input: '...', code: 'no_speech' },
  { input: 'Okay so um', code: 'no_speech' },
  { input: "I didn't eat anything today", code: 'nothing_eaten' },
  { input: 'skipped lunch', code: 'nothing_eaten' },
  {
    input: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud',
    code: 'no_speech',
  },
];

for (const { input, code } of rejectCases) {
  assertRejects(input, code);
}

const passCases = [
  'Greggs sausage roll',
  '2 boiled eggs',
  "McDonald's Big Mac",
  'chicken and rice',
  '150g Greek yogurt with a handful of blueberries',
  'large latte',
  'beans on toast',
  'Pret ham and cheese baguette',
];

for (const input of passCases) {
  assertPasses(input);
}

for (const benchmark of BENCHMARK_CASES) {
  assertPasses(benchmark.input);
}

assert(detectNothingEaten('skipped lunch'), 'detectNothingEaten skipped lunch');
assert(!detectNothingEaten('Greggs sausage roll'), 'meal text is not nothing_eaten');

function assertAudioThrows(
  durationMs: number,
  peakLevel: number,
  byteLength?: number,
  voicedMs?: number,
) {
  let threw = false;
  try {
    assertRecordingHasSpeech(durationMs, peakLevel, byteLength, voicedMs);
  } catch {
    threw = true;
  }
  assert(
    threw,
    `Expected audio reject for duration=${durationMs} peak=${peakLevel} bytes=${byteLength ?? 'n/a'} voiced=${voicedMs ?? 'n/a'}`,
  );
}

function assertAudioPasses(
  durationMs: number,
  peakLevel: number,
  byteLength?: number,
  voicedMs?: number,
) {
  assertRecordingHasSpeech(durationMs, peakLevel, byteLength, voicedMs);
}

assertAudioThrows(500, 0.05, 3000, 400);
assertAudioThrows(1500, 0.02, 3000, 400);
assertAudioThrows(1500, 0.05, 1000, 400);
assertAudioThrows(1500, 0.05, 3000, 200);
assertAudioPasses(1500, 0.05, 3000, 400);

console.log(`All guardrails unit checks passed (${rejectCases.length} rejects, ${passCases.length + BENCHMARK_CASES.length} passes).`);
