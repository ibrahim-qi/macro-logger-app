export const MIN_AUDIO_BYTES = 2048;

/** Strip codec params — APIs expect `audio/webm`, not `audio/webm;codecs=opus`. */
export function normalizeAudioMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
  if (base === 'audio/x-m4a' || base === 'audio/m4a') return 'audio/mp4';
  return base;
}

export function extensionForMime(mimeType: string): string {
  const normalized = normalizeAudioMimeType(mimeType);
  if (normalized.includes('mp4')) return 'm4a';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  return 'webm';
}

export function assertValidAudioPayload(byteLength: number): void {
  if (byteLength < MIN_AUDIO_BYTES) {
    throw new Error('Recording was too short or empty. Hold the mic and speak for at least 2 seconds.');
  }
}

export function parseProviderAudioError(status: number, detail: string): string {
  let message = detail;
  try {
    const parsed = JSON.parse(detail) as { error?: { message?: string } };
    if (parsed?.error?.message) message = parsed.error.message;
  } catch {
    // keep raw detail
  }

  if (/audio validation failed/i.test(message)) {
    return 'Recording could not be processed. Hold the mic a little longer and speak clearly.';
  }

  return `NanoGPT transcription error (${status}): ${detail}`;
}
