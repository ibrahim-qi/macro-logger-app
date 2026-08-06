/**
 * Owner-run bake-off: compare two STT models on the same private fixture corpus.
 *
 * Example:
 *   npx tsx scripts/transcription-benchmark/compare.ts \
 *     --dir scripts/transcription-benchmark/private-fixtures \
 *     --baseline gpt-4o-mini-transcribe \
 *     --challenger Whisper-Large-V3
 *
 * Requires NANOGPT_API_KEY. Never run from CI.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkSummary } from './fixtureTypes.ts';
import { runTranscriptionBenchmark } from './run.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]) {
  let dir = path.join(__dirname, 'private-fixtures');
  let baseline = process.env.NANOGPT_STT_MODEL ?? 'gpt-4o-mini-transcribe';
  let challenger = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir' && argv[i + 1]) dir = path.resolve(argv[++i]);
    else if (arg === '--baseline' && argv[i + 1]) baseline = argv[++i];
    else if (arg === '--challenger' && argv[i + 1]) challenger = argv[++i];
  }

  if (!challenger) {
    throw new Error('Pass --challenger <model-id> (a NanoGPT-supported STT model).');
  }

  return { dir, baseline, challenger };
}

function decision(baseline: BenchmarkSummary, challenger: BenchmarkSummary): string {
  const accDelta = challenger.meanCriticalTokenAccuracy - baseline.meanCriticalTokenAccuracy;
  const p95Delta = challenger.latency.p95 - baseline.latency.p95;
  const costDelta = challenger.approximateCostUsd - baseline.approximateCostUsd;

  if (accDelta < -0.01) {
    return 'Keep baseline: challenger regresses critical-token accuracy.';
  }
  if (accDelta > 0.01 && p95Delta <= 500 && costDelta <= baseline.approximateCostUsd * 0.5 + 0.01) {
    return 'Promote challenger: better critical-token accuracy with acceptable latency/cost.';
  }
  if (Math.abs(accDelta) <= 0.01 && p95Delta < -300 && costDelta <= 0) {
    return 'Promote challenger: accuracy tied, meaningfully faster/cheaper.';
  }
  return 'Keep baseline: no clear evidence-based win for the challenger.';
}

async function main() {
  const { dir, baseline, challenger } = parseArgs(process.argv.slice(2));
  if (!process.env.NANOGPT_API_KEY) {
    throw new Error('NANOGPT_API_KEY is required for live bake-off.');
  }

  console.log(`Running baseline ${baseline}…`);
  const baselineRun = await runTranscriptionBenchmark({
    dir,
    live: true,
    model: baseline,
    out: path.join(
      process.cwd(),
      'benchmark-results',
      `stt-live-${baseline.replace(/[^\w.-]+/g, '_')}-${Date.now()}.json`,
    ),
  });

  console.log(`Running challenger ${challenger}…`);
  const challengerRun = await runTranscriptionBenchmark({
    dir,
    live: true,
    model: challenger,
    out: path.join(
      process.cwd(),
      'benchmark-results',
      `stt-live-${challenger.replace(/[^\w.-]+/g, '_')}-${Date.now()}.json`,
    ),
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baselinePath: baselineRun.outPath,
    challengerPath: challengerRun.outPath,
    baseline: {
      model: baselineRun.summary.model,
      meanCriticalTokenAccuracy: baselineRun.summary.meanCriticalTokenAccuracy,
      passRate: baselineRun.summary.passRate,
      latency: baselineRun.summary.latency,
      approximateCostUsd: baselineRun.summary.approximateCostUsd,
      failureCount: baselineRun.summary.failureCount,
    },
    challenger: {
      model: challengerRun.summary.model,
      meanCriticalTokenAccuracy: challengerRun.summary.meanCriticalTokenAccuracy,
      passRate: challengerRun.summary.passRate,
      latency: challengerRun.summary.latency,
      approximateCostUsd: challengerRun.summary.approximateCostUsd,
      failureCount: challengerRun.summary.failureCount,
    },
    recommendation: decision(baselineRun.summary, challengerRun.summary),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
