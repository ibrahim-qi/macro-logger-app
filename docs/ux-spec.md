# Sahha UX Spec — Log, Parse, Review & App Polish

Implementation-ready UX spec. Same rigor as `docs/parse-pipeline-spec.md`: current-state audit grounded in source, exact target behavior, file-level changes, phased plan, acceptance criteria.

**Scope guard:** polish existing flows only. No new routes, tabs, or product surfaces. No schema/API changes (anything needing one is marked *future / out of scope*). No component library. Reuse existing tokens in `src/index.css` `@theme` — no rebrand.

All findings below come from reading the source (components, CSS, copy) — no screenshots were used.

---

## §1 Executive summary

- **The biggest UX gap is already built server-side and thrown away client-side.** The parse pipeline streams honest progress stages (`transcribing → identifying → looking_up → estimating`); `LogPage` receives and orders them (`advanceParseProgress`), passes them to `MealParseReview` — which discards them (`parseProgress: _parseProgress`). During a 5–25s wait, users see rings, then only an italic quote and a 2px shimmer. Wiring stage copy into `MealParseLoading` is the single highest-leverage change in the app, and it's pure frontend.
- **Trust data exists but is invisible.** `research_used`, per-item `source_note`, and meal-level `notes` reach the client and are never rendered — while the CSS for rendering them (`.meal-review-context__notes`, `.meal-review-row__source`) already exists, orphaned. One quiet "Checked against UK sources" line converts a 20-second wait from "slow app" into "thorough app".
- **There are four loading languages** (`MealParseLoading`, `LoadingState`, `Skeleton`/`TodayPageSkeleton`, raw `.spinner`), plus dead skeleton CSS for a fifth that was never shipped. Keep two (parse-wait for parsing, LoadingState for everything else), define when each is used, delete the rest.
- **Reduced-motion is half-done.** `sahha-voice` and dashboard fills respect `prefers-reduced-motion`; the parse loader's three infinite animations (`parse-glow-breathe`, `parse-ring-pulse`, `parse-line-slide`) do not. This is the screen users stare at longest.
- **Dead weight to remove:** `VoiceWaveform.tsx` is imported nowhere; `.meal-review-status`, `.meal-review-skeleton__*`, `.meal-review-confirm`, `.meal-review-row__assumption*`, `.meal-review-row__hint` CSS blocks have no consumers. Removing them makes the design system legible for whoever touches it next.

---

## §2 Design principles

Seven rules. Each is testable against a Sahha screen.

1. **Never show a wait without saying what's happening.**
   Do: stage label under the transcript during parse ("Checking UK sources"). Don't: rings-only `parse-wait__stage`, or a spinner with no label (current voice orb busy state is acceptable only because the review sheet opens immediately over it).
2. **The transcript is the hero of the wait.**
   Do: keep `parse-wait__quote` centered and calm — it proves the app heard the user. Don't: shrink it to make room for progress chrome; stage copy sits *under* it, smaller.
3. **Stages are honest or absent.** Show a stage only when the server emitted it. Do: skip `looking_up` when no search ran. Don't: fake steppers, percent bars, or a fixed animation timeline pretending to be progress (anti-pattern list).
4. **Numbers the user will save get visual priority over numbers the app computed.**
   Do: item calories right-aligned and large (`meal-review-row__calories`), hero total on top. Don't: surface `searches_run`, `parse_path`, or confidence enums as raw values — translate or hide.
5. **One deliberate tap per trust decision — no more, no less.**
   Do: keep per-item "Looks good" and the gated footer. Don't: add confirmation dialogs on top (double-asking), and don't auto-verify anything the AI produced (removing verify is an explicit anti-pattern).
6. **Motion means state change; idleness breathes at most once.**
   Do: one slow breathe on the wait screen; staggered 24ms item reveal on result (already built). Don't: parallel infinite animations competing (glow + two rings + shimmer currently run simultaneously), and every animation needs a `prefers-reduced-motion` fallback.
7. **Copy sounds like a calm UK friend, not a system.**
   Match `src/copy/experience.ts` register: "Ready when you are", "Tap when ready — you review before saving." Do: "Working out the numbers". Don't: "Processing…", "Parser error:", "Failed to load entries for 2026-08-04: …" (all currently shipped).

---

## §3 Current-state audit

### 3.1 Log page (`LogPage.tsx`, `LogHero.tsx`, `MealParseInput.tsx`)

