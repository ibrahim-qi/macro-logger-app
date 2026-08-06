import { MEAL_HINT } from '../transcriptValidation.ts';
import {
  NO_SPEECH_PROB_MEAN,
  NO_SPEECH_PROB_SEGMENT_MAX,
} from './constants.ts';
import type { SttResult } from './types.ts';

/**
 * Stage-2 no_speech_prob gate.
 * Reject when every segment is above the max threshold, or mean is high and
 * the transcript has no meal-related hint words.
 */
export function shouldRejectNoSpeechProb(result: Pick<SttResult, 'text' | 'segments' | 'noSpeechProbMax' | 'noSpeechProbMean'>): boolean {
  const segments = result.segments ?? [];
  const probs = segments
    .map((segment) => segment.noSpeechProb)
    .filter((value): value is number => typeof value === 'number');

  if (probs.length === 0) {
    return false;
  }

  const allHigh = probs.every((value) => value > NO_SPEECH_PROB_SEGMENT_MAX);
  if (allHigh) return true;

  const mean = result.noSpeechProbMean
    ?? (probs.reduce((sum, value) => sum + value, 0) / probs.length);
  if (mean > NO_SPEECH_PROB_MEAN && !MEAL_HINT.test(result.text.trim())) {
    return true;
  }

  return false;
}

export function summarizeNoSpeechProbs(segments: Array<{ noSpeechProb?: number }>): {
  max?: number;
  mean?: number;
} {
  const probs = segments
    .map((segment) => segment.noSpeechProb)
    .filter((value): value is number => typeof value === 'number');
  if (probs.length === 0) return {};
  const max = Math.max(...probs);
  const mean = probs.reduce((sum, value) => sum + value, 0) / probs.length;
  return { max, mean };
}
