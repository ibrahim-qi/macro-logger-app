import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { type ParsedFoodItem } from '../_shared/normalizeItems.ts';
import { buildTranscriptionPrompt } from '../_shared/transcriptionPrompt.ts';
import { assertTranscriptLooksLikeFood, assertUsableTranscript } from '../_shared/transcriptValidation.ts';
import {
  assertValidAudioPayload,
  extensionForMime,
  normalizeAudioMimeType,
  parseProviderAudioError,
} from '../_shared/audioValidation.ts';
import { ParseRejectionError, rejectionPayload } from '../_shared/parseRejection.ts';
import { parseMealWithResearch, type ParseTimings } from '../_shared/mealParseFlow.ts';
import type { ParsePromptContext } from '../_shared/mealParsePrompt.ts';

interface ParseMealResponse {
  items: ParsedFoodItem[];
  notes?: string;
  transcript?: string;
  research_used?: boolean;
  searches_run?: number;
  parse_path?: 'fast' | 'research';
  research_available?: boolean;
  timings?: ParseTimings;
}

type NanoGptConfig = ReturnType<typeof getNanoGptConfig>;

async function loadUserParseContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<ParsePromptContext> {
  const savedRes = await supabase
    .from('saved_foods')
    .select('food_name, calories, protein, carbs, fats')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  return {
    savedFoods: (savedRes.data ?? []).map((row) => ({
      food_name: row.food_name,
      calories: row.calories ?? 0,
      protein: row.protein ?? 0,
      carbs: row.carbs ?? 0,
      fats: row.fats ?? 0,
    })),
  };
}

function getNanoGptConfig() {
  const apiKey = Deno.env.get('NANOGPT_API_KEY');
  if (!apiKey) {
    throw new Error('NANOGPT_API_KEY is not configured');
  }

  return {
    apiKey,
    baseUrl: Deno.env.get('NANOGPT_BASE_URL') ?? 'https://nano-gpt.com/api/v1',
    sttModel: Deno.env.get('NANOGPT_STT_MODEL') ?? 'Whisper-Large-V3',
    parseModel: Deno.env.get('NANOGPT_PARSE_MODEL') ?? 'google/gemini-3.6-flash',
    interpretationModel: Deno.env.get('NANOGPT_INTERPRETATION_MODEL') || undefined,
    extractionModel:
      Deno.env.get('NANOGPT_EXTRACTION_MODEL') ??
      'google/gemini-3.5-flash-lite',
    fallbackModel: Deno.env.get('NANOGPT_FALLBACK_MODEL') || undefined,
  };
}

async function transcribeWithNanoGpt(
  audioBase64: string,
  mimeType: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt?: string,
): Promise<string> {
  const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  assertValidAudioPayload(binary.byteLength);

  const normalizedMime = normalizeAudioMimeType(mimeType);
  const extension = extensionForMime(normalizedMime);

  const formData = new FormData();
  formData.append('file', new Blob([binary], { type: normalizedMime }), `recording.${extension}`);
  formData.append('model', model);
  formData.append('language', 'en');
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');
  if (prompt?.trim()) {
    formData.append('prompt', prompt.trim());
  }

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(parseProviderAudioError(response.status, detail));
  }

  const payload = await response.json() as {
    text?: string;
    segments?: Array<{ no_speech_prob?: number }>;
  };

  const segments = payload.segments ?? [];
  if (segments.length > 0) {
    const probs = segments
      .map((segment) => segment.no_speech_prob)
      .filter((value): value is number => typeof value === 'number');
    if (probs.length > 0) {
      const maxProb = Math.max(...probs);
      const meanProb = probs.reduce((sum, value) => sum + value, 0) / probs.length;
      console.log('[stt] no_speech_prob', { maxProb, meanProb, len: String(payload.text ?? '').length });
    }
  }

  return assertUsableTranscript(String(payload.text ?? ''), binary.byteLength);
}