**Works:** clear single-purpose page; voice orb visually primary with text demoted under "or type"; date pill for back-logging; saved-foods quick add collapsed by default; press/ripple/haptic feedback on the orb; recording timer; parse generation counter prevents stale results after cancel.

**Off:**
- **(P1)** Voice hints are system-flavoured: "Processing…" (`MealParseInput.tsx` line 263). Also the hint disappears entirely when `reviewActive` — correct, but during the ~300ms before the sheet opens the orb shows a bare spinner.
- **(P1)** Text-path button flips to "Working…" while the sheet is already open showing its own loading — duplicated signal, both generic.
- **(P2)** "Heard: …" line under the textarea persists after a completed parse; stale once the review sheet closed (the transcript already showed in the sheet).
- **(P2)** `VoiceWaveform.tsx` is dead code (no imports anywhere; only its own file and its CSS reference it). The orb's `--voice-level` reactive surface already covers level feedback.

### 3.2 Parse loading (`MealParseLoading.tsx`, `parse-wait` CSS, `LoadingState.tsx`)

**Works:** transcript-as-hero pattern is right (`parse-wait--heard` swaps rings for the quote — exactly the Limitless-style "you were heard" moment); exit transition (`parse-wait--out`) into staggered item reveal is genuinely premium; `aria-live`/`aria-busy` present.

**Off:**
- **(P0)** `parseProgress` is wired end-to-end (`parseMeal.ts` → `LogPage` → `MealParseReview` props) and then unused — `MealParseReview.tsx` destructures it as `_parseProgress`. Users get zero stage information for up to 25s.
- **(P0)** Once the transcript arrives, `.parse-wait--heard .parse-wait__stage { display: none }` removes the mark and rings; all that remains is the quote and a 3.5rem shimmer line. On the research path that's ~20s of near-static screen — reads as hung.
- **(P0)** Text parses (`invokeParseMeal`, non-streaming) produce no progress events and `LogPage` sets `parseProgress` to `null` — the loader needs a graceful default label, currently none.
- **(P0)** No reduced-motion coverage for `parse-glow-breathe`, `parse-ring-pulse`, `parse-line-slide` (the two existing `@media (prefers-reduced-motion: reduce)` blocks cover `sahha-voice` and dashboard fills only).
- **(P1)** Two loading systems with overlapping jobs: `MealParseLoading` (visual-only) vs `LoadingState` (label + sublabel + optional trust badge). Neither can express "stage + transcript". §4 unifies responsibility rather than components.
- **(P2)** Dead CSS from a previous loading iteration: `.meal-review-status`, `.meal-review-status__dot`, `.meal-review-skeleton__*` (~80 lines) — no component renders these classes.

### 3.3 Review sheet (`MealParseReview.tsx`)

**Works:** hero count-up total with macro line; "after logging" goal bar grounds the decision; "You said" transcript block; per-item verify with clear pending/verified/uncertain row states; serving pill with gram presets + custom input scaling macros via `reference_weight_g` (excellent — this is the premium differentiator); remember-for-next-time appears only after verify; cancel is possible during loading.

**Off:**
- **(P0)** Loading state inside the sheet ignores stage + transcript hierarchy (see 3.2 — same component).
- **(P1)** Trust metadata invisible: `result.notes` never rendered (CSS `.meal-review-context__notes` exists, orphaned); per-item `source_note` never rendered (`.meal-review-row__source` orphaned); `research_used` unused. The app does real UK research and never takes credit.
- **(P1)** Verify friction is linear: a 5-item meal = 5 precise small-target taps ("Looks good" buttons) + footer = 6 taps. The row itself is not tappable for verification, and after verifying an item the next unverified item isn't brought into view.
- **(P1)** The footer button in unverified state ("Verify 3 items") is disabled — it names the blocker but does nothing when tapped. Dead-feeling primary CTA.
- **(P2)** `confidence === 'low'` rows get `--uncertain` styling but nothing tells the user *why* or what to check; `portion_assumption` is compressed into the serving pill label but assumption context ("assumed semi-skimmed") can be truncated away by `formatServingLabel`'s 44-char cap.
- **(P2)** Error state title "Could not parse meal" + raw `formatInvokeError` strings can leak technical fragments ("Parser error: …", "Edge Function…" fallbacks are mapped, but several branches pass `msg` through raw).

