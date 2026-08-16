import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { type ParsedFoodItem } from '../_shared/normalizeItems.ts';
import { buildTranscriptionPrompt } from '../_shared/transcriptionPrompt.ts';
import { assertTranscriptLooksLikeFood } from '../_shared/transcriptValidation.ts';
import {
  normalizeAudioMimeType,
} from '../_shared/audioValidation.ts';
import { ParseRejectionError, rejectionPayload } from '../_shared/parseRejection.ts';
import { parseMealWithResearch, type ParseTimings } from '../_shared/mealParseFlow.ts';
import type { ParsePromptContext } from '../_shared/mealParsePrompt.ts';
import {
  mapSttError,
  transcribeMealAudio,
  type SttTimings,
} from '../_shared/stt/index.ts';

interface ParseMealResponse {
  items: ParsedFoodItem[];
  notes?: string;
  transcript?: string;
  research_used?: boolean;
  searches_run?: number;
  parse_path?: 'fast' | 'research';
  research_available?: boolean;
  timings?: ParseTimings & Partial<SttTimings>;
}

type NanoGptConfig = ReturnType<typeof getNanoGptConfig>;

interface VoiceAudioInput {
  bytes: Uint8Array;
  mimeType: string;
  byteLength: number;
}

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
    // gpt-4o-mini-transcribe: lower Done→transcript latency than Whisper-Large-V3 on NanoGPT;
    // override with NANOGPT_STT_MODEL=Whisper-Large-V3 if needed.
    sttModel: Deno.env.get('NANOGPT_STT_MODEL') ?? 'gpt-4o-mini-transcribe',
    parseModel: Deno.env.get('NANOGPT_PARSE_MODEL') ?? 'google/gemini-3.6-flash',
    // Reasoning model for interpretation — the "brain" that turns a transcript
    // into structured items. Override with NANOGPT_INTERPRETATION_MODEL.
    interpretationModel: Deno.env.get('NANOGPT_INTERPRETATION_MODEL') ?? 'openai/gpt-5.6-terra',
    extractionModel:
      Deno.env.get('NANOGPT_EXTRACTION_MODEL') ??
      'google/gemini-3.5-flash-lite',
    fallbackModel: Deno.env.get('NANOGPT_FALLBACK_MODEL') || undefined,
  };
}

function decodeBase64Audio(audioBase64: string, mimeType: string): VoiceAudioInput {
  const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  return {
    bytes,
    mimeType: normalizeAudioMimeType(mimeType),
    byteLength: bytes.byteLength,
  };
}

/** Prefer saved-food prompt when context is ready; don't stall STT on a slow DB. */
const STT_CONTEXT_WAIT_MS = 150;

function emptyParseContext(): ParsePromptContext {
  return { savedFoods: [] };
}