async function parseMealText(
  mealText: string,
  config: NanoGptConfig,
  context: ParsePromptContext,
  onProgress?: (stage: 'identifying' | 'looking_up' | 'estimating') => void,
): Promise<ParseMealResponse> {
  const trimmed = assertTranscriptLooksLikeFood(mealText, 3);

  const parsed = await parseMealWithResearch(
    trimmed,
    {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.parseModel,
      interpretationModel: config.interpretationModel,
      extractionModel: config.extractionModel,
      fallbackModel: config.fallbackModel,
    },
    context,
    { onProgress },
  );

  return {
    items: parsed.items,
    notes: parsed.notes,
    research_used: parsed.research_used,
    searches_run: parsed.searches_run,
    parse_path: parsed.parse_path,
    research_available: parsed.research_available,
    timings: parsed.timings,
  };
}

async function parseVoiceMeal(
  audioBase64: string,
  mimeType: string,
  config: NanoGptConfig,
  context: ParsePromptContext,
): Promise<{ result: ParseMealResponse; transcript: string }> {
  const savedNames = (context.savedFoods ?? []).map((food) => food.food_name);
  const sttPrompt = buildTranscriptionPrompt(savedNames);
  const transcript = await transcribeWithNanoGpt(
    audioBase64,
    mimeType,
    config.apiKey,
    config.baseUrl,
    config.sttModel,
    sttPrompt,
  );

  const result = await parseMealText(transcript, config, context);
  return { result, transcript };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface StreamParseInput {
  audio?: string;
  mimeType?: string;
  text?: string;
}

function streamParse(
  input: StreamParseInput,
  config: NanoGptConfig,
  context: ParsePromptContext,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        let transcript: string | undefined;

        if (input.audio) {
          send({ event: 'progress', stage: 'transcribing' });

          const sttStartedAt = performance.now();
          const audioBytes = Math.floor((input.audio.length * 3) / 4);
          const savedNames = (context.savedFoods ?? []).map((food) => food.food_name);
          const sttPrompt = buildTranscriptionPrompt(savedNames);
          transcript = await transcribeWithNanoGpt(
            input.audio,
            input.mimeType ?? 'audio/webm',
            config.apiKey,
            config.baseUrl,
            config.sttModel,
            sttPrompt,
          );
          console.log('[stt] timing', {
            ms: Math.round(performance.now() - sttStartedAt),
            bytes: audioBytes,
          });

          send({ event: 'transcript', transcript });
        } else if (input.text) {
          transcript = input.text;
        } else {
          throw new Error('Meal description text or audio is required.');
        }

        const result = await parseMealText(
          transcript,
          config,
          context,
          (stage) => send({ event: 'progress', stage }),
        );
        send({ event: 'result', ...result, transcript });
      } catch (error) {
        if (error instanceof ParseRejectionError) {
          send({
            event: 'rejected',
            reason: error.code,
            transcript: error.transcript,
            error: error.message,
          });
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to parse meal';
        send({ event: 'error', error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let config: NanoGptConfig;
    try {
      config = getNanoGptConfig();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'NanoGPT is not configured';
      return jsonResponse({ error: message }, 503);
    }

    const body = await req.json();
    const useStream = body.stream === true;
    const mealText = typeof body.text === 'string' ? body.text.trim() : '';

    const context = await loadUserParseContext(supabase, user.id);

    if (body.audio && typeof body.audio === 'string') {
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';

      if (useStream) {
        return streamParse({ audio: body.audio, mimeType }, config, context);
      }

      const { result, transcript } = await parseVoiceMeal(body.audio, mimeType, config, context);
      return jsonResponse({ ...result, transcript });
    }

    if (!mealText) {
      return jsonResponse({ error: 'Meal description text is required' }, 400);
    }

    if (useStream) {
      return streamParse({ text: mealText }, config, context);
    }

    const result = await parseMealText(mealText, config, context);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof ParseRejectionError) {
      return jsonResponse(rejectionPayload(error), 422);
    }
    const message = error instanceof Error ? error.message : 'Failed to parse meal';
    return jsonResponse({ error: message }, 500);
  }
});
