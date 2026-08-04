/** Common Whisper hallucinations on silent / noisy audio (especially YouTube-style outros). */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /thank you for watching/i,
  /thanks for watching/i,
  /please post them in the comments/i,
  /post them in the comments/i,
  /leave a comment/i,
  /like and subscribe/i,
  /subscribe to (the )?channel/i,
  /this video is sponsored/i,
  /sponsored by/i,
  /u\.?\s*s\.?\s*department of health/i,
  /registered tmc/i,
  /if you have any questions or other problems/i,
  /transcribed by/i,
  /subtitles by/i,
  /amara\.org/i,
  /copyright/i,
  /all rights reserved/i,
  /please subscribe/i,
  /hit the bell/i,
  /see you in the next/i,
  /watch more videos/i,
];

const MEAL_HINT =
  /\b(egg|eggs|chicken|rice|toast|milk|coffee|tea|water|salad|pasta|bread|yogurt|oats|porridge|banana|apple|beef|fish|salmon|tuna|cheese|butter|soup|sandwich|burger|pizza|meal|breakfast|lunch|dinner|snack|protein|calorie|gram|ml|slice|cup|bowl|latte|ate|had|food)\b/i;

export function isLikelyHallucinatedTranscript(transcript: string): boolean {
  const text = transcript.trim();
  if (!text) return true;

  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  // Long generic monologue with no meal-related words at all.
  if (text.length > 120 && !MEAL_HINT.test(text)) {
    return true;
  }

  return false;
}

export function assertUsableTranscript(transcript: string, audioBytes?: number): string {
  const text = transcript.trim();
  if (!text) {
    throw new Error('No speech detected. Try speaking again or type your meal.');
  }

  if (audioBytes !== undefined && audioBytes < 4096 && text.length > 40) {
    throw new Error('No speech detected. Try speaking again or type your meal.');
  }

  if (isLikelyHallucinatedTranscript(text)) {
    throw new Error('No speech detected. Try speaking again or type your meal.');
  }

  return text;
}
