/**
 * Benchmark everyday staple foods (eggs, toast, kefir, chicken).
 * Usage: npm run benchmark:staples
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BENCHMARK_CASES } from './dataset.ts';
import { parseMealTextRaw } from './parseClient.ts';
import { scoreCase, getItemBreakdown } from './metrics.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAPLE_IDS = [
  'two-boiled-eggs',
  'two-slices-sourdough',
  'plain-kefir-200ml',
  'chicken-thighs-180g',
  'two-chicken-thighs',
];

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

const apiKey = process.env.NANOGPT_API_KEY;
if (!apiKey) {
  console.error('Missing NANOGPT_API_KEY in .env.local');
  process.exit(1);
}

const model = process.env.NANOGPT_PARSE_MODEL ?? 'google/gemini-3.5-flash';
const cases = BENCHMARK_CASES.filter((c) => STAPLE_IDS.includes(c.id));

console.log(`Staple foods benchmark — ${cases.length} cases, model: ${model}\n`);

let passed = 0;

for (const testCase of cases) {
  const start = performance.now();
  process.stdout.write(`${testCase.id}... `);

  try {
    const result = await parseMealTextRaw(testCase.input, { apiKey, model });
    const elapsed = Math.round(performance.now() - start);
    const score = scoreCase(testCase, result.items);
    const pass = score.withinBand ? 'PASS' : 'FAIL';
    if (score.withinBand) passed += 1;

    const path = result.parse_path ?? 'research';
    console.log(`${pass} — ${Math.round(score.predicted.calories)} kcal (${score.calorieErrorPct.toFixed(1)}% err) — ${(elapsed / 1000).toFixed(1)}s [${path}]`);
    console.log(`       input: "${testCase.input}"`);
    console.log(`       expected ${Math.round(score.expected.calories)} kcal / ${score.expected.protein.toFixed(1)}g protein → got ${Math.round(score.predicted.calories)} kcal / ${score.predicted.protein.toFixed(1)}g protein`);

    for (const item of result.items) {
      const conf = item.confidence ?? 'n/a';
      const assumption = item.portion_assumption?.trim();
      const source = item.source_note?.trim();
      console.log(`       • ${item.food_name}×${item.quantity} @ ${item.calories} kcal — confidence: ${conf}`);
      if (assumption) console.log(`         assumption: ${assumption}`);
      if (source) console.log(`         source: ${source}`);
    }

    const breakdown = getItemBreakdown(testCase, result.items);
    const bad = breakdown.filter((r) => r.calorieErrorPct > 15);
    if (bad.length) {
      for (const row of bad) {
        console.log(`       ~ line error on "${row.expectedName}": expected ${Math.round(row.expectedLineCalories)} kcal line`);
      }
    }
  } catch (err) {
    console.log(`ERROR — ${err instanceof Error ? err.message : err}`);
  }

  console.log('');
}

console.log('='.repeat(50));
console.log(`Pass rate: ${passed}/${cases.length} (${((passed / cases.length) * 100).toFixed(0)}%)`);
