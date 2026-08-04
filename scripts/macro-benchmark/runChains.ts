/**
 * Run UK chain brand benchmark cases with timing.
 * Usage: npm run benchmark:chains
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BENCHMARK_CASES } from './dataset.ts';
import { parseMealTextRaw } from './parseClient.ts';
import { scoreCase, getItemBreakdown } from './metrics.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAIN_IDS = ['greggs-sausage-roll', 'costa-large-latte', 'pret-ham-cheese', 'big-mac'];

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
const cases = BENCHMARK_CASES.filter((c) => CHAIN_IDS.includes(c.id));

console.log(`UK chain benchmark — ${cases.length} cases, model: ${model}\n`);

const timings: number[] = [];

for (const testCase of cases) {
  const start = performance.now();
  process.stdout.write(`${testCase.id}... `);

  try {
    const result = await parseMealTextRaw(testCase.input, { apiKey, model });
    const elapsed = Math.round(performance.now() - start);
    timings.push(elapsed);

    const items = result.items;
    const score = scoreCase(testCase, items);
    const pass = score.withinBand ? 'PASS' : 'FAIL';
    const path = result.parse_path ?? 'research';
    console.log(`${pass} — ${Math.round(score.predicted.calories)} kcal (${score.calorieErrorPct.toFixed(1)}% err) — ${(elapsed / 1000).toFixed(1)}s [${path}]`);

    for (const item of items) {
      const src = (item as { source_note?: string }).source_note;
      const conf = (item as { confidence?: string }).confidence;
      if (src || conf) console.log(`       ${item.food_name}: ${item.calories} kcal, confidence ${conf}, source: ${src || 'n/a'}`);
    }

    const breakdown = getItemBreakdown(testCase, items);
    const bad = breakdown.filter((r) => !r.matched || r.calorieErrorPct > 15);
    if (bad.length) {
      for (const row of bad) {
        console.log(`       ~ ${row.expectedName}: expected ${Math.round(row.expectedLineCalories)} kcal line`);
      }
    }
  } catch (err) {
    console.log(`ERROR — ${err instanceof Error ? err.message : err}`);
  }

  console.log('');
}

if (timings.length) {
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const sorted = [...timings].sort((a, b) => a - b);
  console.log('='.repeat(50));
  console.log(`Timing: avg ${(avg / 1000).toFixed(1)}s | median ${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(1)}s | range ${(sorted[0] / 1000).toFixed(1)}–${(sorted[sorted.length - 1] / 1000).toFixed(1)}s`);
  console.log('(Includes pass 1 LLM + Serper search + pass 2 LLM)');
}
