/**
 * Offline / owner-run transcription benchmark.
 *
 * Default: mock mode — scores fixture `mockSttText` against critical tokens.
 * Live mode (--live): calls NanoGPT Whisper for fixtures that include audio.
 * Never run --live from CI. Do not commit private-fixtures/.
 *
 * Usage:
 *   npx tsx scripts/transcription-benchmark/run.ts
 *   npx tsx scripts/transcription-benchmark/run.ts --dir scripts/transcription-benchmark/example-fixtures
 *   npx tsx scripts/transcription-benchmark/run.ts --live --dir scripts/transcription-benchmark/private-fixtures
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkSummary, FixtureCaseResult, FixtureManifest } from './fixtureTypes.ts';
import { scoreCriticalTokens, summarizeLatencies } from './score.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, 'example-fixtures');
const PRIVATE_DIR = path.join(__dirname, 'private-fixtures');

/** Rough Whisper Large V3 cost via NanoGPT — owner may override with --usd-per-minute. */
const DEFAULT_USD_PER_MINUTE = 0.006;

function parseArgs(argv: string[]) {
  let dir = DEFAULT_DIR;
  let live = false;
  let model = process.env.NANOGPT_STT_MODEL ?? 'gpt-4o-mini-transcribe';
  let usdPerMinute = DEFAULT_USD_PER_MINUTE;
  let out: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--live') {
      live = true;
    } else if (arg === '--dir' && argv[i + 1]) {
      dir = path.resolve(argv[++i]);
    } else if (arg === '--model' && argv[i + 1]) {
      model = argv[++i];
    } else if (arg === '--usd-per-minute' && argv[i + 1]) {
      usdPerMinute = Number(argv[++i]);
    } else if (arg === '--out' && argv[i + 1]) {
      out = path.resolve(argv[++i]);
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  if (live && dir === DEFAULT_DIR && !argv.includes('--dir')) {
    dir = PRIVATE_DIR;
  }

  return { dir, live, model, usdPerMinute, out };
}

function printHelp() {
  console.log(`Transcription benchmark

  npx tsx scripts/transcription-benchmark/run.ts [--dir <fixtures>] [--live] [--model <id>] [--out <json>]

  Default mode is offline/mock (no provider calls).
  --live requires NANOGPT_API_KEY and audio files under the fixture directory.
`);
}

async function loadManifest(dir: string): Promise<FixtureManifest> {
  const manifestPath = path.join(dir, 'manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as FixtureManifest;
  if (parsed.version !== 1 || !Array.isArray(parsed.fixtures)) {
    throw new Error(`Invalid manifest at ${manifestPath}`);
  }
  return parsed;
}

async function liveTranscribe(
  audioPath: string,
  mimeType: string,
  model: string,
): Promise<{ text: string; latencyMs: number; durationSec?: number }> {
  const apiKey = process.env.NANOGPT_API_KEY;
  if (!apiKey) {
    throw new Error('NANOGPT_API_KEY is required for --live');
  }
  const baseUrl = process.env.NANOGPT_BASE_URL ?? 'https://nano-gpt.com/api/v1';
  const bytes = await readFile(audioPath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), path.basename(audioPath));
  form.append('model', model);
  form.append('language', 'en');
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');

  const started = performance.now();
  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) {
    throw new Error(`STT failed (${response.status}): ${await response.text()}`);
  }
  const payload = await response.json() as { text?: string; duration?: number };
  return {
    text: String(payload.text ?? ''),
    latencyMs,
    durationSec: typeof payload.duration === 'number' ? payload.duration : undefined,
  };
}

