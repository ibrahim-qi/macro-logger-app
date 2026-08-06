/** Hard caps shared by client capture and server STT. */
export const MAX_RECORDING_MS = 30_000;
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024; // 3 MiB
export const DEFAULT_STT_TIMEOUT_MS = 30_000;
export const STT_MAX_ATTEMPTS = 2; // initial + one deliberate retry

/** Stage-2 no_speech_prob enforcement (see parse-guardrails-spec §A2). */
export const NO_SPEECH_PROB_SEGMENT_MAX = 0.85;
export const NO_SPEECH_PROB_MEAN = 0.6;
