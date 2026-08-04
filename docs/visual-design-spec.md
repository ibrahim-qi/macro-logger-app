# Sahha Visual Design — Implementation Spec

**Problem:** the ux-spec delivered copy and behaviour polish, but the app *looks* the same. The user wants a real visual change: clean, sleek, minimal, premium AI product — and visibly different from today.

**Permission granted for this spec only:** `@theme` token changes and component layout changes. Still no new routes, tabs, or features. The verify flow and dock IA are untouchable (§E3).

---

## §A Current-state audit

Read: `src/index.css` (`@theme`, `.sahha-voice*`, `.parse-wait*`, `.meal-review-*`, `.log-hero*`, `.dock*`, `.hero-panel*`), `LogHero.tsx`, `MealParseInput.tsx`, `MealParseLoading.tsx`, `MealParseReview.tsx`.

What's there today: deep navy base (`--color-bg: #07090f`), flat surfaces one step lighter, **1px borders on everything** (`--color-border-soft` appears on cards, pills, dock, orb, inputs, rows), a deliberately desaturated slate accent (`#8a96a8`), white CTA fill, Outfit display + DM Sans body. Comments in the CSS say "flat, minimal" and "premium" — the intent is Linear-dark, but the execution reads as **monochrome timidity**:

- **Nothing dominates.** The Log page's hero — the voice orb, the product's entire identity — is a 8.5rem grey circle with a 1px border and a grey glyph, visually equal in weight to the date pill above it and the textarea below it. Everything on every screen is a bordered grey rectangle at 0.8125rem.
- **No depth model.** One surface colour + border = every container. There's no elevation language (the only shadows are `--shadow-soft`, a 1px inset highlight, and one drop shadow on the dock), so hierarchy is carried entirely by borders, which flattens it.
- **The accent doesn't accent.** `--color-accent` is grey-blue (`#8a96a8`); the "glow" tokens are near-transparent white; `--color-brand-glow` is literally `transparent`. Verified state borrows a raw Tailwind green (`#86efac` / `rgba(34,197,94,…)`) that exists nowhere in the token set — the one moment of colour in the review flow is off-palette.
- **Hardcoded slate hex values everywhere** in the review sheet (`#94a3b8`, `#64748b`, `#cbd5e1`, `rgba(15,23,42,…)`) — remnants of Tailwind slate, slightly bluer than the token palette, so the sheet is subtly two different greys.
- **Review rows are a spreadsheet.** `border-bottom` list, 2px left-border status hacks (`--pending`, `--uncertain`) that shift `margin-left` negative, small grey buttons (`meal-review-tool-btn`, `meal-review-verify` at `0.8125rem`) stacked full-width. Dense and administrative — the opposite of "AI did the work for you".
- **The loading state is the best screen in the app** (breathing glow, quote, shimmer, stage labels) — and it's the only screen with any life. That's backwards: the *product* screens should carry the identity.

Verdict: the bones (type pairing, dark base, spacing discipline) are good. What's missing is **one signature element, one real accent, and a depth model**.

## §B Design direction — pick one

| Option | Fit |
|--------|-----|
| "Apple Health calm" — softer cards, whitespace | Wrong temperature: it's a light-mode, card-grid language; adopting it means abandoning the dark foundation that already works |
| "Linear dark" — sharper type hierarchy, fewer borders | Half-right — border removal and type hierarchy are needed — but it's a *tool* aesthetic; it won't make Sahha look different, it'll make it look like the current app done slightly better |
| **"Voice-first hero"** — orb + transcript dominate, chrome recedes | ✅ **Chosen.** It's the only direction that's *about this product*: you talk, it understands. The orb becomes the identity; everything else gets quieter so it can |

