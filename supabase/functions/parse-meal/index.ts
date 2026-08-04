import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { type ParsedFoodItem } from '../_shared/normalizeItems.ts';
import { applySavedFoods } from '../_shared/applySavedFoods.ts';
import { buildTranscriptionPrompt } from '../_shared/transcriptionPrompt.ts';
import { assertUsableTranscript } from '../_shared/transcriptValidation.ts';
import {
  assertValidAudioPayload,
  extensionForMime,
  normalizeAudioMimeType,
  parseProviderAudioError,
} from '../_shared/audioValidation.ts';
import { parseMealWithResearch } from '../_shared/mealParseFlow.ts';
import type { ParsePromptContext } from '../_shared/mealParsePrompt.ts';

interface ParseMealResponse {
  items: ParsedFoodItem[];
  notes?: string;
  transcript?: string;
  research_used?: boolean;
  searches_run?: number;
  parse_path?: 'fast' | 'research';
  research_available?: boolean;
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
    .order('food_name')
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
    parseModel: Deno.env.get('NANOGPT_PARSE_MODEL') ?? 'google/gemini-3.5-flash',
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
  formData.append('response_format', 'json');
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

  const payload = await response.json();
  return assertUsableTranscript(String(payload?.text ?? ''), binary.byteLength);
}

async function parseMealText(
  mealText: string,
  config: NanoGptConfig,
  context: ParsePromptContext,
  onProgress?: (stage: 'identifying' | 'looking_up' | 'estimating') => void,
): Promise<ParseMealResponse> {
  const parsed = await parseMealWithResearch(
    mealText,
    { apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.parseModel },
    context,
    { onProgress },
  );

  const items = applySavedFoods(parsed.items, context.savedFoods ?? []);
  return {
    items,
    notes: parsed.notes,
    research_used: parsed.research_used,
    searches_run: parsed.searches_run,
    parse_path: parsed.parse_path,
    research_available: parsed.research_available,
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

function streamVoiceParse(
  audioBase64: string,
  mimeType: string,
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
        send({ event: 'progress', stage: 'transcribing' });

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

        send({ event: 'transcript', transcript });

        const result = await parseMealText(
          transcript,
          config,
          context,
          (stage) => send({ event: 'progress', stage }),
        );
        send({ event: 'result', ...result, transcript });
      } catch (error) {
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
    const action = body.action === 'transcribe' ? 'transcribe' : 'parse';
    const useStream = body.stream === true;
    let mealText = typeof body.text === 'string' ? body.text.trim() : '';

    if (action === 'transcribe') {
      if (!body.audio || typeof body.audio !== 'string') {
        return jsonResponse({ error: 'Audio is required for transcription' }, 400);
      }

      const context = await loadUserParseContext(supabase, user.id);
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';
      const sttPrompt = buildTranscriptionPrompt(
        (context.savedFoods ?? []).map((food) => food.food_name),
      );
      const transcript = await transcribeWithNanoGpt(
        body.audio,
        mimeType,
        config.apiKey,
        config.baseUrl,
        config.sttModel,
        sttPrompt,
      );

      return jsonResponse({ transcript });
    }

    const context = await loadUserParseContext(supabase, user.id);

    if (body.audio && typeof body.audio === 'string') {
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';

      if (useStream) {
        return streamVoiceParse(body.audio, mimeType, config, context);
      }

      const { result, transcript } = await parseVoiceMeal(body.audio, mimeType, config, context);
      return jsonResponse({ ...result, transcript });
    }

    if (!mealText) {
      return jsonResponse({ error: 'Meal description text is required' }, 400);
    }

    const result = await parseMealText(mealText, config, context);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse meal';
    return jsonResponse({ error: message }, 500);
  }
});
