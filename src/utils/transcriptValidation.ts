import { getNoSpeechMessage } from '../copy/experience';
import { evaluateTranscriptGate } from '../../supabase/functions/_shared/transcriptValidation.ts';
import { MAX_AUDIO_BYTES } from '../../supabase/functions/_shared/stt/constants.ts';
import { ParseRejectionError } from './parseRejection.ts';

const MIN_RECORDING_MS = 1000;
const MIN_PEAK_AUDIO_LEVEL = 0.038;
const MIN_AUDIO_BYTES = 2048;
const MIN_VOICED_MS = 350;

export function normalizeAudioMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
  if (base === 'audio/x-m4a' || base === 'audio/m4a') return 'audio/mp4';
  return base;
}

export function assertRecordingHasSpeech(
  durationMs: number,
  peakLevel: number,
  byteLength?: number,
  voicedMs?: number,
): void {
  if (durationMs < MIN_RECORDING_MS) {
    throw new Error('Recording was too short. Hold the mic and say what you ate.');
  }
  if (voicedMs !== undefined && voicedMs < MIN_VOICED_MS) {
    throw new Error(getNoSpeechMessage());
  }
  if (peakLevel < MIN_PEAK_AUDIO_LEVEL) {
    throw new Error(getNoSpeechMessage());
  }
  if (byteLength !== undefined && byteLength < MIN_AUDIO_BYTES) {
    throw new Error('Recording was too short. Hold the mic and say what you ate.');
  }
  if (byteLength !== undefined && byteLength > MAX_AUDIO_BYTES) {
    throw new Error('Recording is too large. Keep it under 30 seconds and try again.');
  }
}

export function assertTranscriptLooksLikeFood(transcript: string): string {
  const text = transcript.trim();
  const code = evaluateTranscriptGate(text);
  if (code) {
    throw new ParseRejectionError(code, text);
  }
  return text;
}

