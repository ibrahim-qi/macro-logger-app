const MIN_RECORDING_MS = 1000;
const MIN_PEAK_AUDIO_LEVEL = 0.038;
const MIN_AUDIO_BYTES = 2048;

export function normalizeAudioMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
  if (base === 'audio/x-m4a' || base === 'audio/m4a') return 'audio/mp4';
  return base;
}

export function assertRecordingHasSpeech(
  durationMs: number,
  peakLevel: number,
  byteLength?: number,
): void {
  if (durationMs < MIN_RECORDING_MS) {
    throw new Error('Recording was too short. Hold the mic and say what you ate.');
  }
  if (peakLevel < MIN_PEAK_AUDIO_LEVEL) {
    throw new Error('No speech detected. Try speaking again or type your meal.');
  }
  if (byteLength !== undefined && byteLength < MIN_AUDIO_BYTES) {
    throw new Error('Recording was too short. Hold the mic and say what you ate.');
  }
}

export { MIN_RECORDING_MS, MIN_PEAK_AUDIO_LEVEL, MIN_AUDIO_BYTES };