**Committed direction: Voice-first hero**, executed with Linear-dark discipline (that's the "how", not the "what"). Three rules everything below follows:

1. **One signal colour.** A single mint-sage accent (`--color-signal`) used *only* for: live/listening states, verified states, progress fills, and the FAB. Never for text links, never decorative. Everything else stays neutral.
2. **Elevation replaces borders.** Containers are either *flat on the background* (no border, no fill) or *raised* (fill + ambient shadow, no border). The 1px border grid disappears except on inputs.
3. **The orb is the hero, twice.** Big and alive on the Log page; echoed as the mint FAB in the dock. Every other element drops one level of visual weight to pay for it.

## §C Concrete visual spec

### C1. Token changes (`@theme` in `src/index.css`)

```css
/* CHANGED */
--color-bg: #05070c;                         /* one step deeper — gives surfaces room */
--color-surface: #0d1119;
--color-surface-2: #131926;
--color-surface-3: #1a2233;
--color-border: #202a3c;                     /* inputs + hairlines only after §C rules */

/* NEW — signal accent (mint-sage, the only colour in the app) */
--color-signal: #7ee0b0;
--color-signal-rgb: 126, 224, 176;
--color-signal-soft: rgba(126, 224, 176, 0.12);
--color-signal-glow: rgba(126, 224, 176, 0.22);

/* NEW — depth model */
--shadow-raised: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.32);
--shadow-float: 0 2px 6px rgba(0, 0, 0, 0.45), 0 16px 48px rgba(0, 0, 0, 0.5);

/* NEW — radius scale (replace ad-hoc 0.5/0.625/0.75/1/1.25/1.5rem spread) */
--radius-control: 0.75rem;
--radius-card: 1.25rem;
--radius-sheet: 1.75rem;
```

Retire in place (keep tokens, update values/usages): `--color-success` → `var(--color-signal)`; `--color-health` → `var(--color-signal)` (they're near-duplicates today). Migration task: replace the hardcoded slate hexes in `meal-review-*` and `parse-wait__quote` with `--color-text-secondary` / `--color-text-muted` / `--color-surface-2` equivalents — one mechanical pass, big consistency win.

Macro colours (`--color-protein/carbs/fats`) stay — they're data encoding, not decoration.

### C2. Typography scale (`.type-*` classes + component styles)

- `.type-display`: 3rem → **3.75rem**, weight 600 → **650** (Outfit variable supports it; else keep 600). Hero numbers must be unmissable.
- `.log-hero__prompt`: 1.5rem → **1.875rem**, `max-width: 19rem → 17rem` (bigger, tighter measure).
- Kill the 0.6875rem tier for anything the user must read (`meal-review-goal__header`, `meal-review-remember__hint`, dock labels stay — they're glanceable). Minimum readable body: 0.8125rem.
- `.section-label`: letter-spacing 0.04em → **0.08em**, uppercase via `text-transform` — make eyebrow labels actually read as eyebrows.

### C3. Log page (`.log-hero`, `.sahha-voice--log`, `.log-type-section`)

Target layout:

```
        [ date — text button, no pill ]

        Log your meal                      ← 1.875rem prompt
                                           (helper line deleted)

              ╭────────────╮
              │            │
              │    ORB     │               ← 10.5rem, gradient surface
              │            │
              ╰────────────╯
             Tap to speak                  ← unchanged hint system

   ┌───────────────────────────────┐
   │ …or type it        [ ↑ ]      │       ← single-line ghost field
   └───────────────────────────────┘
```

- **Orb** (`.sahha-voice__orb--log`, `.sahha-voice__surface`): 8.5rem → **10.5rem**. Surface: replace flat `--color-surface-2` + border with a layered radial —
  `radial-gradient(circle at 38% 30%, #1c2536 0%, #10151f 55%, #0b0f16 100%)`, **no border**, `box-shadow: var(--shadow-raised)`. Live state: existing halo/ring system stays, but recolour from white/accent to `--color-signal` (`.sahha-voice__orb--live .sahha-voice__ring` border → `rgba(var(--color-signal-rgb), 0.5)`; halo gradient → signal). The `--voice-level` reactive halo scale already exists — raise the multiplier `0.18 → 0.3` so speech visibly moves it.
- **Delete `.sahha-voice__divider`** (the animated line between hero and orb) — it's chrome competing with the hero. Remove element in `MealParseInput.tsx` + all `sahha-voice__divider` CSS (~90 lines, including its reduced-motion rules).
- **Date** (`.log-hero__date`): render the existing DatePicker `variant="pill"` restyled as a borderless text button — `background: none; border: none; color: var(--color-text-muted)` (new `.date-pill--quiet` modifier; DatePicker gains a `tone` prop or LogHero passes a className).
- **Helper line** (`.log-hero__helper`): delete from `LogHero.tsx` — its content ("speak or type…") is duplicated by the hint under the orb and the type field.
- **Type-in section** (`.log-type-section`): textarea card → **single-line ghost field**: `input` (not textarea) with `background: transparent; border: 1px solid var(--color-border); border-radius: 999px`, placeholder "…or type it", and an inline circular submit button (↑) inside the field's right edge, filled `--color-btn-fill` when text is non-empty. The "or type" divider label with `::before/::after` lines: delete. Multi-line entry still works — the field grows into the existing review/retry flows unchanged; typing long meals in one line is fine (voice is the primary path). Keep `Enter` = submit.

### C4. Parse loading sheet (`.parse-wait*`)

Small changes only — this screen already works, it just joins the new palette:

- Glow/ring/shimmer colours: accent-grey → `--color-signal` at the same opacities (`.parse-wait__glow`, `.parse-wait__ring`, `.parse-wait__shimmer::after`).
- `.parse-wait__quote`: 1rem → **1.125rem**, drop `font-style: italic` (italic reads apologetic), colour → `--color-text-primary`. The transcript is the star of this screen — the user checking "did it hear me right" is the whole job.
- Stage label/sublabel: unchanged (ux-spec owns them).

### C5. Review sheet (`.meal-review-*`, `Modal` sheet)

The big one. Rows become cards; status becomes tint, not border-hacks; verify becomes the obvious primary gesture.

- **Sheet container** (`.modal-panel`): radius 1.5rem → `var(--radius-sheet)`; add `box-shadow: var(--shadow-float)`; keep heights.
- **Hero calories** (`.meal-review-hero__calories`): 3rem → **3.75rem** (matches new `.type-display`). Under the `MacroLine`, no other change — the count-up stays.
- **Goal bar** (`.meal-review-goal`): delete the top/bottom borders (rule 2); track height 3px → **6px**; fill → `linear-gradient(90deg, rgba(var(--color-signal-rgb), 0.55), var(--color-signal))`; header text 0.6875rem → 0.75rem.
- **Rows** (`.meal-review-row`): `border-bottom` list → **stacked cards**:
  ```css
  .meal-review-row {
    border: none;
    border-radius: var(--radius-card);
    background: var(--color-surface);
    padding: 0.875rem 1rem;
    margin-bottom: 0.625rem;
    box-shadow: var(--shadow-soft);
  }
  ```
  Status: delete the `--pending`/`--uncertain` left-border + negative-margin hacks. Pending = default card. Uncertain = `background: var(--color-surface-2)` + the existing serving/"Estimated portion" affordances. **Verified = signal tint**: `background: var(--color-signal-soft); box-shadow: inset 0 0 0 1px rgba(var(--color-signal-rgb), 0.25)` — the row itself visibly "settles" when verified, and the whole-card ring replaces the off-palette green button border. `--pulse` keyframe recolours to signal.
- **Verify button** (`.meal-review-verify`): grey bordered bar → **pill**: `border-radius: 999px; border: none; background: var(--color-surface-3); color: var(--color-text-primary); font-size: 0.875rem`. Done state: `background: var(--color-signal-soft); color: var(--color-signal)`. (Row-tap verify from the ux-spec still works; the pill is the visible affordance.)
- **Tool buttons** (`.meal-review-tool-btn`, `.meal-review-menu-trigger`, stepper): drop borders → `background: var(--color-surface-2); border: none; border-radius: var(--radius-control)`; replace slate hexes with tokens.
- **Context block** (`.meal-review-context`): "You said" transcript gets the C4 treatment (0.9375rem, primary colour, no clamp change); trust line (`__trust`) prefixed with a 6px signal dot (`::before` circle) instead of plain grey text — the one place research earns its colour.
- **Remember checkbox** (`.meal-review-remember`): border → none, `background: var(--color-surface-2)`; checked state → signal-soft (replace accent-rgb usage).

### C6. Today (`.hero-panel`, `.macro-strip`, `.entry-card`) — P1

- `.hero-panel`: delete border; `background: linear-gradient(180deg, var(--color-surface-2), var(--color-surface))`; `box-shadow: var(--shadow-raised)`; cal-value inherits the 3.75rem display size; cal-fill → signal gradient (same as goal bar).
- `.macro-strip__fill--*`: unchanged colours (data), but track height 3px → 5px for parity.
- `.entry-card`: the 4 meal-type left-border colours stay (useful encoding) but move from `border-left` to a 3px inset rounded bar (`::before` pill), letting the card itself go borderless + `--radius-card`.

### C7. Dock (`.dock*`)

- `.dock__inner`: delete the 1px border; `background: rgba(9, 12, 18, 0.88)`; keep blur; shadow → `var(--shadow-float)`; radius 1.125rem → `var(--radius-card)`.
- **FAB** (`.dock__fab`): white square-round → **signal circle**: `border-radius: 50%; background: linear-gradient(160deg, #8ee9bd, #5fc492); box-shadow: 0 4px 16px rgba(var(--color-signal-rgb), 0.35)`; glyph/icon colour `#06281a` (dark-on-mint). This is the orb's echo — the one coloured object on every screen, always meaning "log".
- Active link: label colour change stays; add a 4px signal dot under the active icon (`.dock__link--active::after`). Remove `--color-btn-fill` dependency from the dock entirely.
- Check `btn-primary` stays white — the FAB being mint while CTAs stay white is intentional (log-action vs. confirm-action).

### C8. Motion

Add (all behind the existing `prefers-reduced-motion` block, which already covers orb/parse-wait — extend it for each new animation):

- **Orb idle breathe**: 4s scale 1 → 1.015 → 1 on `.sahha-voice__surface` when idle (today only the live state moves; idle should feel alive-but-asleep).
- **Verify settle**: on `--verified` application, one 300ms scale 1 → 0.985 → 1 on the row card (pairs with the existing haptic).
- **FAB press**: existing `scale(0.94)` fine; add signal glow bloom on `:active` (`box-shadow` transition).

Remove:

- The divider's three animation moods (deleted with the divider, §C3).
- `.parse-wait__ring--outer` pulse **stays**; nothing else removed — rings, shimmer, count-up all survive (they're now on-palette).

## §D Before → after table

| Element | Current class/pattern | Proposed change | File |
|---|---|---|---|
| Palette accent | `--color-accent #8a96a8` grey-blue, transparent glows | new `--color-signal #7ee0b0` mint; accent demoted to text-only | `index.css @theme` |
| Background | `--color-bg #07090f` | `#05070c`, surfaces re-stepped | `index.css @theme` |
| Depth | 1px `--color-border-soft` on ~every container | borders deleted; `--shadow-raised`/`--shadow-float` + surface fills | `index.css` (many) |
| Voice orb | 8.5rem, flat `surface-2`, 1px border | 10.5rem, layered radial gradient, no border, raised shadow, signal live-state | `index.css .sahha-voice__*`, `MealParseInput.tsx` |
| Voice divider | `.sahha-voice__divider` 3-mood animated line | deleted | `MealParseInput.tsx`, `index.css` |
| Log prompt | `.log-hero__prompt` 1.5rem + helper line | 1.875rem, helper deleted | `index.css`, `LogHero.tsx` |
| Date control | `.date-pill` bordered pill | `.date-pill--quiet` borderless text button | `index.css`, `LogHero.tsx`/`DatePicker.tsx` |
| Text entry | textarea in bordered card + "or type" ruled label | single-line ghost pill field w/ inline submit; label deleted | `MealParseInput.tsx`, `index.css` |
| Loading quote | `.parse-wait__quote` 1rem italic slate | 1.125rem regular, text-primary | `index.css` |
| Loading glow/rings | accent-grey | signal | `index.css .parse-wait__*` |
| Review hero | `.meal-review-hero__calories` 3rem | 3.75rem | `index.css` |
| Goal bar | 3px, bordered section | 6px signal gradient, borders deleted | `index.css .meal-review-goal*` |
| Review rows | `border-bottom` list + left-border status hacks | stacked radius-card surfaces; verified = signal-soft tint + inset ring | `index.css .meal-review-row*` |
| Verify button | grey bordered bar, off-palette green when done | borderless pill, signal-soft when done | `index.css .meal-review-verify*` |
| Row tools/stepper | bordered slate-hex chips | borderless `surface-2` chips, tokens | `index.css .meal-review-tool-btn` etc. |
| Trust line | plain grey `section-label` | signal dot prefix | `index.css .meal-review-context__trust` |
| Dock bar | bordered pill | borderless frosted + float shadow | `index.css .dock__inner` |
| Dock FAB | white rounded square | mint gradient circle, glow, dark glyph | `index.css .dock__fab*` |
| Active tab | label colour only | + signal dot | `index.css .dock__link--active` |
| Today hero | bordered flat card | borderless gradient panel, raised | `index.css .hero-panel*` |
| Entry cards | `border-left` meal colours on bordered card | borderless card + inset colour pill | `index.css .entry-card*` |
| Slate hex debt | `#94a3b8`/`#64748b`/`#cbd5e1`/`rgba(15,23,42,…)` scattered | replaced with tokens | `index.css` (review sheet, retry, hints) |

## §E Phased plan

### E1. P0 — the visible change (≤ 1 week, 2 PRs)

**PR 1 — tokens + Log page + dock** (the first-impression surfaces):
tokens (§C1), type scale (§C2), orb + divider deletion + ghost field + hero (§C3), dock + FAB (§C7), orb idle breathe (§C8). One screenshot before/after in the PR description.

**PR 2 — review sheet + loading:**
row cards + verify pill + goal bar + context/trust + slate-hex token migration (§C5), loading recolour + quote (§C4), verify-settle motion (§C8).

Acceptance (both PRs): every changed state visits light of `prefers-reduced-motion: reduce` (no new animation escapes the media query); no layout shift in the verify flow (row-tap targets, footer CTA logic untouched); Lighthouse a11y contrast pass on signal-on-surface combinations (`#7ee0b0` on `#0d1119` is ~9:1 — fine; dark-on-mint FAB glyph `#06281a` on `#8ee9bd` ~8:1 — fine).

### E2. P1 — polish (following week)

Today hero + macro strip + entry cards (§C6); toast restyle to match (borderless, raised); trends screen parity pass; settings/goals forms adopt `--radius-control` chips.

### E3. Explicitly NOT changing

- **Verify flow logic** — row-tap, auto-advance, footer "Verify N / Log N" CTA, remember checkbox behaviour (ux-spec P1, already shipped).
- **Dock IA** — same 4 tabs + centre FAB, same routes, same labels.
- **Stage-label system, copy deck, haptics** — owned by ux-spec.
- **Macro data colours** (protein/carbs/fats hues) — encoding, not theme.
- **Fonts** — Outfit + DM Sans stay; this is a palette/depth/hierarchy redesign, not a rebrand.
- No light mode, no theming system, no new dependencies.
