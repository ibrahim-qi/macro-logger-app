# Sahha Parse Guardrails — Implementation Spec

**Problem:** silent or nonsense recordings still produce fake food items. A transcript like "Hello?" or a background-TV fragment passes every existing check, the full merged parse runs (draft LLM → optional Serper → refine LLM), and the model — whose prompt orders it to "parse UK meal descriptions" with no permission to refuse — invents plausible items. The user then sees a review sheet full of hallucinated food.

**Goal:** garbage input is rejected fast (before Serper/refine, usually before any LLM call), with calm UK-English copy and a clear retry path. Valid meals — including bare brand names like "Greggs sausage roll" — always pass.

**Constraints honoured:** no public nutrition DB; AI-only gates allowed; one cheap LLM decision is acceptable but running full research on garbage is not. This spec achieves the intent-gate with **zero additional LLM calls** by folding the decision into the existing draft call (rationale in §A3).

Related docs (do not re-implement): `docs/parse-pipeline-spec.md` (merged flow), `docs/ux-spec.md` (error copy patterns, review-sheet retry).

---

## A. Detection layers

Four layers, ordered by cost. Each layer rejects as early as possible; later layers only see input that earlier layers passed.

| # | Layer | Where | Added latency | Catches |
|---|-------|-------|---------------|---------|
| 1 | Audio gate | client, pre-upload | 0 ms (local) | silence, taps, <1 s clips |
| 2 | Post-STT gate | server, after Whisper | ~0 ms (same response) | Whisper hallucinations, greetings, filler-only, repeated-word loops, "nothing eaten" phrases |
| 3 | Pre-parse rule gate | server, before draft | < 5 ms | same patterns for the **text** path + anything Whisper spelt differently |
| 4 | Draft intent gate | server, inside/after draft call | 0 extra calls | non-food speech that only a model can classify ("I'm walking to the shop now") |

### A1. Layer 1 — client audio gate (`src/utils/transcriptValidation.ts`, `src/hooks/useAudioRecorder.ts`)

Current state: `assertRecordingHasSpeech(durationMs, peakLevel, byteLength)` with `MIN_RECORDING_MS = 1000`, `MIN_PEAK_AUDIO_LEVEL = 0.038`, `MIN_AUDIO_BYTES = 2048`. Weakness: `peakLevel` is the **max** of per-frame frequency averages — a single cough, tap on the mic, or AGC-boosted noise floor spike passes it.

Changes:

1. **Add a sustained-speech metric** to `useAudioRecorder.ts`. In the existing `tick()` analyser loop, count time above threshold instead of only tracking the max:

   - New ref `voicedMsRef`; each frame where `avg > 0.045`, add the frame delta (use `performance.now()` between ticks, not an assumed 16 ms).
   - Return `voicedMs` in `RecordingResult` alongside `durationMs` and `peakLevel`.

