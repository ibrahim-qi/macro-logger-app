import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  getGenericParseFailureMessage,
  getNetworkUnreachableMessage,
  getSessionExpiredMessage,
} from '../copy/experience';
import { supabase } from '../supabaseClient';
import type { ParseMealResponse, ParseProgressStage, ParseProgressState } from '../types/mealParse';
import {
  isParseRejectionError,
  ParseRejectionError,
  type ParseErrorPayload,
  type ParseRejectionCode,
} from './parseRejection.ts';
import { getRejectionMessage } from '../copy/experience';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const PROGRESS_STAGE_ORDER: ParseProgressStage[] = [
  'transcribing',
  'identifying',
  'looking_up',
  'estimating',
];

export function advanceParseProgress(
  prev: ParseProgressState | null,
  stage: ParseProgressStage,
): ParseProgressState {
  if (!prev) {
    return { current: stage };
  }

  const prevIndex = PROGRESS_STAGE_ORDER.indexOf(prev.current);
  const nextIndex = PROGRESS_STAGE_ORDER.indexOf(stage);
  if (nextIndex < prevIndex && stage !== 'transcribing') {
    return prev;
  }

  return { current: stage };
}

const PROGRESS_STAGES = new Set<string>(['transcribing', 'identifying', 'looking_up', 'estimating']);

function isParseProgressStage(value: string): value is ParseProgressStage {
  return PROGRESS_STAGES.has(value);
}

async function readFunctionError(error: FunctionsHttpError): Promise<{
  message: string;
  code?: ParseRejectionCode;
  transcript?: string;
} | null> {
  const response = error.context as Response | undefined;
  if (!response?.json) return null;
  try {
    const payload = await response.json() as {
      error?: string;
      message?: string;
      code?: ParseRejectionCode;
      transcript?: string;
    };
    return {
      message: payload.error ?? payload.message ?? 'Failed to parse meal',
      code: payload.code,
      transcript: payload.transcript,
    };
  } catch {
    return null;
  }
}

function throwFromFunctionError(detail: {
  message: string;
  code?: ParseRejectionCode;
  transcript?: string;
}): never {
  if (detail.code) {
    throw new ParseRejectionError(detail.code, detail.transcript);
  }
  throw new Error(detail.message);
}

export function toParseErrorPayload(error: unknown): ParseErrorPayload {
  if (isParseRejectionError(error)) {
    return {
      message: getRejectionMessage(error.code),
      kind: 'rejection',
      reason: error.code,
      transcript: error.transcript,
    };
  }
  return {
    message: formatInvokeError(error),
    kind: 'failure',
  };
}

async function invokeMealFunction<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>('parse-meal', { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await readFunctionError(error);
      if (detail) throwFromFunctionError(detail);
    }
    throw error;
  }

  if (data && typeof data.error === 'string') {
    throw new Error(data.error);
  }

  return data;
}

async function readNdjsonStream(
  response: Response,
  onEvent: (event: Record<string, unknown>) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Meal parser returned an empty response');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      onEvent(JSON.parse(trimmed) as Record<string, unknown>);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    onEvent(JSON.parse(tail) as Record<string, unknown>);
  }
}

/** Voice or text parse over one connection — streams progress before macros finish. */
async function invokeParseMealStream(
  body: Record<string, unknown>,
  callbacks?: {
    onTranscript?: (transcript: string) => void;
    onProgress?: (stage: ParseProgressStage) => void;
    signal?: AbortSignal;
  },
): Promise<ParseMealResponse> {
  const accessToken = await getFreshAccessToken();
  const response = await fetch(`${supabaseUrl}/functions/v1/parse-meal`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'parse',
      stream: true,
      ...body,
    }),
    signal: callbacks?.signal,
  });

  if (!response.ok) {
    try {
      const payload = await response.json() as {
        error?: string;
        code?: ParseRejectionCode;
        transcript?: string;
      };
      if (payload.code) {
        throw new ParseRejectionError(payload.code, payload.transcript);
      }
      if (payload.error) throw new Error(payload.error);
    } catch (err) {
      if (isParseRejectionError(err) || err instanceof Error) throw err;
    }
    throw new Error('Meal parser failed. Sign in again or try in a moment.');
  }

  let parsedMeal: ParseMealResponse | undefined;
  let streamError: Error | null = null;

  await readNdjsonStream(response, (event) => {
    if (event.event === 'progress' && typeof event.stage === 'string' && isParseProgressStage(event.stage)) {
      callbacks?.onProgress?.(event.stage);
      return;
    }

    if (event.event === 'transcript' && typeof event.transcript === 'string') {
      const transcript = event.transcript.trim();
      if (transcript) callbacks?.onTranscript?.(transcript);
      return;
    }

    if (event.event === 'rejected' && typeof event.reason === 'string') {
      const reason = event.reason as ParseRejectionCode;
      const transcript = typeof event.transcript === 'string' ? event.transcript : undefined;
      streamError = new ParseRejectionError(reason, transcript);
      return;
    }

    if (event.event === 'error' && typeof event.error === 'string') {
      streamError = new Error(event.error);
      return;
    }

    if (event.event === 'result' && Array.isArray(event.items)) {
      parsedMeal = {
        items: event.items as ParseMealResponse['items'],
        notes: typeof event.notes === 'string' ? event.notes : undefined,
        transcript: typeof event.transcript === 'string' ? event.transcript : undefined,
        research_used: event.research_used === true,
        searches_run: typeof event.searches_run === 'number' ? event.searches_run : undefined,
        parse_path: event.parse_path === 'fast' || event.parse_path === 'research'
          ? event.parse_path
          : undefined,
        research_available: typeof event.research_available === 'boolean'
          ? event.research_available
          : undefined,
      };
    }
  });

  if (streamError !== null) {
    throw streamError;
  }

  if (!parsedMeal || parsedMeal.items.length === 0) {
    throw new Error('No food items were found in that description.');
  }

  return parsedMeal;
}

