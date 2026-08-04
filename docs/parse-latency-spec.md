# Evidence-first parser latency and reliability

Accuracy is the primary objective. Latency changes must not bypass evidence retrieval, merge item identities, add hard-coded nutrition values, or weaken acceptance gates.

## Stages measured

With `PARSE_TIMING=1`, `ParseTimings` reports:

- `interpretation_ms`
- `serper_ms`
- `extraction_ms`
- `fallback_ms`
- `total_ms`
- `path`

The old draft/refine timing fields and model-split experiment no longer exist.

## Current controls

- Model calls: 30-second timeout, retry for network/429/5xx, and a compatibility retry without unsupported `reasoning_effort`.
- Serper: configurable timeout, one retry, bounded item concurrency, and a warm-instance cache.
- Search: one item-bound request per non-saved item, capped by `PARSE_MAX_SEARCH_ITEMS`.
- Extraction: only items with usable evidence are sent to the extractor.
- Fallback: only unresolved items are sent to the AI estimator.
- Saved foods: bypass Serper and nutrition model calls after interpretation.

## Optimization order

1. Preserve item-bound parallel Serper requests.
2. Reduce prompt duplication while retaining full source quotes and IDs.
3. Use stage-specific model overrides only after the full accuracy gate passes.
4. Tune concurrency and timeouts from production timing logs.
5. Avoid repeated live benchmarks; run one controlled suite per candidate change.

## Reliability requirements

- A search timeout must degrade only the affected item.
- Rate limits and server errors receive one retry and are logged.
- Search-cap overflow is explicit, never silently dropped.
- Partial evidence must not cause full-array regeneration.
- Provider-specific optional parameters must not make the entire parser fail.

## Performance acceptance

Measure one full macros run, staples run, and chains run after correctness tests pass. Report p50/p95 total time and stage breakdown. A latency change is accepted only if:

- macro and structural pass rates do not regress;
- evidence grounding remains valid;
- guardrails retain zero false meal rejections;
- the production build passes.
