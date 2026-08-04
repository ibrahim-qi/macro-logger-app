/**
 * Mirrors supabase/functions/parse-meal/index.ts prompt + schema.
 * Keep in sync when the edge function prompt changes.
 */

import type { ParsedItem } from './metrics.ts';
import { normalizeItems } from '../../supabase/functions/_shared/normalizeItems.ts';

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

const SYSTEM_PROMPT = `You parse natural-language meal descriptions into structured food entries for a macro tracking app used by UK users.
Return realistic estimates for typical serving sizes when portions are vague (e.g. "large chicken breast" ≈ 180g cooked).
Split combined meals into separate items (e.g. "2 eggs and toast" -> two items).
IMPORTANT: calories, protein, carbs, and fats must be PER SINGLE UNIT/SERVING. quantity is a COUNT of discrete servings only (e.g. "2 eggs" -> quantity=2, calories=70 per egg, not 140 total).
NEVER put grams or millilitres in quantity. For weighed or measured foods (e.g. "150g Greek yogurt", "300ml milk"), use quantity=1 and set macros for that entire portion.
Use whole numbers for calories and one decimal at most for macros when needed.
Set confidence to high when portion and food are clear, medium when estimated, low when very uncertain.
Always include notes as a short string (use an empty string if there is nothing notable).
When user saved food macros are provided in context, use those exact per-serving values for matching items.`;

export interface ParseConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

function parseConfidence(value: unknown): 'high' | 'medium' | 'low' | undefined {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return undefined;
}

export async function parseMealText(text: string, config: ParseConfig): Promise<ParsedItem[]> {
  const baseUrl = config.baseUrl ?? 'https://nano-gpt.com/api/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
    throw new Error(`Parse error (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const rawText = payload?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('Empty parse response');

  const parsed = JSON.parse(rawText) as { items: ParsedItem[] };
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('No items parsed');
  }

  return normalizeItems(
    parsed.items.map((item) => ({
      food_name: String(item.food_name).trim(),
      calories: Math.max(0, Number(item.calories) || 0),
      protein: Math.max(0, Number(item.protein) || 0),
      carbs: Math.max(0, Number(item.carbs) || 0),
      fats: Math.max(0, Number(item.fats) || 0),
      quantity: Math.max(0.01, Number(item.quantity) || 1),
      confidence: parseConfidence(item.confidence),
    })),
  );
}
