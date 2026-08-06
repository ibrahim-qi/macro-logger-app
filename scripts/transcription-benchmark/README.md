# Transcription benchmark

Provider-neutral STT contract scoring for Sahha voice logging.

## What it measures

Nutrition-critical token accuracy (amounts, units, brands, food identity, preparation, negation), failure rate, p50/p95 STT latency, and approximate cost. Not generic WER.

## Offline (CI-safe)

```bash
npm run test:stt
npm run benchmark:stt
```

Uses committed `example-fixtures/` with `mockSttText`. No provider calls.

## Private corpus (owner)

1. Copy `private-fixtures/manifest.example.json` → `private-fixtures/manifest.json`.
2. Add short iPhone recordings + critical-token expectations.
3. Do **not** commit audio or filled private manifests.

```bash
# Live single-model run
npm run benchmark:stt:live -- --dir scripts/transcription-benchmark/private-fixtures

# Bake-off vs a NanoGPT-supported challenger
npm run benchmark:stt:compare -- --challenger <model-id>
```

Requires `NANOGPT_API_KEY`. Change production `NANOGPT_STT_MODEL` only when critical-token accuracy improves (or ties) with acceptable p95/cost.
