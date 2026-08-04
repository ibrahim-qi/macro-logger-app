/**
 * Draft intent-gate suite (guardrails spec §C4.2).
 * Calls the real draft model over labelled inputs and asserts input_assessment
 * behaviour via the merged-flow rejection path.
 *
 * Usage: npm run guardrails:intent   (needs NANOGPT_API_KEY in .env.local)
 *
 * Gate: zero false rejections of meal cases (hard fail).
 * False accepts of garbage are logged but non-blocking.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  try {
    const content = readFileSync(join(__dirname, '../../.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const { BENCHMARK_CASES } = await import('../macro-benchmark/dataset.ts');
const { parseMealTextRaw } = await import('../macro-benchmark/parseClient.ts');
const { ParseRejectionError } = await import('../../supabase/functions/_shared/parseRejection.ts');

const apiKey = process.env.NANOGPT_API_KEY;
if (!apiKey) {
  console.error('Missing NANOGPT_API_KEY in .env.local');
  process.exit(1);
}

const model = process.env.NANOGPT_PARSE_MODEL ?? 'google/gemini-3.6-flash';

type Expected = 'meal' | 'no_food' | 'nothing_eaten';

interface IntentCase {
  input: string;
  expected: Expected;
}

const cases: IntentCase[] = [
  { input: 'hello can you hear me', expected: 'no_food' },
  { input: 'just testing the app', expected: 'no_food' },
  { input: "I'm walking to the shop now", expected: 'no_food' },
  { input: "what's the weather like", expected: 'no_food' },
  { input: 'thanks for watching, see you in the next video', expected: 'no_food' },
  { input: "I've not had anything today", expected: 'nothing_eaten' },
  { input: 'fasted all morning', expected: 'nothing_eaten' },
  ...BENCHMARK_CASES.map((c) => ({ input: c.input, expected: 'meal' as Expected })),
];

type Observed = 'meal' | 'no_meal_detected' | 'nothing_eaten' | 'error';

function expectedToObserved(expected: Expected): Observed {
  if (expected === 'meal') return 'meal';
  if (expected === 'no_food') return 'no_meal_detected';
  return 'nothing_eaten';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log(`Intent gate suite — ${cases.length} cases, model: ${model}\n`);

const matrix = new Map<string, number>();
const falseMealRejections: string[] = [];
const falseAccepts: string[] = [];
const wrongCodes: string[] = [];
const errors: string[] = [];

for (const testCase of cases) {
  const wanted = expectedToObserved(testCase.expected);
  process.stdout.write(`  [${testCase.expected}] "${testCase.input}"... `);

  let observed: Observed;
  let detail = '';
  try {
    const result = await parseMealTextRaw(testCase.input, {
      apiKey,
      model,
    });
    observed = 'meal';
    detail = `${result.items.length} item(s)`;
  } catch (err) {
    if (err instanceof ParseRejectionError || (err instanceof Error && err.name === 'ParseRejectionError')) {
      observed = (err as InstanceType<typeof ParseRejectionError>).code as Observed;
    } else {
      observed = 'error';
      detail = err instanceof Error ? err.message : String(err);
    }
  }

  const key = `${wanted} -> ${observed}`;
  matrix.set(key, (matrix.get(key) ?? 0) + 1);

  if (observed === wanted) {
    console.log(`OK${detail ? ` (${detail})` : ''}`);
  } else if (observed === 'error') {
    console.log(`ERROR — ${detail}`);
    errors.push(`"${testCase.input}": ${detail}`);
  } else if (wanted === 'meal') {
    console.log(`FALSE REJECTION — got ${observed}`);
    falseMealRejections.push(`"${testCase.input}" rejected as ${observed}`);
  } else if (observed === 'meal') {
    console.log(`false accept — parsed as meal (${detail})`);
    falseAccepts.push(`"${testCase.input}" accepted as meal`);
  } else {
    console.log(`wrong code — expected ${wanted}, got ${observed}`);
    wrongCodes.push(`"${testCase.input}": expected ${wanted}, got ${observed}`);
  }

  await sleep(200);
}

console.log(`\n${'='.repeat(60)}`);
console.log('Confusion matrix (expected -> observed):');
for (const [key, count] of [...matrix.entries()].sort()) {
  console.log(`  ${key}: ${count}`);
}

if (falseAccepts.length) {
  console.log(`\nFalse accepts (non-blocking — layer 2/3 gates and user review absorb these):`);
  for (const line of falseAccepts) console.log(`  ~ ${line}`);
}
if (wrongCodes.length) {
  console.log(`\nWrong rejection codes (non-blocking):`);
  for (const line of wrongCodes) console.log(`  ~ ${line}`);
}
if (errors.length) {
  console.log(`\nErrors (investigate):`);
  for (const line of errors) console.log(`  ! ${line}`);
}

if (falseMealRejections.length) {
  console.error(`\nGATE FAILED — meal cases rejected:`);
  for (const line of falseMealRejections) console.error(`  ✗ ${line}`);
  process.exit(1);
}

if (errors.length) {
  console.error('\nGATE FAILED — unexpected errors.');
  process.exit(1);
}

console.log('\nGate passed: zero false rejections of meal cases.');