### 3.4 Today dashboard (`FoodEntryList.tsx`, `TodayHero.tsx`, `DayMetrics.tsx`)

**Works:** calm density — big calorie number, thin progress bar, single-line P/C/F stats; context line + greeting whisper hierarchy; skeleton on load; just-logged highlight + toast on return from logging.

**Off:**
- **(P1)** Error state is a raw technical string: `Failed to load entries for ${dateKey}: ${err.message}` (line 123) — worst copy in the app, on the most-visited screen.
- **(P1)** `TodayPageSkeleton` (shimmer) vs `LoadingState` (mark + label) vs tab content — three surfaces, two systems; per §4 skeletons are correct for content-shaped loads, but Goals tab uses `goalsLoading` with its own handling. Align per the rule in §4.4.
- **(P2)** No-goals state inside `TodayHero` is a bare sentence ("Set daily targets to track your nutrition.") with no action, while a Targets tab sits one tap away — add an inline link/button.

### 3.5 Trends (`/summary`)

Not deep-audited (files outside the mandatory read list). Apply §4.4 loading rules and §7 empty-state rules; copy functions (`getTabLoadingLabel`, `getStatsEmpty*`) already exist and should be the single source for those screens. **(P1)** verify each tab uses `LoadingState` + those functions rather than ad-hoc spinners.

---

## §4 Unified loading & progress system

### 4.1 System split (unify responsibility, keep two components)

Keep both components, with a hard rule for which is used where:

| Surface | Component | Rationale |
|---|---|---|
| Meal parse wait (review sheet) | `MealParseLoading` (extended with stages) | Only surface with transcript + streamed stages; deserves its bespoke pattern |
| Boot, tab loads, settings saves | `LoadingState` | Label + sublabel already fits; keep `getBootLoadingLabel` / `getTabLoadingLabel` |
| Content-shaped loads (Today page) | `Skeleton` | Layout-preserving; correct as-is |
| Everything else | No raw `.spinner` without an adjacent visible label. The orb's busy spinner is exempt (the sheet opens over it immediately) |

Delete the never-shipped `meal-review-status` / `meal-review-skeleton` CSS.

### 4.2 `MealParseLoading` target behavior

New props: `stage: ParseProgressStage | null`, `mode: 'voice' | 'text'`. `MealParseReview` passes its existing (currently ignored) `parseProgress` and `parseMode` props down. No new data plumbing — it all exists.

Layout (transcript present):

```
        “2 boiled eggs and a slice of toast”     ← parse-wait__quote (unchanged)

                  ───▰▰▰───                       ← parse-wait__shimmer (unchanged)

             Working out the numbers              ← NEW parse-wait__stage-label
```

Layout (no transcript yet — voice pre-transcription, or text path):

```
                  ( rings + mark )                ← parse-wait__stage (unchanged)

             Getting your words down              ← NEW stage label under the stage
```

Rules:

