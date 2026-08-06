import { ParseRejectionError } from '../parseRejection.ts';
import { assertUsableTranscript } from '../transcriptValidation.ts';
import { isSttError } from './errors.ts';
import { shouldRejectNoSpeechProb } from './noSpeech.ts';
import { transcribeWithNanoGpt, type NanoGptSttConfig } from './nanoGpt.ts';
import type { SttRequest, SttResult, SttTimings } from './types.ts';

export * from './types.ts';
export * from './constants.ts';
export { SttError, isSttError } from './errors.ts';
export { shouldRejectNoSpeechProb, summarizeNoSpeechProbs } from './noSpeech.ts';
export { transcribeWithNanoGpt, type NanoGptSttConfig } from './nanoGpt.ts';

export function toSttTimings(result: SttResult, byteLength: number): SttTimings {
  return {
    stt_ms: result.latencyMs,
    stt_attempts: result.attempts,
    stt_bytes: byteLength,
    stt_provider: result.provider,
    stt_model: result.model,
  };
}

/**
 * Run provider STT, enforce no_speech_prob + transcript guardrails, return raw text.
 * Never autocorrects nutrition-critical tokens.
 */
export async function transcribeMealAudio(
  request: SttRequest,
  config: NanoGptSttConfig,
): Promise<{ result: SttResult; transcript: string; timings: SttTimings }> {
  const result = await transcribeWithNanoGpt(request, config);

  if (result.noSpeechProbMax !== undefined || result.noSpeechProbMean !== undefined) {
    console.log('[stt] no_speech_prob', {
      maxProb: result.noSpeechProbMax,
      meanProb: result.noSpeechProbMean,
      len: result.text.length,
    });
  }

  if (shouldRejectNoSpeechProb(result)) {
    throw new ParseRejectionError('no_speech', result.text.trim() || undefined, 2);
  }

  const transcript = assertUsableTranscript(result.text, request.audio.byteLength);
  return {
    result,
    transcript,
    timings: toSttTimings(result, request.audio.byteLength),
  };
}

/** Map adapter failures onto parse rejection / HTTP-facing errors. */
export function mapSttError(error: unknown): Error {
  if (error instanceof ParseRejectionError) return error;
  if (isSttError(error)) {
    if (error.code === 'no_speech' || error.code === 'too_small') {
      return new ParseRejectionError('no_speech', undefined, 1);
    }
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error('Speech recognition failed.');
}
