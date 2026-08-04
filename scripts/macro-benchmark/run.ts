/**
 * Macro parse accuracy benchmark for Sahha.
 *
 * Usage:
 *   NANOGPT_API_KEY=your_key npm run benchmark:macros
 *   npm run benchmark:macros -- --models google/gemini-3.6-flash,openai/gpt-4o-mini
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
    models: models.length ? models : [process.env.NANOGPT_PARSE_MODEL ?? 'google/gemini-3.6-flash'],
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
  console.log(`Pass rate (nutrition + structure): ${(agg.passRate * 100).toFixed(0)}%`);
  console.log(`Avg calorie error: ${fmtPct(agg.avgCalorieErrorPct)} (median ${fmtPct(agg.medianCalorieErrorPct)})`);
  console.log(`Avg protein error: ${fmtPct(agg.avgProteinErrorPct)}`);
  console.log(`Avg carbs/fats error: ${fmtPct(agg.avgCarbsErrorPct)} / ${fmtPct(agg.avgFatsErrorPct)}`);
  console.log(`Avg item-match score: ${agg.avgItemMatchScore.toFixed(1)}/100`);
  console.log(`Avg structural score: ${agg.avgStructuralScore.toFixed(1)}/100`);
  console.log(`Item-count accuracy: ${fmtPct(agg.itemCountAccuracy * 100)}`);
  console.log(
    `Evidence status/source metadata: ${fmtPct(agg.avgEvidenceStatusCoverage * 100)} / ${fmtPct(agg.avgSourceMetadataRate * 100)}`,
  );
  if (agg.timingMs) {
    console.log(`Timing p50/p95: ${agg.timingMs.p50}ms / ${agg.timingMs.p95}ms`);
  }
  for (const level of ['easy', 'medium', 'hard'] as const) {
    const d = agg.byDifficulty[level];
    if (!d.count) continue;
    const timing = agg.timingByDifficulty?.[level];
    const timingLabel = timing ? `, p50 ${timing.p50}ms, p95 ${timing.p95}ms` : '';
    console.log(`  ${level}: n=${d.count}, avg cal err ${fmtPct(d.avgCalorieErrorPct)}, structure ${d.avgStructuralScore.toFixed(1)}/100, pass ${(d.passRate * 100).toFixed(0)}%${timingLabel}`);
  }
}

function printCaseDetail(score: CaseScore, testCase: BenchmarkCase) {
  const pass = score.withinBand ? 'PASS' : 'FAIL';
  console.log(`  [${pass}] ${score.id} (${score.difficulty})`);
  console.log(`       input: "${testCase.input}"`);
  console.log(
    `       expected ${Math.round(score.expected.calories)} kcal / ${score.expected.protein.toFixed(1)}g protein → got ${Math.round(score.predicted.calories)} kcal / ${score.predicted.protein.toFixed(1)}g protein`,
  );
  console.log(
    `       total err: cal ${fmtPct(score.calorieErrorPct)}, protein ${fmtPct(score.proteinErrorPct)}, carbs ${fmtPct(score.carbsErrorPct)}, fats ${fmtPct(score.fatsErrorPct)}`,
  );
  console.log(
    `       structure: ${score.predictedItemCount}/${score.expectedItemCount} items, ${score.matchedItemCount} matched, score ${score.structuralScore.toFixed(1)}/100`,
  );
  console.log(
    `       evidence: status ${fmtPct(score.evidenceStatusCoverage * 100)}, source metadata ${fmtPct(score.sourceMetadataRate * 100)}`,
  );
  console.log(`       items: ${score.predictedItems.map((item) => {
    const reference = item.reference_weight_g
      ? `${item.reference_weight_g}g`
      : item.reference_volume_ml
        ? `${item.reference_volume_ml}ml`
        : 'no-ref';
    return `${item.food_name}×${item.quantity} ${item.unit ?? '?'} @ ${item.calories}kcal (${reference}, ${item.evidence_status ?? 'no-evidence'})`;
  }).join(', ')}`);

  const breakdown = score.itemBreakdown;
  if (breakdown.some((row) =>
    !row.matched ||
    row.calorieErrorPct > 15 ||
    row.proteinErrorPct > 15 ||
    row.carbsErrorPct > 15 ||
    row.fatsErrorPct > 15 ||
    row.quantityCorrect === false ||
    row.unitCorrect === false ||
    row.referenceWeightCorrect === false ||
    row.referenceVolumeCorrect === false
  )) {
    console.log('       per-item:');
    for (const row of breakdown) {
      if (!row.matched) {
        console.log(`         ✗ ${row.expectedName}: missing (expected ${Math.round(row.expectedLineCalories)} kcal line)`);
        continue;
      }
      const mark = row.calorieErrorPct <= 15 ? '✓' : '~';
      console.log(
        `         ${mark} ${row.expectedName}: per-unit error cal/protein/carbs/fats ${fmtPct(row.calorieErrorPct)}/${fmtPct(row.proteinErrorPct)}/${fmtPct(row.carbsErrorPct)}/${fmtPct(row.fatsErrorPct)} as "${row.predictedName}"`,
      );
      const structure = [
        row.quantityCorrect === undefined ? null : `qty ${row.quantityCorrect ? '✓' : '✗'} (${row.predictedQuantity})`,
        row.unitCorrect === undefined ? null : `unit ${row.unitCorrect ? '✓' : '✗'} (${row.predictedUnit ?? 'missing'})`,
        row.referenceWeightCorrect === undefined ? null : `weight ${row.referenceWeightCorrect ? '✓' : '✗'} (${row.predictedReferenceWeightG ?? 'missing'}g)`,
        row.referenceVolumeCorrect === undefined ? null : `volume ${row.referenceVolumeCorrect ? '✓' : '✗'} (${row.predictedReferenceVolumeMl ?? 'missing'}ml)`,
      ].filter(Boolean);
      if (structure.length) console.log(`           ${structure.join(', ')}`);
    }
  }
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
  $env:NANOGPT_API_KEY="your_key"; npm run benchmark:macros -- --models google/gemini-3.6-flash,openai/gpt-4o-mini
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
      const startedAt = performance.now();
      const items = await parseMealText(testCase.input, { apiKey, model });
      const durationMs = Math.round(performance.now() - startedAt);
      const score = scoreCase(testCase, items);
      scores.push({ ...score, durationMs });
      console.log(`${Math.round(score.predicted.calories)} kcal (${fmtPct(score.calorieErrorPct)} err, ${durationMs}ms)`);
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
