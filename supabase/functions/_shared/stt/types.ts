/** Provider-neutral speech-to-text contract used by Edge STT adapters and offline benchmarks. */

export type SttErrorCode =
  | 'no_speech'
  | 'timeout'
  | 'provider_error'
  | 'unsupported_audio'
  | 'too_large'
  | 'too_small'
  | 'invalid_request';

export interface SttAudioBytes {
  bytes: Uint8Array;
  mimeType: string;
  /** Original encoded size in bytes (before any decode). */
  byteLength: number;
}

export interface SttRequest {
  audio: SttAudioBytes;
  language?: string;
  /** Whisper-style vocabulary prompt; never rewrite the transcript with this. */
  prompt?: string;
  model?: string;
  /** Per-attempt timeout in ms. */
  timeoutMs?: number;
}

export interface SttSegment {
  text?: string;
  noSpeechProb?: number;
  start?: number;
  end?: number;
}

export interface SttResult {
  text: string;
  segments?: SttSegment[];
  /** Max segment no_speech_prob when available. */
  noSpeechProbMax?: number;
  /** Mean segment no_speech_prob when available. */
  noSpeechProbMean?: number;
  durationMs?: number;
  provider: string;
  model: string;
  /** Wall-clock STT call latency including retries. */
  latencyMs: number;
  attempts: number;
}

export interface SttTimings {
  stt_ms: number;
  stt_attempts: number;
  stt_bytes: number;
  stt_provider: string;
  stt_model: string;
}