- The rings/mark block stays visible until the transcript arrives (current behavior), then the quote replaces it (current behavior) — the stage label is present in **both** phases, below the visual.
- Stage label transitions: crossfade + 4px rise, 220ms, `cubic-bezier(0.32, 0.72, 0, 1)` (the sheet's existing easing). Never horizontal steppers, never checkmarked lists.
- **Minimum hold:** a displayed stage must persist ≥ 700ms before the next replaces it. Implement as a display-side queue in `MealParseLoading` (a `useEffect` timer), not in the network layer — `advanceParseProgress` already guarantees monotonic order; skipped stages (e.g. no `looking_up` on the fast path) simply never display.
- **Long-wait reassurance:** if the same stage has displayed for > 8s, swap the label's subline in (see copy map). One swap only; no counters.

### 4.3 Stage copy map (exact strings — see §9 for full deck)

| Stage | Label | Sublabel after 8s on same stage |
|---|---|---|
| `transcribing` | Getting your words down | — |
| `identifying` | Spotting the foods | — |
| `looking_up` | Checking UK sources | Still checking — a few more seconds |
| `estimating` | Working out the numbers | Nearly there |
| `null` + `mode === 'text'` | Reading your meal | Nearly there |
| `null` + `mode === 'voice'` (pre-first-event) | Getting your words down | — |

Notes: `looking_up` is the only stage that can legitimately run long (research path); `estimating` covers the final LLM call on both paths. The text path emits no stream events (non-streaming invoke), so it holds its single label for the whole wait — honest, because we genuinely have no stage signal. *Future / out of scope:* streaming the text path like voice would enable full stages; requires an API behavior change.

### 4.4 Fast path vs research path

- Fast (~1.5–5s): typically renders one or two labels ("Reading your meal" / "Working out the numbers"). With the 700ms min-hold, a 2s parse shows at most 2 stages — no flicker.
- Research (5–25s): full sequence. `looking_up` is where time is spent; its 8s sublabel is the only "still alive" mechanism. No spinners-on-spinners, no percentage.

### 4.5 Surfacing research honestly

After results render, in the review sheet's context block (under "You said"), one quiet line when `result.research_used === true`:

> Checked against UK sources

Style: same visual weight as the existing `section-label` (0.6875rem, muted). Never show `searches_run` or `parse_path`. When `research_available === false` and `result.notes` mentions lookup being unconfigured, show `result.notes` via the existing orphaned `.meal-review-context__notes` style instead. Per-item: `source_note` appears only inside the serving-edit expansion (see §5.3), not in the default row.

### 4.6 Motion spec + reduced motion

- Idle wait: keep `parse-glow-breathe` (2.8s) but **remove one of the two rings** (`parse-wait__ring--inner`) — two staggered pulses + glow is competing motion (Principle 6). Outer ring + glow only.
- Add to `index.css` a reduced-motion block: under `prefers-reduced-motion: reduce`, `parse-wait__glow`, `parse-wait__ring--outer`, `parse-wait__shimmer::after` get `animation: none`; the shimmer track remains as a static line at 0.5 opacity; stage-label transition becomes an instant swap; `parse-quote-in` becomes opacity-only.
- The stage label itself must not pulse or shimmer — text is static; only the swap animates.

---

## §5 Review sheet spec

### 5.1 Hierarchy (target — mostly current order, with the research line added and notes rendered)

```
┌─────────────────────────────────────────┐
│              542                         │  hero calories (count-up, unchanged)
│            calories                      │
│      P 32g · C 41g · F 22g               │  MacroLine (unchanged)
│  After logging   1,842 / 2,200 cal ▓▓░░  │  goal bar (unchanged)
│                                          │
│  YOU SAID                                │
│  “2 boiled eggs and a slice of toast”    │
│  ✓ Checked against UK sources            │  NEW — only when research_used
│  ⓘ  <result.notes>                       │  NEW — only when notes present
│                                          │
│  Tweak anything that looks off…          │  hint (unchanged, hidden when all verified)
│ ┌──────────────────────────────────────┐ │
│ │ Boiled egg   [50g ▾]          156 cal│ │  name + serving pill + line calories
│ │ P 12.6g · C 1.2g · F 10.6g           │ │
│ │ [−] 2 [+]        Adjust  ⋯           │ │  stepper + tools
│ │ [        Looks good          ]       │ │  verify (full-width, unchanged)
│ └──────────────────────────────────────┘ │
│  …more items                             │
├─────────────────────────────────────────┤
│  [ Cancel ]  [ Verify 2 more items ]     │  footer (see 5.4)
└─────────────────────────────────────────┘
```

### 5.2 Default vs expanded detail

- **Default row:** name, serving pill (when available/uncertain — current `showServing` logic stands), saved-food badge, macro line, line calories. Nothing else. `confidence` is expressed only through the existing row tinting and pill presence — never as a label.
- **Expanded (serving edit, current `meal-review-serving` panel):** presets + custom grams (unchanged), **plus** two small lines: full `portion_assumption` (untruncated — the pill's 44-char cap doesn't apply here) and `source_note` when present, styled with the orphaned `.meal-review-row__source` rules. This gives curious users the "why" without taxing the default density.
- **Expanded (Adjust, current edit grid):** unchanged.

### 5.3 Serving pill + quantity rules

- Pill = *weight of one unit*; stepper = *how many units*. This is already the model; make it teachable: when the serving panel is open, label reads "Adjust serving" → change to **"Adjust serving (per item)"** for multi-quantity items only.
- Pill hidden once verified (current) — correct; verification freezes the row.
- Never show a pill for `from_saved_food` rows (current) — correct.
- Preset list stays 4 options ≤ 600g (current `servingWeightPresets`).

### 5.4 Verify flow

- **Row-tap verify:** make the row's main area (`meal-review-row__main`) tappable to toggle verified (same handler as "Looks good"), keeping the explicit button. Excludes taps on the pill, stepper, tools. Rationale: 5-item meal drops from 5 precision taps to 5 easy taps; trust semantics unchanged — still one deliberate act per item (Principle 5). Add `role="button"`/keyboard handling for a11y.
- **Auto-advance:** after verifying, scroll the next unverified row into view (`scrollIntoView({ block: 'nearest', behavior: 'smooth' })` — the pattern already exists for edit rows).
- **Footer:** stays gated (never log unverified items), but the disabled-looking button becomes an active secondary behavior: tapping "Verify 2 more items" scrolls to the first unverified row and pulses its border once (reuse `--uncertain` tint at 1 iteration). The CTA is never dead.
- Taps to log: 1-item meal = 2 taps (verify + log). 5-item = 6 taps. This is the floor given the trust model; do not add verify-all (would make the confirmation ritual meaningless).

### 5.5 Error / retry

- Sheet title: "Let's try that again" (replaces "Could not parse meal").
- Body: mapped human error (see §9), then the existing editable textarea ("Edit what you said and retry" — keep) and Retry/Close footer (keep layout).
- `formatInvokeError` fallthrough branch must never return raw `Error.message` containing "NanoGPT", "Edge Function", HTTP codes, or stack fragments — final fallback becomes the generic string in §9.

### 5.6 Loading → review transition

Keep exactly as built: `parse-wait--out` fade (350ms) → `meal-review-hero--reveal` → 24ms-staggered `meal-review-row--reveal` → count-up + `hapticSuccess`. Add only: the *last displayed stage label* fades out with the parse-wait block (no label lingering over results).

---

## §6 Voice input spec

### 6.1 States

| State | Visual (existing classes) | Hint copy |
|---|---|---|
| Idle | `sahha-voice--idle`, mark + halo breathe | "Tap to speak" (keep) |
| Listening | `--live`, level-reactive surface, timer, "Done" pill on orb | "Listening…" (keep) |
| Processing | `--busy`, spinner in orb | **"Got it — one moment"** (replaces "Processing…"); visible only for the beat before the sheet covers it |

- Keep the timer; at 60s show "Long one — tap Done when you're finished" as the hint (recording keeps going; no hard cap in UI).
- Text CTA while processing: **"One moment…"** (replaces "Working…") — and only when the sheet isn't already open (current `!reviewActive` condition stands).
- Remove the stale "Heard: …" line under the textarea (`lastTranscript` block in `MealParseInput.tsx`) — the transcript lives in the review sheet now; two homes for it is one too many.

### 6.2 Mic vs dock FAB

Unchanged relationship: dock FAB (+) navigates to `/log`; the orb on `/log` is the sole capture trigger. Do not add recording controls to the dock. The FAB's active state on `/log` (`dock__fab--active`) already communicates "you're here".

### 6.3 Dead component

Delete `src/components/VoiceWaveform.tsx` and the `.voice-waveform*` CSS block. It is imported nowhere; the orb's `--voice-level` surface is the level indicator. If a waveform is ever wanted inside the recording state, rebuild against the orb — don't keep dead code as an option.

---

## §7 Today & Trends polish

- **Error copy (P1):** `FoodEntryList.tsx` line 123 — replace interpolated technical error with "Couldn't load this day. Pull to refresh or try again shortly." (keep `console.error` for the detail). Same pass for `EditEntryForm`/`GoalsTab` error strings if they interpolate `err.message`.
- **No-goals hero (P2):** `TodayHero`'s `today-summary__empty` becomes text + inline action: "Set daily targets to track your day" + button "Set targets" wired to the same handler as the Targets tab's goals modal (`onGoalsClick` path already exists in `FoodEntryList`).
- **Tab loading consistency (P1):** every tab under Today and Trends uses `LoadingState compact` with `getTabLoadingLabel(...)` — no bare spinners, no divergent skeletons below the fold. `TodayPageSkeleton` remains for the initial full-page load only.
- **Empty states (P1):** Trends tabs must use `getStatsEmptyTitle/Body/Cta` with the CTA navigating to `/log`. Today's empty state already flows through `getEmptyState*` — no change.
- **Just-logged highlight:** keep as is (`entry-card--just-logged` has reduced-motion coverage already).

---

## §8 Token & component recommendations

Implementable changes only. "Phase" refers to §10.

| # | Change | File(s) | Before → After | Phase |
|---|---|---|---|---|
| 1 | Wire stages into parse loader: add `stage`, `mode` props; render `parse-wait__stage-label`; 700ms min-hold; 8s sublabel swap | `MealParseLoading.tsx`, `MealParseReview.tsx` (pass `parseProgress.current` + `parseMode` instead of ignoring), `index.css` | Rings/quote only → quote + honest stage copy | P0 |
| 2 | New stage-label styles + transitions | `index.css` | — → `.parse-wait__stage-label` (0.875rem, `--color-text-secondary`, 220ms crossfade/rise) | P0 |
| 3 | Reduced-motion block for parse-wait | `index.css` | 3 uncovered infinite animations → all `animation: none`, static shimmer at 0.5 opacity | P0 |
| 4 | Remove inner pulse ring | `MealParseLoading.tsx`, `index.css` | glow + 2 rings → glow + 1 ring | P0 |
| 5 | "Checked against UK sources" line + render `result.notes` | `MealParseReview.tsx` (uses existing `.meal-review-context__notes`) | research invisible → quiet trust line | P0 |
| 6 | Stage copy + error copy functions | `src/copy/experience.ts`, `src/utils/parseMeal.ts` | inline strings / raw messages → §9 deck | P0 |
| 7 | Voice hint + CTA copy ("Got it — one moment", "One moment…") | `MealParseInput.tsx` | "Processing…", "Working…" | P0 |
| 8 | Row-tap verify + auto-advance scroll + active footer scroll-to-unverified | `MealParseReview.tsx` | precision-tap verify, dead footer → tappable rows, live footer | P1 |
| 9 | `source_note` + full `portion_assumption` inside serving-edit panel (existing `.meal-review-row__source` styles) | `MealParseReview.tsx` | metadata never shown → shown on demand | P1 |
| 10 | Error title/copy in review sheet ("Let's try that again") | `MealParseReview.tsx` | "Could not parse meal" | P1 |
| 11 | Today error copy | `FoodEntryList.tsx` | interpolated technical string → §9 string | P1 |
| 12 | Delete `VoiceWaveform.tsx` + `.voice-waveform*` CSS; delete `.meal-review-status*`, `.meal-review-skeleton__*`, `.meal-review-confirm*`, `.meal-review-row__assumption*`, `.meal-review-row__hint` (verify zero references first with a grep per class) | `src/components/VoiceWaveform.tsx`, `index.css` | ~200 lines dead code → removed | P1 |
| 13 | Remove stale "Heard:" line | `MealParseInput.tsx` | duplicate transcript home → single home in sheet | P1 |
| 14 | No-goals hero inline "Set targets" action | `TodayHero.tsx`, `FoodEntryList.tsx` | dead-end sentence → actionable | P2 |
| 15 | Tab loading + empty-state consistency pass on Trends | `SummaryDisplay.tsx`, tab components | ad-hoc → `LoadingState` + `getStatsEmpty*` | P2 |

No new tokens are required — stage label, trust line, and source line all compose from existing `--color-text-secondary` / `--color-text-muted` / `section-label` patterns. This is deliberate (constraint 7).

---

## §9 Copy deck

All new/changed strings. Tone-matched to `experience.ts` (calm, plain, UK English, no exclamation marks). Add stage/trust strings as functions in `src/copy/experience.ts` so copy stays centralised.

**Parse stages** (`getParseStageLabel(stage, mode)` / `getParseStageSublabel(stage)`):

| Key | String |
|---|---|
| `transcribing` | Getting your words down |
| `identifying` | Spotting the foods |
| `looking_up` | Checking UK sources |
| `estimating` | Working out the numbers |
| text-mode default (no stage) | Reading your meal |
| sublabel: `looking_up` > 8s | Still checking — a few more seconds |
| sublabel: any other stage > 8s | Nearly there |

**Trust / research:**

| Context | String |
|---|---|
| Review sheet, `research_used === true` | Checked against UK sources |
| Review sheet, meal notes | render `result.notes` verbatim (server already writes user-safe notes) |

**Voice:**

| Context | String |
|---|---|
| Orb hint, processing | Got it — one moment |
| Orb hint, recording > 60s | Long one — tap Done when you're finished |
| Text CTA while parsing | One moment… |

**Errors:**

| Context | String |
|---|---|
| Review sheet error title | Let's try that again |
| Generic parse failure (final `formatInvokeError` fallback) | We couldn't work that one out. Edit what you said and retry. |
| Network unreachable | Can't reach Sahha right now. Check your connection and try again. |
| Session expired | Your session expired — sign in again to keep logging. |
| Recording too short/quiet | We didn't catch that. Hold the mic a moment longer and speak normally. |
| Today load failure | Couldn't load this day. Try again shortly. |

Unchanged on purpose: "Tap to speak", "Listening…", review hint ("Tweak anything that looks off…"), footer verbs ("Looks good", "Verified", "Log N items"), `getLogSuccessToast`.

---

## §10 Phased implementation plan

### P0 — honest parse progress (1–2 days, one PR)

Items 1–7 from §8. Order of work:

1. `experience.ts`: add `getParseStageLabel` / `getParseStageSublabel`.
2. `MealParseLoading.tsx`: `stage` + `mode` props, min-hold queue, 8s sublabel timer, stage label markup in both phases (pre- and post-transcript), remove inner ring.
3. `MealParseReview.tsx`: pass `parseProgress?.current ?? null` and `parseMode` through (delete the `_parseProgress`/`_parseMode` underscore aliases); add research/notes lines to the context block.
4. `index.css`: `.parse-wait__stage-label` styles + transition, reduced-motion block, delete inner-ring rules.
5. `MealParseInput.tsx` + `parseMeal.ts`: copy changes.

No API, schema, or server changes. Everything consumes data already streamed.

### P1 — review ergonomics + dead-code removal (~1 week alongside other work)

Items 8–13: row-tap verify + auto-advance + live footer; source/assumption in serving panel; error copy pass (review sheet + Today); delete `VoiceWaveform` and orphaned CSS; remove stale "Heard:" line.

### P2 — defer

Items 14–15 (no-goals action, Trends consistency pass), plus §12 appendix.

---

## §11 Acceptance criteria (P0)

Testable checklist — all must pass before P0 merges:

- [ ] Voice parse (research path, e.g. "Greggs sausage roll"): loading sheet shows, in order and without flicker, at least "Getting your words down" → transcript quote → "Checking UK sources" → "Working out the numbers", each stage visible ≥ 700ms.
- [ ] Voice parse (fast path, e.g. "2 boiled eggs"): no `looking_up` label ever appears; no stage label lingers after results render.
- [ ] Text parse: sheet shows "Reading your meal" for the full wait (no stage flicker, no blank label area).
- [ ] Waiting > 8s on `looking_up` swaps in "Still checking — a few more seconds" exactly once.
- [ ] Transcript quote remains the largest text element during the wait; stage label sits below it at secondary size.
- [ ] With OS reduced-motion enabled: no ring/glow/shimmer animation runs on the parse wait; stage labels swap without transition; parse still completes visually correctly.
- [ ] After a research-path result, "Checked against UK sources" appears under "You said"; after a fast-path result it does not; `searches_run`/`parse_path` are nowhere in the DOM.
- [ ] `result.notes`, when present, renders in the context block.
- [ ] Orb hint reads "Got it — one moment" between tap-done and sheet-open; nothing in the UI says "Processing" or "Working…".
- [ ] Cancel during any loading stage still resets cleanly (existing `resetReview` path — regression check).
- [ ] `npm run build` passes; no new console errors during a full voice log on iPhone-width viewport (390px).

---

## §12 Appendix — deferred / out of scope

- **Streaming the text parse path** for real stages (server change — the edge function only streams for voice; would mirror `streamVoiceParse` for text). Future.
- **Per-item confidence explanations** ("we assumed semi-skimmed") surfaced proactively for low-confidence rows rather than inside the serving panel. Revisit after P1 data on how often the serving panel is opened.
- **Recording hard cap / auto-stop** at N minutes with a countdown. Needs product decision on max meal-description length.
- **Onboarding modals audit** (`NameSetupModal`, `GoalsOnboardingModal`, `MicIntroModal`) and `AuthScreen` — P2 flows, not read for this spec; audit in a follow-up using the same principles.
- **Haptics map** (which interactions get light/medium/success) — currently sensible; formalise only if new interactions are added.
- Anti-patterns re-affirmed as permanently rejected: chat UI for logging, fake progress percentages, verify-all/auto-verify, raw parse metadata in UI, gamification chrome, new navigation surfaces.
