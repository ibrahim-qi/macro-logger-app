import { ParseRejectionError, type ParseRejectionCode } from './parseRejection.ts';

/** Common Whisper hallucinations on silent / noisy audio (especially YouTube-style outros). */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /thank you for watching/i,
  /thanks for watching/i,
  /thanks for listening/i,
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
  /^\s*you\s*$/i,
  /^\s*(?:\.|,|!|\?)+\s*$/,
  /www\.[a-z0-9-]+\./i,
  /♪|♫|\[music\]|\[applause\]|\(music\)/i,
];

export const MEAL_HINT =
  /\b(egg|eggs|chicken|rice|toast|milk|coffee|tea|water|salad|pasta|bread|yogurt|oats|porridge|banana|apple|beef|fish|salmon|tuna|cheese|butter|soup|sandwich|burger|pizza|meal|breakfast|lunch|dinner|snack|protein|calorie|gram|ml|slice|cup|bowl|latte|ate|had|food)\b/i;

const NOTHING_EATEN_PATTERN =
  /\b(?:didn'?t|haven'?t|have not|did not|not)\s+(?:eat|eaten|had)\b|\bskipped\s+(?:breakfast|lunch|dinner)\b|\bnothing\s+(?:to log|to eat|eaten|for (?:breakfast|lunch|dinner))\b|\bi (?:ate|had) nothing\b/i;

const FILLER_TOKENS = new Set([
  'hi', 'hiya', 'hello', 'hey', 'hmm', 'mm', 'um', 'uh', 'erm', 'er', 'oh', 'okay', 'ok',
  'yeah', 'yep', 'yes', 'no', 'nah', 'thanks', 'thank', 'you', 'cheers', 'right',
  'so', 'well', 'like', 'please', 'test', 'testing', 'one', 'two', 'three', 'four',
  'check', 'mic', 'hello?', 'alright',
]);

function tokenize(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s'?-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isFillerOnly(transcript: string): boolean {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return true;
  return tokens.every((token) => FILLER_TOKENS.has(token));
}

export function isRepeatedTokenLoop(transcript: string): boolean {
  const tokens = tokenize(transcript);
  if (tokens.length < 3) return false;
  return new Set(tokens).size <= 2;
}

export function detectNothingEaten(transcript: string): boolean {
  return NOTHING_EATEN_PATTERN.test(transcript.trim());
}

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

export function evaluateTranscriptGate(transcript: string): ParseRejectionCode | null {
  const text = transcript.trim();
  if (!text) return 'no_speech';
  if (detectNothingEaten(text)) return 'nothing_eaten';
  if (isFillerOnly(text)) return 'no_speech';
  if (isRepeatedTokenLoop(text)) return 'no_speech';
  if (isLikelyHallucinatedTranscript(text)) return 'no_speech';
  return null;
}

export function assertTranscriptLooksLikeFood(transcript: string, layer = 3): string {
  const text = transcript.trim();
  const code = evaluateTranscriptGate(text);
  if (code) {
    console.log(`[guard] rejected layer=${layer} reason=${code} len=${text.length}`);
    throw new ParseRejectionError(code, text, layer);
  }
  return text;
}

export function assertUsableTranscript(transcript: string, audioBytes?: number): string {
  const text = transcript.trim();
  if (!text) {
    throw new ParseRejectionError('no_speech', undefined, 2);
  }

  if (audioBytes !== undefined && audioBytes < 4096 && text.length > 40) {
    throw new ParseRejectionError('no_speech', text, 2);
  }

  const code = evaluateTranscriptGate(text);
  if (code) {
    console.log(`[guard] rejected layer=2 reason=${code} len=${text.length}`);
    throw new ParseRejectionError(code, text, 2);
  }

  return text;
}
