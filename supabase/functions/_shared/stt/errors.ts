import type { SttErrorCode } from './types.ts';

export class SttError extends Error {
  readonly code: SttErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    code: SttErrorCode,
    message: string,
    options?: { retryable?: boolean; status?: number; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'SttError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.status = options?.status;
  }
}

export function isSttError(error: unknown): error is SttError {
  return error instanceof SttError;
}
