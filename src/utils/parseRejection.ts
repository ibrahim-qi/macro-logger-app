export type ParseRejectionCode = 'no_speech' | 'no_meal_detected' | 'nothing_eaten';

export type ParseErrorKind = 'rejection' | 'failure';

export interface ParseErrorPayload {
  message: string;
  kind: ParseErrorKind;
  reason?: ParseRejectionCode;
  transcript?: string;
}

export class ParseRejectionError extends Error {
  readonly code: ParseRejectionCode;
  readonly transcript?: string;

  constructor(code: ParseRejectionCode, transcript?: string) {
    super(code);
    this.name = 'ParseRejectionError';
    this.code = code;
    this.transcript = transcript?.trim() || undefined;
  }
}

export function isParseRejectionError(error: unknown): error is ParseRejectionError {
  return error instanceof ParseRejectionError;
}