async function invokeParseMealPlain(body: Record<string, unknown>): Promise<ParseMealResponse> {
  const data = await invokeMealFunction<ParseMealResponse>(body);

  if (!data?.items?.length) {
    throw new Error('No food items were found in that description.');
  }

  return data;
}

export async function invokeParseMeal(
  body: {
    text?: string;
    audio?: string;
    mimeType?: string;
  },
  callbacks?: {
    onProgress?: (stage: ParseProgressStage) => void;
    signal?: AbortSignal;
  },
): Promise<ParseMealResponse> {
  if (body.text?.trim()) {
    try {
      return await invokeParseMealStream({ text: body.text.trim() }, callbacks);
    } catch (err) {
      if (isParseRejectionError(err)) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return invokeParseMealPlain({ text: body.text.trim() });
    }
  }

  const payload: Record<string, unknown> = { action: 'parse' };

  if (body.audio) {
    payload.audio = body.audio;
    payload.mimeType = body.mimeType ?? 'audio/webm';
  } else {
    throw new Error('Meal description text or audio is required.');
  }

  return invokeParseMealPlain(payload);
}

async function getFreshAccessToken(): Promise<string> {
  const { data: { session: initial }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !initial?.access_token) {
    throw new Error('Your session expired. Sign out and sign back in.');
  }

  const expiresAt = initial.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt - now > 60) {
    return initial.access_token;
  }

  const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed?.access_token) {
    throw new Error('Your session expired. Sign out and sign back in.');
  }

  return refreshed.access_token;
}

/** Voice parse over one connection — streams transcript before macros finish. */
export async function invokeParseMealVoice(
  body: { audio: string; mimeType: string },
  callbacks?: {
    onTranscript?: (transcript: string) => void;
    onProgress?: (stage: ParseProgressStage) => void;
    signal?: AbortSignal;
  },
): Promise<ParseMealResponse> {
  return invokeParseMealStream(
    {
      audio: body.audio,
      mimeType: body.mimeType ?? 'audio/webm',
    },
    callbacks,
  );
}

function formatInvokeError(error: unknown): string {
  if (isParseRejectionError(error)) {
    return getRejectionMessage(error.code);
  }
  if (!(error instanceof Error)) return getGenericParseFailureMessage();
  const msg = error.message;

  if (msg.includes('Failed to send a request to the Edge Function')) {
    return getNetworkUnreachableMessage();
  }
  if (msg.includes('Edge Function returned a non-2xx status code')) {
    return getNetworkUnreachableMessage();
  }
  if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
    return getSessionExpiredMessage();
  }
  if (msg.includes('Your session expired')) {
    return getSessionExpiredMessage();
  }
  if (msg.includes('NANOGPT_API_KEY')) {
    return 'Meal parser is not configured on the server yet.';
  }
  if (msg.includes('NanoGPT parse error') || msg.includes('NanoGPT transcription error')) {
    return getGenericParseFailureMessage();
  }
  if (/audio validation failed/i.test(msg)) {
    return 'Recording could not be processed. Hold the mic a little longer and speak clearly.';
  }
  if (msg.includes('Recording could not be processed') || msg.includes('too short or empty')) {
    return msg;
  }
  if (
    /NanoGPT|Edge Function|Parser error|\b401\b|\b403\b|\b500\b|\b502\b|\b503\b/i.test(msg)
  ) {
    return getGenericParseFailureMessage();
  }
  return msg;
}
