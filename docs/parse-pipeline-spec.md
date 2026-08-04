# Evidence-first meal parsing

This document describes the production parser. Historical draft/refine and legacy parse flows have been removed.

## Goals

- Interpret natural UK meal descriptions without embedding food portions or nutrition values in code or prompts.
- Research every non-saved item independently.
- Ground nutrition in UK web evidence when possible.
- Use deterministic code—not model arithmetic—to scale source values to the inferred portion.
- Return an honest AI estimate when evidence is unavailable.
- Keep every inferred portion and source reviewable before saving.

No system can produce an exact value when the physical portion is unknown. For vague input, the interpretation model selects the most likely amount and the review UI exposes it.

## Pipeline

1. Audio validation and Whisper transcription for voice requests.
2. Transcript/intent guardrails.
3. AI interpretation into stable item IDs, food identity, preparation, quantity, and inferred physical portion. This stage emits no macros.
4. User-saved matches bypass web research and use the user's stored values.
5. Each remaining item receives its own UK-biased Serper query and result bundle.
6. The extraction model copies a complete nutrition set from one matching source, including a verbatim evidence quote.
7. The server verifies the quote/source against the original item-bound result.
8. `nutritionCompute.ts` scales per-100g, per-100ml, per-item, or per-serving values to the interpreted portion.
9. Items without valid evidence receive a separate, explicitly labelled AI estimate.
10. Boundary normalization and macro-consistency metadata are applied without changing meal meaning.
11. The client shows the inferred portion and one of: UK evidence, user saved food, AI estimate, or unavailable.

## Runtime contracts

`mealParsePrompt.ts` owns three strict schemas:

- `MEAL_INTERPRETATION_SCHEMA`
- `NUTRITION_EVIDENCE_SCHEMA`
- `NUTRITION_FALLBACK_SCHEMA`

All stages preserve `item_id`. Nutrition evidence may never move between IDs.

## Source and arithmetic rules

- US nutrition aggregators are filtered.
- Official UK product pages, UK government/health sources, and reputable UK references rank first.
- Extracted values must be supported by a verbatim quote from the selected result.
- Missing nutrients are not invented or combined across incompatible sources.
- Quantity is never included in per-unit macros.
- Millilitres remain volume; the server does not assume one millilitre equals one gram.
- The 4/4/9 check is review metadata only and does not overwrite official labels.

## Failure behavior

- Serper timeout, rate limiting, empty evidence, extraction failure, or conflicting evidence falls back per item to the AI estimate stage.
- Failure on one item does not rewrite or discard other items.
- If both evidence and estimation fail, the item remains visible with zero values, low confidence, and `evidence_status: unavailable` so it cannot masquerade as accurate.
- Invalid/non-meal input is rejected before research.

## Configuration

- `NANOGPT_API_KEY`
- `NANOGPT_BASE_URL`
- `NANOGPT_STT_MODEL`
- `NANOGPT_PARSE_MODEL`
- Optional: `NANOGPT_INTERPRETATION_MODEL`
- Optional: `NANOGPT_EXTRACTION_MODEL`
- Optional: `NANOGPT_FALLBACK_MODEL`
- `SERPER_API_KEY`
- Optional: `SERPER_TIMEOUT_MS`, `SERPER_CONCURRENCY`, `PARSE_MAX_SEARCH_ITEMS`
- Optional: `PARSE_TIMING=1`

## Acceptance

- No hard-coded runtime food nutrition or portion values.
- Deterministic basis scaling tests pass.
- Evidence quote/source validation tests pass.
- Multi-item evidence remains isolated by item ID.
- Saved foods bypass search without overriding explicit user weights.
- Guardrail suites produce zero false meal rejections.
- Full macros, staples, and chains benchmarks do not regress from the accepted baseline.
- Lint and production build pass.
