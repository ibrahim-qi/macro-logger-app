/**
 * Macro parse accuracy benchmark for Sahha.
 *
 * Usage:
 *   NANOGPT_API_KEY=your_key npm run benchmark:macros
 *   npm run benchmark:macros -- --models google/gemini-3.5-flash,openai/gpt-4o-mini
 *   npm run benchmark:macros -- --case medium-banana
 *   npm run benchmark:macros -- --compare-sanitize
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BENCHMARK_CASES, type BenchmarkCase } from './dataset.ts';
import { parseMealText, parseMealTextRaw, postProcessParsedItems } from './parseClient.ts';
import { scoreCase, aggregateScores, getItemBreakdown, type CaseScore } from './metrics.ts';

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

function parseArgs(argv: string[]) {
  const models: string[] = [];
  let caseFilter: string | null = null;
  let delayMs = 800;
  let compareSanitize = false;
  let noSanitize = false;

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
    } else if (argv[i] === '--compare-sanitize') {
      compareSanitize = true;
    } else if (argv[i] === '--no-sanitize') {
      noSanitize = true;
    }
  }

  return {
    models: models.length ? models : [process.env.NANOGPT_PARSE_MODEL ?? 'google/gemini-3.5-flash'],
    caseFilter,
    delayMs,
    compareSanitize,
    noSanitize,
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
  console.log(
    `       expected ${Math.round(score.expected.calories)} kcal / ${score.expected.protein.toFixed(1)}g protein → got ${Math.round(score.predicted.calories)} kcal / ${score.predicted.protein.toFixed(1)}g protein`,
  );
  console.log(`       cal err ${fmtPct(score.calorieErrorPct)}, protein err ${fmtPct(score.proteinErrorPct)}`);
  console.log(`       items: ${score.predictedItems.map((i) => `${i.food_name}×${i.quantity}@${i.calories}kcal`).join(', ')}`);

  const breakdown = getItemBreakdown(testCase, score.predictedItems);
  if (breakdown.some((row) => !row.matched || row.calorieErrorPct > 15)) {
    console.log('       per-item:');
    for (const row of breakdown) {
      if (!row.matched) {
        console.log(`         ✗ ${row.expectedName}: missing (expected ${Math.round(row.expectedLineCalories)} kcal line)`);
        continue;
      }
      const mark = row.calorieErrorPct <= 15 ? '✓' : '~';
      console.log(
        `         ${mark} ${row.expectedName}: expected ${Math.round(row.expectedLineCalories)} → got ${Math.round(row.predictedLineCalories)} kcal (${fmtPct(row.calorieErrorPct)} err) as "${row.predictedName}"`,
      );
    }
  }
}

async function runSanitizeComparison(
  model: string,
  cases: BenchmarkCase[],
  apiKey: string,
  delayMs: number,
) {
  const withScores: CaseScore[] = [];
  const withoutScores: CaseScore[] = [];

  for (const testCase of cases) {
    process.stdout.write(`  ${model} → ${testCase.id}... `);
    try {
      const raw = await parseMealTextRaw(testCase.input, { apiKey, model });
      const withItems = postProcessParsedItems(raw, true);
      const withoutItems = postProcessParsedItems(raw, false);
      withScores.push(scoreCase(testCase, withItems));
      withoutScores.push(scoreCase(testCase, withoutItems));
      const on = withScores[withScores.length - 1];
      const off = withoutScores[withoutScores.length - 1];
      const delta = off.calorieErrorPct - on.calorieErrorPct;
      console.log(
        `ON ${fmtPct(on.calorieErrorPct)} / OFF ${fmtPct(off.calorieErrorPct)} (Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`,
      );
    } catch (err) {
      console.log('ERROR');
      console.error(`    ${err instanceof Error ? err.message : err}`);
    }
    await sleep(delayMs);
  }

  const withAgg = aggregateScores(`${model} (sanitize ON)`, withScores);
  const withoutAgg = aggregateScores(`${model} (sanitize OFF)`, withoutScores);
  printAggregate(withAgg);
  printAggregate(withoutAgg);

  console.log(`\n--- Per-case delta (positive = sanitize helped) ---`);
  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const withScore = withScores[i];
    const withoutScore = withoutScores[i];
    if (!withScore || !withoutScore) continue;
    const delta = withoutScore.calorieErrorPct - withScore.calorieErrorPct;
    const marker = delta > 5 ? 'sanitize wins' : delta < -5 ? 'raw wins' : 'similar';
    console.log(
      `  ${tc.id.padEnd(22)} ON ${fmtPct(withScore.calorieErrorPct).padStart(6)}  OFF ${fmtPct(withoutScore.calorieErrorPct).padStart(6)}  Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%  [${marker}]`,
    );
  }

  return [
    { aggregate: withAgg, scores: withScores },
    { aggregate: withoutAgg, scores: withoutScores },
  ];
}

loadEnvLocal();

const { models, caseFilter, delayMs, compareSanitize, noSanitize } = parseArgs(process.argv.slice(2));
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
if (compareSanitize) console.log('Mode: compare sanitizeQuantity ON vs OFF (same raw model output per case)');

const allResults: Array<{ aggregate: ReturnType<typeof aggregateScores>; scores: CaseScore[] }> = [];

for (const model of models) {
  if (compareSanitize) {
    console.log(`\n--- ${model}: sanitize ON vs OFF ---`);
    const results = await runSanitizeComparison(model, cases, apiKey, delayMs);
    allResults.push(...results);
    continue;
  }

  const scores: CaseScore[] = [];
  for (const testCase of cases) {
    process.stdout.write(`  ${model} → ${testCase.id}... `);
    try {
      const items = await parseMealText(testCase.input, { apiKey, model, sanitizeQuantity: !noSanitize });
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
