export type ParseRejectionCode = 'no_speech' | 'no_meal_detected' | 'nothing_eaten';

const REJECTION_MESSAGES: Record<ParseRejectionCode, string> = {
  no_speech: 'We didn\'t catch that. Tap the mic and say what you ate.',
  no_meal_detected: 'That didn\'t sound like a meal. Try something like "two eggs and toast", or type it below.',
  nothing_eaten: 'Nothing to log this time. Come back after your next meal.',
};

export class ParseRejectionError extends Error {
  readonly code: ParseRejectionCode;
  readonly transcript?: string;
  readonly layer: number;

  constructor(code: ParseRejectionCode, transcript?: string, layer = 2) {
    super(REJECTION_MESSAGES[code]);
    this.name = 'ParseRejectionError';
    this.code = code;
    this.transcript = transcript?.trim() || undefined;
    this.layer = layer;
  }
}

export function rejectionPayload(error: ParseRejectionError) {
  return {
    error: error.message,
    code: error.code,
    transcript: error.transcript,
  };
}
