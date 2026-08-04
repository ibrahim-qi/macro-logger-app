import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import type { ParseMealResponse, TranscribeMealResponse } from '../types/mealParse';

async function readFunctionError(error: FunctionsHttpError): Promise<string | null> {
  const response = error.context as Response | undefined;
  if (!response?.json) return null;
  try {
    const payload = await response.json() as { error?: string; message?: string };
    return payload.error ?? payload.message ?? null;
  } catch {
    return null;
  }
}

async function invokeMealFunction<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>('parse-meal', { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await readFunctionError(error);
      if (detail) throw new Error(detail);
    }
    throw error;
  }

  if (data && typeof data.error === 'string') {
    throw new Error(data.error);
  }

  return data;
}

export async function invokeTranscribeMeal(body: { audio: string; mimeType: string }) {
  const data = await invokeMealFunction<TranscribeMealResponse>({
    ...body,
    action: 'transcribe',
  });

  const transcript = data?.transcript?.trim();
  if (!transcript) {
    throw new Error('Could not transcribe audio. Try speaking again or type your meal.');
  }

  return { transcript };
}

export async function invokeParseMeal(body: { text: string }) {
  const data = await invokeMealFunction<ParseMealResponse>({
    text: body.text.trim(),
    action: 'parse',
  });

  if (!data?.items?.length) {
    throw new Error('No food items were found in that description.');
  }

  return data;
}

export function formatInvokeError(error: unknown): string {
  if (!(error instanceof Error)) return 'Could not reach the meal parser. Try again.';
  const msg = error.message;
  if (msg.includes('Failed to send a request to the Edge Function')) {
    return 'Meal parser is unavailable. Check your connection and try again.';
  }
  if (msg.includes('Edge Function returned a non-2xx status code')) {
    return 'Meal parser failed. Sign in again or try in a moment.';
  }
  if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
    return 'Your session expired. Sign out and sign back in.';
  }
  if (msg.includes('NANOGPT_API_KEY')) {
    return 'Meal parser is not configured on the server yet.';
  }
  if (msg.includes('NanoGPT parse error') || msg.includes('NanoGPT transcription error')) {
    return msg.replace(/^NanoGPT \w+ error \(\d+\): /, 'Parser error: ');
  }
  if (/audio validation failed/i.test(msg)) {
    return 'Recording could not be processed. Hold the mic a little longer and speak clearly.';
  }
  if (msg.includes('Recording could not be processed') || msg.includes('too short or empty')) {
    return msg;
  }
  return msg;
}
