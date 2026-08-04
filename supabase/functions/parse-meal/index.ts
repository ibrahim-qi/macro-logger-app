import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { normalizeItems, type ParsedFoodItem } from '../_shared/normalizeItems.ts';
import { applySavedFoods } from '../_shared/applySavedFoods.ts';
import { buildTranscriptionPrompt } from '../_shared/transcriptionPrompt.ts';
import { todayBoundsForTimezone } from '../_shared/dayBounds.ts';
import { assertUsableTranscript } from '../_shared/transcriptValidation.ts';
import {
  assertValidAudioPayload,
  extensionForMime,
  normalizeAudioMimeType,
  parseProviderAudioError,
} from '../_shared/audioValidation.ts';

interface ParseMealResponse {
  items: ParsedFoodItem[];
  notes?: string;
  transcript?: string;
}

const MEAL_PARSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          food_name: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fats: { type: 'number' },
          quantity: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['food_name', 'calories', 'protein', 'carbs', 'fats', 'quantity', 'confidence'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string' },
  },
  required: ['items', 'notes'],
  additionalProperties: false,
};

const SYSTEM_PROMPT_BASE = `You parse natural-language meal descriptions into structured food entries for a macro tracking app used by UK users.
Return realistic estimates for typical serving sizes when portions are vague (e.g. "large chicken breast" ≈ 180g cooked).
Split combined meals into separate items (e.g. "2 eggs and toast" -> two items).
IMPORTANT: calories, protein, carbs, and fats must be PER SINGLE UNIT/SERVING. quantity is a COUNT of discrete servings only (e.g. "2 eggs" -> quantity=2, calories=70 per egg, not 140 total; "20 scrambled eggs" -> quantity=20, calories per egg).
NEVER put grams or millilitres in quantity. For weighed or measured foods (e.g. "150g Greek yogurt", "300ml milk"), use quantity=1 and set macros for that entire portion.
Use whole numbers for calories and one decimal at most for macros when needed.
Set confidence to high when portion and food are clear, medium when estimated, low when very uncertain.
Always include notes as a short string (use an empty string if there is nothing notable).`;

function buildSystemPrompt(context?: {
  displayName?: string | null;
  goals?: { daily_calories_goal: number; daily_protein_goal: number } | null;
  todayCalories?: number;
  todayProtein?: number;
  savedFoods?: Array<{
    food_name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }>;
}): string {
  if (!context) return SYSTEM_PROMPT_BASE;

  const lines = [SYSTEM_PROMPT_BASE, '', 'User context:'];
  if (context.displayName) lines.push(`- Name: ${context.displayName.split(/\s+/)[0]}`);
  if (context.goals) {
    lines.push(`- Daily calorie target: ${context.goals.daily_calories_goal}`);
    lines.push(`- Daily protein target: ${context.goals.daily_protein_goal}g`);
  }
  if (context.todayCalories !== undefined && context.todayCalories > 0) {
    lines.push(`- Calories already logged earlier today: ${Math.round(context.todayCalories)} cal, ${Math.round(context.todayProtein ?? 0)}g protein`);
  }
  if (context.savedFoods?.length) {
    lines.push('- User saved foods (ONLY use these exact per-serving macros when they mention a matching item):');
    for (const food of context.savedFoods) {
      lines.push(
        `  • ${food.food_name}: ${Math.round(food.calories)} cal, ${food.protein}g protein, ${food.carbs}g carbs, ${food.fats}g fats per serving`,
      );
    }
  }
  lines.push('Do not copy macros from meals the user already logged today unless they appear in saved foods above. Estimate each new log independently.');

  return lines.join('\n');
}

async function loadUserParseContext(supabase: ReturnType<typeof createClient>, userId: string) {
  const profileRes = await supabase
    .from('profiles')
    .select('display_name, timezone')
    .eq('id', userId)
    .maybeSingle();

  const timeZone = profileRes.data?.timezone?.trim() || 'UTC';
  const { dayStart, dayEnd } = todayBoundsForTimezone(timeZone);

  const [goalsRes, entriesRes, savedRes] = await Promise.all([
    supabase.from('user_goals').select('daily_calories_goal, daily_protein_goal').eq('user_id', userId).maybeSingle(),
    supabase.from('food_entries').select('food_name, calories, protein, quantity').eq('user_id', userId).gte('created_at', dayStart).lte('created_at', dayEnd),
    supabase.from('saved_foods').select('food_name, calories, protein, carbs, fats').eq('user_id', userId).order('food_name').limit(12),
  ]);

  const entries = entriesRes.data ?? [];
  const totals = entries.reduce(
    (acc, entry) => {
      const q = entry.quantity || 1;
      acc.calories += (entry.calories || 0) * q;
      acc.protein += (entry.protein || 0) * q;
      return acc;
    },
    { calories: 0, protein: 0 },
  );

  return {
    displayName: profileRes.data?.display_name ?? null,
    goals: goalsRes.data ?? null,
    todayCalories: totals.calories,
    todayProtein: totals.protein,
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

async function parseWithNanoGpt(
  text: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
): Promise<ParseMealResponse> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meal_parse',
          strict: true,
          schema: MEAL_PARSE_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`NanoGPT parse error (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const rawText = payload?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('NanoGPT returned an empty parse response');
  }

  const parsed = JSON.parse(rawText) as ParseMealResponse;
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('No food items could be parsed from that description');
  }

  return {
    items: normalizeItems(parsed.items),
    notes: parsed.notes?.trim() || undefined,
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
  const transcript = assertUsableTranscript(String(payload?.text ?? ''), binary.byteLength);

  return transcript;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let config: ReturnType<typeof getNanoGptConfig>;
    try {
      config = getNanoGptConfig();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'NanoGPT is not configured';
      return new Response(JSON.stringify({ error: message }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const action = body.action === 'transcribe' ? 'transcribe' : 'parse';
    let mealText = typeof body.text === 'string' ? body.text.trim() : '';

    if (action === 'transcribe') {
      if (!body.audio || typeof body.audio !== 'string') {
        return new Response(JSON.stringify({ error: 'Audio is required for transcription' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';
      const context = await loadUserParseContext(supabase, user.id);
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

      return new Response(JSON.stringify({ transcript }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let transcript: string | undefined;

    if (body.audio && typeof body.audio === 'string') {
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';
      const context = await loadUserParseContext(supabase, user.id);
      const sttPrompt = buildTranscriptionPrompt(
        (context.savedFoods ?? []).map((food) => food.food_name),
      );
      transcript = await transcribeWithNanoGpt(
        body.audio,
        mimeType,
        config.apiKey,
        config.baseUrl,
        config.sttModel,
        sttPrompt,
      );
      mealText = transcript;
    }

    if (!mealText) {
      return new Response(JSON.stringify({ error: 'Meal description text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const context = await loadUserParseContext(supabase, user.id);
    const parsed = await parseWithNanoGpt(
      mealText,
      config.apiKey,
      config.baseUrl,
      config.parseModel,
      buildSystemPrompt(context),
    );

    const items = applySavedFoods(parsed.items, context.savedFoods ?? []);
    const result = { ...parsed, items };

    return new Response(JSON.stringify({ ...result, transcript }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse meal';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