export async function runTranscriptionBenchmark(options: {
  dir: string;
  live: boolean;
  model: string;
  usdPerMinute?: number;
  out?: string;
}): Promise<{ summary: BenchmarkSummary; outPath: string }> {
  const { dir, live, model } = options;
  const usdPerMinute = options.usdPerMinute ?? DEFAULT_USD_PER_MINUTE;
  const manifest = await loadManifest(dir);
  const cases: FixtureCaseResult[] = [];

  for (const fixture of manifest.fixtures) {
    try {
      let transcript = '';
      let latencyMs: number | undefined;
      let durationSec: number | undefined;
      let mode: 'mock' | 'live' = 'mock';

      if (live && fixture.audio) {
        mode = 'live';
        const audioPath = path.join(dir, fixture.audio);
        const mimeType = fixture.mimeType ?? 'audio/mp4';
        const liveResult = await liveTranscribe(audioPath, mimeType, model);
        transcript = liveResult.text;
        latencyMs = liveResult.latencyMs;
        durationSec = liveResult.durationSec;
      } else if (fixture.mockSttText !== undefined) {
        transcript = fixture.mockSttText;
      } else if (live) {
        throw new Error('Fixture has no audio for live mode');
      } else {
        throw new Error('Fixture has no mockSttText for offline mode');
      }

      const score = scoreCriticalTokens(transcript, fixture.criticalTokens);
      const missedTokens = score.categoryScores.flatMap((entry) => entry.missed);
      const costEstimateUsd = durationSec !== undefined
        ? (durationSec / 60) * usdPerMinute
        : undefined;

      cases.push({
        id: fixture.id,
        mode,
        transcript,
        criticalTokenAccuracy: score.criticalTokenAccuracy,
        matchedCount: score.matchedCount,
        expectedCount: score.expectedCount,
        missedTokens,
        latencyMs,
        costEstimateUsd,
      });
    } catch (error) {
      cases.push({
        id: fixture.id,
        mode: live ? 'live' : 'mock',
        transcript: '',
        criticalTokenAccuracy: 0,
        matchedCount: 0,
        expectedCount: 0,
        missedTokens: [],
        failure: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const scored = cases.filter((entry) => !entry.failure);
  const failures = cases
    .filter((entry) => entry.failure)
    .map((entry) => ({ id: entry.id, failure: entry.failure ?? 'unknown' }));
  const meanCriticalTokenAccuracy = scored.length === 0
    ? 0
    : scored.reduce((sum, entry) => sum + entry.criticalTokenAccuracy, 0) / scored.length;
  const perfectCount = scored.filter((entry) => entry.criticalTokenAccuracy === 1).length;
  const passRate = scored.length === 0 ? 0 : perfectCount / scored.length;
  const latency = summarizeLatencies(
    scored.map((entry) => entry.latencyMs).filter((n): n is number => typeof n === 'number'),
  );
  const approximateCostUsd = scored.reduce(
    (sum, entry) => sum + (entry.costEstimateUsd ?? 0),
    0,
  );

  const summary: BenchmarkSummary = {
    generatedAt: new Date().toISOString(),
    mode: live ? 'live' : 'mock',
    provider: live ? 'nanogpt' : undefined,
    model: live ? model : undefined,
    fixtureCount: cases.length,
    scoredCount: scored.length,
    failureCount: failures.length,
    meanCriticalTokenAccuracy,
    passRate,
    perfectCount,
    latency,
    approximateCostUsd,
    failures,
    cases,
  };

  const outPath = options.out ?? path.join(
    process.cwd(),
    'benchmark-results',
    `stt-${summary.mode}-${Date.now()}.json`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { summary, outPath };
}

async function main() {
  const { dir, live, model, usdPerMinute, out } = parseArgs(process.argv.slice(2));
  const { summary, outPath } = await runTranscriptionBenchmark({
    dir,
    live,
    model,
    usdPerMinute,
    out,
  });

  console.log(JSON.stringify({
    outPath,
    mode: summary.mode,
    model: summary.model,
    fixtureCount: summary.fixtureCount,
    scoredCount: summary.scoredCount,
    failureCount: summary.failureCount,
    meanCriticalTokenAccuracy: Number(summary.meanCriticalTokenAccuracy.toFixed(4)),
    passRate: Number(summary.passRate.toFixed(4)),
    latency: summary.latency,
    approximateCostUsd: Number(summary.approximateCostUsd.toFixed(4)),
  }, null, 2));
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}