async function resolveSttContext(
  contextPromise: Promise<ParsePromptContext>,
): Promise<ParsePromptContext> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<ParsePromptContext>((resolve) => {
    timer = setTimeout(() => {
      console.log('[stt] context_wait_timeout', { ms: STT_CONTEXT_WAIT_MS });
      resolve(emptyParseContext());
    }, STT_CONTEXT_WAIT_MS);
  });

  try {
    return await Promise.race([contextPromise, timedOut]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function runStt(
  audio: VoiceAudioInput,
  config: NanoGptConfig,
  context: ParsePromptContext,
): Promise<{ transcript: string; timings: SttTimings }> {
  const savedNames = (context.savedFoods ?? []).map((food) => food.food_name);
  const prompt = buildTranscriptionPrompt(savedNames);

  try {
    const { transcript, timings } = await transcribeMealAudio(
      {
        audio: {
          bytes: audio.bytes,
          mimeType: audio.mimeType,
          byteLength: audio.byteLength,
        },
        language: 'en',
        prompt,
        model: config.sttModel,
      },
      {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.sttModel,
      },
    );

    console.log('[stt] timing', {
      ms: timings.stt_ms,
      bytes: timings.stt_bytes,
      attempts: timings.stt_attempts,
      provider: timings.stt_provider,
      model: timings.stt_model,
    });

    return { transcript, timings };
  } catch (error) {
    throw mapSttError(error);
  }
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
  audio: VoiceAudioInput,
  config: NanoGptConfig,
  context: ParsePromptContext,
): Promise<{ result: ParseMealResponse; transcript: string }> {
  const { transcript, timings } = await runStt(audio, config, context);
  const result = await parseMealText(transcript, config, context);
  return {
    result: {
      ...result,
      timings: result.timings ? { ...result.timings, ...timings } : timings,
    },
    transcript,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface StreamParseInput {
  audio?: VoiceAudioInput;
  text?: string;
}

function streamParse(
  input: StreamParseInput,
  config: NanoGptConfig,
  contextPromise: Promise<ParsePromptContext>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        let transcript: string | undefined;
        let sttTimings: SttTimings | undefined;

        if (input.audio) {
          // Flush progress immediately — do not wait on saved_foods before first byte.
          send({ event: 'progress', stage: 'transcribing' });
          const sttContext = await resolveSttContext(contextPromise);
          const stt = await runStt(input.audio, config, sttContext);
          transcript = stt.transcript;
          sttTimings = stt.timings;
          send({
            event: 'transcript',
            transcript,
            timings: sttTimings,
          });
        } else if (input.text) {
          transcript = input.text;
        } else {
          throw new Error('Meal description text or audio is required.');
        }

        // Parse always waits for full saved-foods context (macros path).
        const context = await contextPromise;
        const result = await parseMealText(
          transcript,
          config,
          context,
          (stage) => send({ event: 'progress', stage }),
        );
        send({
          event: 'result',
          ...result,
          transcript,
          timings: result.timings
            ? { ...result.timings, ...(sttTimings ?? {}) }
            : sttTimings,
        });
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

async function readRequestBody(req: Request): Promise<{
  useStream: boolean;
  mealText: string;
  audio?: VoiceAudioInput;
}> {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const useStream = String(form.get('stream') ?? '') === 'true';
    const mealText = String(form.get('text') ?? '').trim();
    const audioEntry = form.get('audio');

    if (audioEntry instanceof File) {
      const buffer = new Uint8Array(await audioEntry.arrayBuffer());
      const mimeType = normalizeAudioMimeType(
        String(form.get('mimeType') ?? audioEntry.type ?? 'audio/webm'),
      );
      return {
        useStream,
        mealText,
        audio: {
          bytes: buffer,
          mimeType,
          byteLength: buffer.byteLength,
        },
      };
    }

    return { useStream, mealText };
  }

  const body = await req.json() as {
    stream?: boolean;
    text?: string;
    audio?: string;
    mimeType?: string;
  };
  const useStream = body.stream === true;
  const mealText = typeof body.text === 'string' ? body.text.trim() : '';

  if (body.audio && typeof body.audio === 'string') {
    return {
      useStream,
      mealText,
      audio: decodeBase64Audio(
        body.audio,
        typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm',
      ),
    };
  }

  return { useStream, mealText };
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

    const { useStream, mealText, audio } = await readRequestBody(req);
    // Kick off saved_foods fetch immediately; streaming voice must not await it first.
    const contextPromise = loadUserParseContext(supabase, user.id);

    if (audio) {
      if (useStream) {
        return streamParse({ audio }, config, contextPromise);
      }

      const context = await contextPromise;
      const { result, transcript } = await parseVoiceMeal(audio, config, context);
      return jsonResponse({ ...result, transcript });
    }

    if (!mealText) {
      return jsonResponse({ error: 'Meal description text is required' }, 400);
    }

    if (useStream) {
      return streamParse({ text: mealText }, config, contextPromise);
    }

    const context = await contextPromise;
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