2. **Extend `assertRecordingHasSpeech`** with `voicedMs`:

   - `MIN_VOICED_MS = 350` — reject with the no-speech message if `voicedMs < 350`. 350 ms is roughly the shortest plausible meal utterance onset ("eggs") while a tap/cough registers < 150 ms.
   - Keep `MIN_RECORDING_MS = 1000` (don't raise it — "two eggs" spoken quickly is ~1 s).
   - Keep `MIN_PEAK_AUDIO_LEVEL = 0.038` as a second signal, not the only one.

3. **Do not attempt full VAD** (WebRTC VAD / silero in WASM). The analyser-based voiced-time counter gets ~90% of the benefit for ~20 lines; a VAD dependency adds bundle weight and a tuning surface we can't validate without a device lab. Revisit only if Layer-1 false-accepts show up in server logs (see §C5 logging).

Call-site: `MealParseInput.tsx` `finishRecording()` already calls `assertRecordingHasSpeech` before `onParseStart` — pass the new `voicedMs` through. Rejects here show inline under the orb (current behaviour, `reviewOpened` is still false — keep).

**Budget:** instant, zero network. A 2 s silent clip must die here.

### A2. Layer 2 — post-STT gate (`supabase/functions/_shared/transcriptValidation.ts`)

Current state: empty check, tiny-audio-vs-long-text check, YouTube-outro `HALLUCINATION_PATTERNS`, and `MEAL_HINT` — but the hint is only enforced for transcripts **longer than 120 chars**. "Hello?", "Thanks.", "Testing testing one two" all pass.

Changes (all in `transcriptValidation.ts`; keep the existing patterns, add these):

1. **Filler-only rejection.** Tokenise the transcript, strip filler tokens, and reject if nothing meaningful remains:

   ```
   FILLER_TOKENS = hi, hiya, hello, hey, hmm, mm, um, uh, erm, er, oh, okay, ok,
                   yeah, yep, yes, no, nah, thanks, thank, you, cheers, right,
                   so, well, like, please, test, testing, one, two, three, four,
                   check, mic, hello?, alright
   ```

   Implementation: lowercase, strip punctuation, split on whitespace; if every token is in `FILLER_TOKENS` (or the token list is empty) → hallucinated. This kills "Hello?", "Thank you.", "Testing, one two three", "Okay so um".

   Safety: none of these tokens can form a valid meal on their own. A meal description always contains at least one non-filler token ("eggs", "Greggs", "toast").

2. **Repeated-token loop detection** (Whisper artefact on noise): if the transcript is ≥ 3 tokens and ≤ 2 distinct tokens (e.g. "the the the the") → hallucinated.

3. **"Nothing eaten" detection** — new exported function, *not* folded into `isLikelyHallucinatedTranscript` because it needs different user copy:

   ```
   NOTHING_EATEN_PATTERN =
     /\b(?:didn'?t|haven'?t|have not|did not|not)\s+(?:eat|eaten|had)\b|\bskipped\s+(?:breakfast|lunch|dinner)\b|\bnothing\s+(?:to log|to eat|eaten|for (?:breakfast|lunch|dinner))\b|\bi (?:ate|had) nothing\b/i
   ```

   `detectNothingEaten(transcript): boolean`. Matches "I didn't eat anything", "skipped lunch", "had nothing today". Paraphrases this regex misses are caught by Layer 4.

4. **Expand `HALLUCINATION_PATTERNS`** with common Whisper-on-silence outputs not yet covered:

   ```
   /^\s*you\s*$/i,            // Whisper's most famous silence token
   /^\s*(?:\.|,|!|\?)+\s*$/,  // punctuation only
   /thanks for listening/i,
   /www\.[a-z0-9-]+\./i,      // URLs never appear in spoken meal logs
   /♪|♫|\[music\]|\[applause\]|\(music\)/i,
   ```

5. **`no_speech_prob` (staged).** `transcribeWithNanoGpt` in `parse-meal/index.ts` currently requests `response_format: 'json'`. Change to `verbose_json` and read `payload.segments[].no_speech_prob` if present (OpenAI-compatible Whisper serves it; if NanoGPT strips it, `segments` is simply absent and nothing changes).

   - **Stage 1 (ship with this spec): log only.** `console.log('[stt] no_speech_prob', maxProb, 'len', text.length)` — build a threshold from real traffic.
   - **Stage 2 (separate PR after ~1 week of logs): enforce.** Proposed starting rule: reject when *every* segment has `no_speech_prob > 0.85`, or mean > 0.6 **and** the transcript has no `MEAL_HINT` match. Do not enforce untuned thresholds blind — Whisper's calibration varies by provider.

Rejections in this layer throw the typed `ParseRejectionError` (§C2) with reason `no_speech` (hallucination/filler) or `nothing_eaten`.

**Budget:** 0 added ms — pure regex on the STT response we already have. "Hello?" dies here ~1.5 s after the user taps Done (STT round-trip only).

### A3. Layer 3 — pre-parse rule gate, and why there is no standalone classifier call

The brief asked for a `< 500 ms` pre-parse "meal intent" gate and offered three options. Evaluation:

| Option | Latency | Verdict |
|--------|---------|---------|
| Rule-based | < 5 ms | ✅ adopt — as Layer 2/3 (same module, both paths) |
| Tiny classifier prompt (separate LLM call) | 400–900 ms measured NanoGPT round-trip, **added to every legitimate parse** | ❌ reject — directly contradicts the latency spec; on garbage it saves nothing vs. the draft-gate below |
| Structured `{is_meal, ...}` JSON | 0 ms extra | ✅ adopt — **folded into the draft call** (Layer 4) |

A separate classifier call would tax the 95%+ of parses that are real meals to protect against the < 5% that aren't. Folding the classification into the draft schema gets the same model judgement for free, and the draft call happens anyway. Garbage that reaches Layer 4 costs one draft call (~2 s) — but crucially **never** costs Serper + refine (the 5–25 s path).

Layer 3 concretely: `parseMealText` in `parse-meal/index.ts` (which serves both the text path and the voice path post-STT) calls the same rule gate before invoking `parseMealWithResearch`:

```
assertTranscriptLooksLikeFood(mealText)  // filler-only, repeated-token, nothing-eaten, hallucination patterns
```

This matters for the **text path**, which currently has zero validation — typing "hello" today runs the full parse. Also mirror the same check client-side in `handleParseText` (`MealParseInput.tsx`) for instant feedback before any network call (see §C3 for the shared-module mechanics).

**Must-pass check:** "Greggs sausage roll" contains no `FILLER_TOKENS`-only content, no repeated tokens, no nothing-eaten phrase → passes all rule gates untouched. Rule gates only ever reject on *positive* garbage signals, never on the absence of known food words — `MEAL_HINT` stays a long-text heuristic and never becomes a short-text whitelist (it would reject "Greggs sausage roll", which contains no hint word).

### A4. Layer 4 — interpretation intent gate (`mealParsePrompt.ts`, `mealParseFlow.ts`)

The interpretation model has an explicit refusal channel before any nutrition research:

1. **Schema** (`MEAL_INTERPRETATION_SCHEMA`) has a required top-level field:

   ```json
   "input_assessment": { "type": "string", "enum": ["meal", "no_food", "nothing_eaten"] }
   ```

2. **Prompt** (`INTERPRETATION_SYSTEM_PROMPT`):

   ```
   INPUT ASSESSMENT — set input_assessment first:
   - "meal": the text describes food or drink the user consumed or wants to log. Parse it.
   - "nothing_eaten": the user says they did not eat or skipped a meal.
   - "no_food": greetings, test phrases, background speech, or any text with no food or drink in it.
   For "nothing_eaten" and "no_food": return items: [] and put a one-line reason in notes.
   NEVER invent food items for unclear input — an empty list is the correct answer.
   A bare brand or product name ("Greggs sausage roll", "Big Mac") IS a meal.
   ```

3. **Flow** (`parseMealWithResearch` in `mealParseFlow.ts`), immediately after interpretation and before Serper:

   ```ts
   if (interpretation.input_assessment === 'nothing_eaten') throw new ParseRejectionError('nothing_eaten', mealText);
   if (interpretation.input_assessment === 'no_food' || interpretation.items.length === 0) {
     throw new ParseRejectionError('no_meal_detected', mealText);
   }
   ```

   No search is started until this check passes.

4. **Belt-and-braces post-interpretation heuristic** remains server-side and must not become a food-word whitelist.

**Budget:** the interpretation call is required for every accepted meal. Serper and nutrition extraction are never reached for rejected input.

---

## B. User experience on reject

### B1. Copy (add to `src/copy/experience.ts`, UK English, calm — match existing tone)

```ts
export function getNoSpeechMessage(): string {
  return 'We didn\'t catch that. Tap the mic and say what you ate.';
}

export function getNoMealDetectedMessage(): string {
  return 'That didn\'t sound like a meal. Try something like "two eggs and toast", or type it below.';
}

export function getNothingEatenMessage(): string {
  return 'Nothing to log this time. Come back after your next meal.';
}

export function getRejectionTitle(): string {
  return 'Nothing to log yet';
}
```

Notes: `getNothingEatenMessage` deliberately doesn't scold — the user told the truth and the app acknowledges it. The rejection title is distinct from `getParseErrorTitle()` ("Let's try that again"), which stays reserved for genuine failures (network, parser errors).

### B2. Where each reject surfaces

| Reject | Sheet state when it fires | Surface |
|--------|--------------------------|---------|
| Layer 1 (client audio) | sheet **not open** (`onParseStart` not yet called) | inline error under the orb (`log-voice-input__error`) — current behaviour, new copy |
| Layer 2/3/4, voice | sheet open, loading | **inside the sheet**: loading state swaps to rejection state |
| Layer 3, text (client mirror) | sheet not open | inline error under the textarea — instant, no network |
| Layer 3/4, text (server) | sheet open, loading | inside the sheet, same as voice |

Never close the sheet automatically on a server-side reject — the user is looking at it; a sheet that vanishes reads as a crash. And **never** render the review list for a rejected parse: rejection throws before a `result` event exists, so `MealParseReview` structurally cannot show items (no code path renders items without `result`).

### B3. Sheet rejection state (`MealParseReview.tsx`, `LogPage.tsx`)

Reuse the existing error plumbing with one discriminator instead of building a parallel system:

1. `LogPage.tsx`: `handleParseError` gains a kind — store `{ message, kind: 'rejection' | 'failure', reason?, transcript? }` (extend the existing `parseError` state to this shape or add a sibling state).
2. `MealParseReview.tsx`: new optional prop `parseErrorKind` (default `'failure'`):
   - Title: `getRejectionTitle()` for rejections, `getParseErrorTitle()` for failures.
   - Body: the rejection message replaces `meal-review-retry__error`'s red-tinted box with a neutral-toned variant (add `meal-review-retry__error--calm`: same layout, `--color-surface-2` background, `--color-text-secondary` text — a rejection is not an alarm).
   - Retry affordance:
     - `no_speech` → **no editable transcript** (there's nothing usable to edit). Footer: "Close" + primary "Try again" that closes the sheet and refocuses the mic (call `onClose`; the orb is right there).
     - `no_meal_detected` with a transcript → keep the existing editable-transcript retry (`retryDraft` + `onRetry`) so the user can fix a mis-transcription ("parse it as food anyway" is intentionally *not* offered — if they edit and resubmit, the gates run again on the edited text).
     - `nothing_eaten` → single "Done" button, closes the sheet. No retry framing.
3. Voice vs text: identical inside the sheet. The text path's client-side mirror (§A3) never opens the sheet at all.

### B4. Haptics

On rejection, fire `hapticLight()` (not `hapticSuccess`). No sound.

---

## C. Implementation plan

### C1. File-level changes

**Server (`supabase/functions/`):**

| File | Change |
|------|--------|
| `_shared/parseRejection.ts` **(new)** | `ParseRejectionError` class: `{ code: 'no_speech' \| 'no_meal_detected' \| 'nothing_eaten'; transcript?: string }`, extends `Error` with a stable `name` for `instanceof`-safe checks across module duplication |
| `_shared/transcriptValidation.ts` | filler-only check, repeated-token check, `detectNothingEaten`, expanded `HALLUCINATION_PATTERNS`, export `MEAL_HINT`, new `assertTranscriptLooksLikeFood` throwing `ParseRejectionError`; `assertUsableTranscript` throws `ParseRejectionError('no_speech')` instead of generic `Error` |
| `_shared/mealParsePrompt.ts` | `input_assessment` in `MEAL_INTERPRETATION_SCHEMA`; INPUT ASSESSMENT block in the interpretation prompt |
| `_shared/mealParseFlow.ts` | post-interpretation gate (§A4.3, §A4.4) before per-item research |
| `parse-meal/index.ts` | `verbose_json` + `no_speech_prob` logging in `transcribeWithNanoGpt`; `assertTranscriptLooksLikeFood(mealText)` at the top of `parseMealText`; catch `ParseRejectionError` in `streamVoiceParse` → `rejected` event; catch in the non-streaming handler → HTTP 422 with `{ error, code, transcript }` |

**Client (`src/`):**

| File | Change |
|------|--------|
| `hooks/useAudioRecorder.ts` | `voicedMs` tracking + return |
| `utils/transcriptValidation.ts` | `MIN_VOICED_MS`, extended `assertRecordingHasSpeech`; re-export text gates from the shared module (§C3) |
| `utils/parseMeal.ts` | handle `rejected` stream event and 422 `code` payloads → throw `ParseRejectionError` (client twin); `formatInvokeError` maps rejection codes to the §B1 copy |
| `components/MealParseInput.tsx` | pass `voicedMs`; client text gate in `handleParseText`; propagate rejection kind via `onParseError` |
| `pages/LogPage.tsx` | error-kind state |
| `components/MealParseReview.tsx` | rejection rendering per §B3 |
| `copy/experience.ts` | four new functions (§B1) |
| `index.css` | `meal-review-retry__error--calm` variant |

### C2. New stream/HTTP contract

Streaming (voice) — new NDJSON event, emitted instead of `error` for rejections:

```json
{ "event": "rejected", "reason": "no_meal_detected", "transcript": "hello can you hear me" }
```

`transcript` is present when STT succeeded (Layers 3–4) and absent for Layer-2 rejects. Client (`invokeParseMealVoice`) treats `rejected` as terminal, like `error`, but throws the typed rejection.

Non-streaming (text path and legacy voice) — HTTP 422:

```json
{ "error": "That didn't sound like a meal…", "code": "no_meal_detected", "transcript": "hello" }
```

`invokeMealFunction` in `parseMeal.ts` already surfaces `payload.error` from `FunctionsHttpError`; extend `readFunctionError` to also read `code` and throw the typed rejection when present.

### C3. Shared validation module — unify, don't fork

Today the audio thresholds live client-side and the transcript patterns live server-side, with `normalizeAudioMimeType` already copy-pasted into both. The repo **already imports server shared code outside Deno**: `scripts/macro-benchmark/parseClient.ts` imports from `supabase/functions/_shared/` and runs under Node. `transcriptValidation.ts` contains no Deno APIs — it's portable TS.

Decision: **single source of truth in `supabase/functions/_shared/transcriptValidation.ts`**, imported by the client (`src/utils/transcriptValidation.ts` re-exports the text-gate functions from it and keeps only the audio-threshold logic, which is genuinely client-only). Vite bundles plain `.ts` with extensioned imports fine (same as the benchmark's tsx runner).

Fallback if the Vite import proves awkward in practice (path aliasing, lint boundaries): keep two files but add a unit test that imports both and asserts the pattern lists are identical, so drift fails CI instead of failing users. Do not silently mirror without the test.

### C4. Tests — `scripts/guardrails/`

New folder, two runners, both wired as npm scripts:

1. **`npm run guardrails:unit`** — `node --test` via tsx, zero API keys. Table-driven over the pure functions:

   - Reject: `""`, `"Hello?"`, `"Thank you."`, `"Thanks for watching!"`, `"you"`, `"Testing, one two three"`, `"the the the the"`, `"..."`, `"Okay so um"`, `"I didn't eat anything today"` (→ `nothing_eaten`), `"skipped lunch"` (→ `nothing_eaten`), a 150-char lorem string with no meal words.
   - Pass: `"Greggs sausage roll"`, `"2 boiled eggs"`, `"McDonald's Big Mac"`, `"chicken and rice"`, `"150g Greek yogurt with a handful of blueberries"`, `"large latte"`, `"beans on toast"`, `"Pret ham and cheese baguette"`, every `input` string in `scripts/macro-benchmark/dataset.ts` (import it — the whole benchmark corpus must pass the rule gates).
   - Audio: `assertRecordingHasSpeech` matrix over `(durationMs, peakLevel, voicedMs)`.

2. **`npm run guardrails:intent`** — needs `NANOGPT_API_KEY`; calls the real draft (reusing `parseClient.ts` plumbing) over a small labelled set and asserts `input_assessment`/rejection:

   - `no_food`: "hello can you hear me", "just testing the app", "I'm walking to the shop now", "what's the weather like", "thanks for watching, see you in the next video".
   - `nothing_eaten`: "I've not had anything today", "fasted all morning".
   - `meal`: all `BENCHMARK_CASES` inputs (assert `items.length > 0` and assessment `meal`).

   Report a confusion matrix; gate on **zero false rejections of meal cases** (false *accepts* of garbage are logged but non-blocking — Layer 4's belt-and-braces and user review absorb them).

Also add the two new prompt cases to the macro benchmark's smoke habits, but do **not** add reject cases to `dataset.ts` — it scores macros and these have none.

### C5. Logging (for tuning, all server-side, no PII beyond the transcript we already handle)

- `[guard] rejected layer=2 reason=no_speech len=7` on every rejection, with layer number.
- `[stt] no_speech_prob …` per §A2.5.
- Layer 4 rejections include the stable reason and layer number.

### C6. Rollout order

1. PR 1 (pure wins, no behaviour risk): Layer 2 patterns + Layer 3 rule gate + typed rejection + SSE/422 contract + client handling + copy + unit tests.
2. PR 2: Layer 1 `voicedMs` (client-only).
3. PR 3: Layer 4 schema/prompt change + intent test run before merge. The current evidence-first parser carries `input_assessment` in `MEAL_INTERPRETATION_SCHEMA` and rejects before Serper.
4. Stage 2 `no_speech_prob` enforcement: separate PR after log review.

No env flags needed; rejection is not riskier than the current hallucination behaviour, and each layer fails open (a bug in a gate throws → existing generic error path, not silent acceptance).

---

## D. Acceptance criteria

1. **2 s of silence** → rejected client-side by Layer 1 in < 100 ms wall clock, zero network requests, inline message under the orb. Total time from tapping Done: **< 3 s** including the stop-encode overhead (comfortably; typically < 0.5 s).
2. **"Hello?" spoken clearly** → passes Layer 1 (real speech), transcribed, rejected by Layer 2 filler check. Sheet shows "Nothing to log yet" + no-meal message ~1.5–2.5 s after Done. **Zero items ever rendered.**
3. **"Greggs sausage roll"** → passes every layer, full merged parse runs, review sheet shows the item. Verified by `guardrails:unit` (rule gates) and `guardrails:intent` (draft assessment).
4. **Background TV outro** ("thanks for watching…", music tokens, URLs) → Layer 2 pattern reject; paraphrased non-food chatter that slips through → Layer 4 draft reject; in both cases Serper is never called (assert via `searches_run` absent / logs).
5. **"I didn't eat anything"** → `nothing_eaten` copy ("Nothing to log this time…"), single Done button, no retry textarea.
6. **Typed "hello" in the text box** → rejected client-side with no network request.
7. **Every input in `scripts/macro-benchmark/dataset.ts`** passes all gates; `npm run benchmark:macros` pass rate unchanged (±0) after the draft-prompt change — run before/after on PR 3.
8. A rejected parse never emits a `result` event and never opens the review list state.
