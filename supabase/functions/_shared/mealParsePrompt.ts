/** Shared prompts + JSON schemas for research-augmented meal parsing. Keep benchmark client in sync. */

export const PARSE_TEMPERATURE = 0;

/** Pass 1: structure + uncertainty + search queries (no macros). */
export const MEAL_INTERPRET_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          food_name: { type: 'string' },
          quantity: { type: 'number' },
          portion_description: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          search_queries: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['food_name', 'quantity', 'portion_description', 'confidence', 'search_queries'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string' },
  },
  required: ['items', 'notes'],
  additionalProperties: false,
};

/** Pass 2: final macros with assumptions and sources. */
export const MEAL_PARSE_SCHEMA = {
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
          portion_assumption: { type: 'string' },
          source_note: { type: 'string' },
        },
        required: [
          'food_name',
          'calories',
          'protein',
          'carbs',
          'fats',
          'quantity',
          'confidence',
          'portion_assumption',
          'source_note',
        ],
        additionalProperties: false,
      },
    },
    notes: { type: 'string' },
  },
  required: ['items', 'notes'],
  additionalProperties: false,
};

export const INTERPRET_SYSTEM_PROMPT = `You interpret natural-language meal descriptions for a UK macro tracking app.

Your job is ONLY to identify foods, counts, and what was explicitly stated — do NOT estimate calories or macros.

UK-only context. Never reference US databases or US portion standards.

Rules:
1. Split combined meals into separate items (include spreads, sauces, butter, drinks).
2. quantity is a COUNT of servings ("two eggs" → quantity 2). Match spoken numbers exactly.
3. Never put grams or millilitres in quantity — describe weight/volume in portion_description instead.
4. portion_description: ONLY what the user actually said about size (e.g. "150g", "large", "handful"). Do not invent missing details.
5. Do NOT assume unspecified variants. These require confidence medium or low AND search_queries:
   - Greek yogurt / yogurt without 0%, fat-free, or full-fat stated
   - Milk without semi-skimmed, skimmed, or whole stated
   - Coffee/drink size without small/medium/large stated
   - "Handful", "some", "bowl", "large" without further detail
   - Any branded item where exact product line matters
6. confidence:
   - high: food clear AND count/weight/volume fully explicit (e.g. "2 boiled eggs", "150g chicken breast")
   - medium: food clear but portion language vague OR one unspecified variant
   - low: branded/packaged verification needed OR multiple unspecified details
7. search_queries: 0–2 UK-targeted queries per item whenever confidence is not high.
   - Always include "UK" or target site:.co.uk / NHS / CoFID / official brand UK pages.
   - Examples: "Greek yogurt 150g calories UK CoFID", "McDonald's Big Mac nutrition UK official"
   - Empty [] ONLY when confidence is high and nothing material is unspecified.
8. notes: flag any unspecified variants the user did not mention (empty string if none).`;

export const ESTIMATE_SYSTEM_PROMPT_BASE = `You estimate per-unit nutrition for a UK macro tracking app.

UK sources ONLY. Never use USDA, US government data, or US nutrition labels.

Allowed evidence (in order):
1. Web research results provided (prefer .co.uk, NHS, CoFID, McCance & Widdowson, official UK brand sites, Tesco/Sainsbury's/M&S nutrition)
2. User's explicit input (grams, ml, counts they stated)
3. User saved foods when provided

Rules:
1. calories, protein, carbs, fats are PER SINGLE UNIT — never meal totals.
2. quantity is already set — keep it exactly as given in the interpreted structure.
3. Never put grams or millilitres in quantity. Put stated weight/volume in food_name when relevant.
4. Do NOT silently assume product variants the user did not specify (yogurt fat %, milk type, bread type, coffee size). If unspecified:
   - Prefer UK web research to resolve; OR
   - Set confidence low, state exactly what was not specified in portion_assumption, and use the most conservative UK-aligned estimate you can support from research.
5. Never cite USDA or US sources in source_note. If research only returns US data, ignore it and say "UK data not found in research".
6. confidence high ONLY when portion and macros are fully specified by the user or confirmed by UK research/saved foods.
7. Whole numbers for calories; one decimal max for macros.
8. portion_assumption: state only what was inferred beyond the user's words. If something was unspecified, say so explicitly (e.g. "fat % not stated — used 0% from NHS/CoFID lookup"). Empty string only if fully specified.
9. source_note: UK source used (e.g. "McDonald's UK nutrition", "NHS", "CoFID", "Tesco UK") or "estimated — UK research unavailable" or "user saved food". Never USDA.
10. notes: meal-level conflicts or missing UK data (empty string if none).`;

export interface ParsePromptContext {
  savedFoods?: Array<{
    food_name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }>;
}

export function buildInterpretSystemPrompt(context?: ParsePromptContext): string {
  const lines = [INTERPRET_SYSTEM_PROMPT];
  if (context?.savedFoods?.length) {
    lines.push('', 'User saved food names (for matching only — do not invent macros for these):');
    for (const food of context.savedFoods) {
      lines.push(`  • ${food.food_name}`);
    }
  }
  return lines.join('\n');
}

export function buildEstimateSystemPrompt(context?: ParsePromptContext): string {
  if (!context?.savedFoods?.length) return ESTIMATE_SYSTEM_PROMPT_BASE;

  const lines = [
    ESTIMATE_SYSTEM_PROMPT_BASE,
    '',
    '11. User saved foods below — when an item matches one, copy its food_name EXACTLY and use its per-serving macros with confidence high:',
  ];
  for (const food of context.savedFoods) {
    lines.push(
      `  • ${food.food_name}: ${Math.round(food.calories)} cal, ${food.protein}g protein, ${food.carbs}g carbs, ${food.fats}g fats`,
    );
  }
  return lines.join('\n');
}

export interface InterpretedItem {
  food_name: string;
  quantity: number;
  portion_description: string;
  confidence: 'high' | 'medium' | 'low';
  search_queries: string[];
}

export interface InterpretResult {
  items: InterpretedItem[];
  notes: string;
}

export function buildEstimateUserMessage(
  mealText: string,
  interpreted: InterpretResult,
  researchBlock: string,
): string {
  const researchSection = researchBlock
    ? `${researchBlock}\n\nUse only UK sources from the research above. Ignore US/USDA results.`
    : 'Web research: none returned. Do not use US sources. Set confidence low for any item with unspecified variants and explain what was missing in portion_assumption.';

  return [
    `Original meal description:\n${mealText}`,
    '',
    'Interpreted structure (keep quantity for each item):',
    JSON.stringify(interpreted.items, null, 2),
    interpreted.notes ? `\nInterpretation notes: ${interpreted.notes}` : '',
    '',
    researchSection,
  ].join('\n');
}
