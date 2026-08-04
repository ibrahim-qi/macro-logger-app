/**
 * Macro parse accuracy benchmark for Sahha.
 *
 * Usage:
 *   NANOGPT_API_KEY=your_key npm run benchmark:macros
 *   npm run benchmark:macros -- --models google/gemini-3.5-flash,openai/gpt-4o-mini
 *   npm run benchmark:macros -- --case medium-banana
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BENCHMARK_CASES, type BenchmarkCase } from './dataset.ts';
import { parseMealText } from './parseClient.ts';
import { scoreCase, aggregateScores, type CaseScore } from './metrics.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  try {
    const envPath = join(__dirname, '../../.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function parseArgs(argv: string[]) {
  const models: string[] = [];
  let caseFilter: string | null = null;
  let delayMs = 800;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--models' && argv[i + 1]) {
      models.push(...argv[i + 1].split(',').map((m) => m.trim()).filter(Boolean));
      i++;
    } else if (argv[i] === '--case' && argv[i + 1]) {
      caseFilter = argv[i + 1];
      i++;
    } else if (argv[i] === '--delay' && argv[i + 1]) {
      delayMs = Number(argv[i + 1]) || 800;
      i++;
    }
  }

  return {
    models: models.length ? models : [process.env.NANOGPT_PARSE_MODEL ?? 'google/gemini-3.5-flash'],
    caseFilter,
    delayMs,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function printAggregate(agg: ReturnType<typeof aggregateScores>) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Model: ${agg.model}`);
  console.log(`Cases: ${agg.cases}`);
  console.log(`Pass rate (within difficulty band): ${(agg.passRate * 100).toFixed(0)}%`);
  console.log(`Avg calorie error: ${fmtPct(agg.avgCalorieErrorPct)} (median ${fmtPct(agg.medianCalorieErrorPct)})`);
  console.log(`Avg protein error: ${fmtPct(agg.avgProteinErrorPct)}`);
  console.log(`Avg item-match score: ${agg.avgItemMatchScore.toFixed(1)}/100`);
  for (const level of ['easy', 'medium', 'hard'] as const) {
    const d = agg.byDifficulty[level];
    if (!d.count) continue;
    console.log(`  ${level}: n=${d.count}, avg cal err ${fmtPct(d.avgCalorieErrorPct)}, pass ${(d.passRate * 100).toFixed(0)}%`);
  }
}

function printCaseDetail(score: CaseScore, testCase: BenchmarkCase) {
  const pass = score.withinBand ? 'PASS' : 'FAIL';
  console.log(`  [${pass}] ${score.id} (${score.difficulty})`);
  console.log(`       input: "${testCase.input}"`);
  console.log(`       expected ${Math.round(score.expected.calories)} kcal → got ${Math.round(score.predicted.calories)} kcal (${fmtPct(score.calorieErrorPct)} err)`);
  console.log(`       items: ${score.predictedItems.map((i) => `${i.food_name}×${i.quantity}@${i.calories}kcal`).join(', ')}`);
}

loadEnvLocal();

const { models, caseFilter, delayMs } = parseArgs(process.argv.slice(2));
const apiKey = process.env.NANOGPT_API_KEY;

if (!apiKey) {
  console.error(`
Missing NANOGPT_API_KEY.

The benchmark calls NanoGPT directly with the same prompt as parse-meal.
Get the key from Supabase secrets (same one used by the edge function):

  supabase secrets list

Then run:
  $env:NANOGPT_API_KEY="your_key"; npm run benchmark:macros

Compare models:
  $env:NANOGPT_API_KEY="your_key"; npm run benchmark:macros -- --models google/gemini-3.5-flash,openai/gpt-4o-mini
`);
  process.exit(1);
}

const cases = caseFilter
  ? BENCHMARK_CASES.filter((c) => c.id === caseFilter)
  : BENCHMARK_CASES;

if (!cases.length) {
  console.error(`No benchmark case matched "${caseFilter}"`);
  process.exit(1);
}

console.log(`Running macro benchmark on ${cases.length} case(s), ${models.length} model(s)...`);

const allResults: Array<{ aggregate: ReturnType<typeof aggregateScores>; scores: CaseScore[] }> = [];

for (const model of models) {
  const scores: CaseScore[] = [];

  for (const testCase of cases) {
    process.stdout.write(`  ${model} → ${testCase.id}... `);
    try {
      const items = await parseMealText(testCase.input, { apiKey, model });
      const score = scoreCase(testCase, items);
      scores.push(score);
      console.log(`${Math.round(score.predicted.calories)} kcal (${fmtPct(score.calorieErrorPct)} err)`);
      if (caseFilter) printCaseDetail(score, testCase);
    } catch (err) {
      console.log('ERROR');
      console.error(`    ${err instanceof Error ? err.message : err}`);
    }
    await sleep(delayMs);
  }

  const agg = aggregateScores(model, scores);
  allResults.push({ aggregate: agg, scores });
  printAggregate(agg);

  if (!caseFilter) {
    const failed = scores.filter((s) => !s.withinBand);
    if (failed.length) {
      console.log('\n  Worst cases:');
      for (const s of [...failed].sort((a, b) => b.calorieErrorPct - a.calorieErrorPct).slice(0, 3)) {
        const tc = cases.find((c) => c.id === s.id)!;
        printCaseDetail(s, tc);
      }
    }
  }
}

if (allResults.length > 1) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Model comparison (lower calorie error is better):');
  for (const { aggregate: agg } of [...allResults].sort((a, b) => a.aggregate.avgCalorieErrorPct - b.aggregate.avgCalorieErrorPct)) {
    console.log(`  ${agg.model.padEnd(32)} avg err ${fmtPct(agg.avgCalorieErrorPct).padStart(7)}  pass ${(agg.passRate * 100).toFixed(0)}%`);
  }
}

const outDir = join(__dirname, '../../benchmark-results');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = join(outDir, `macro-benchmark-${stamp}.json`);
writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), models, results: allResults }, null, 2));
console.log(`\nFull results saved to ${outPath}`);
