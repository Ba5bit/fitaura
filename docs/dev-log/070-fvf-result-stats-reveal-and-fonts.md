# 070 — FvF result: new stat set, first-view reveal, Solo-matched copy

**Date:** 2026-06-24
**Area:** Friend vs Friend result deck (`apps/web/src/features/versus`, `packages/shared/src/versus`)

Polish pass on the head-to-head result, from two screenshots of the face/outfit
tabs. Four asks, plus one font fix that turned out to be the same spot as the
"inconsistent text" ask.

## What changed

### 1. New stat sets (the "boring metrics" ask)
The head-to-head metrics are defined **once** in `packages/shared/src/versus/metrics.ts`
(`FACE_METRICS` / `FIT_METRICS`). That single array drives three things automatically:
- the Gemini **structured-output schema** (`prompt.ts` `scoresObjectFor`, keyed by `key`),
- the **system instruction**'s metric list (`FACE_LIST` / `FIT_LIST`),
- the **assemble** step that stamps `label` onto each `Metric` (`assemble.ts` `toMetrics`).

So renaming is a one-file edit. New sets (down from 5 to 4 each):
- **Face:** `Jawline · Hairline · Rizz · Aura`
- **Outfit:** `Drip · Physique Match · Pose · Confidence`

Added a one-line gloss in the prompt for the coined/slang terms (Rizz, Aura,
Physique Match, Pose, Confidence) so the model scores them as intended.

**Gotcha — this needs a manual `versus-scan` edge redeploy to show on live battles.**
The deployed edge function bundles its own copy of `prompt.ts` + `aiSchema.ts`, so
until it's redeployed, real AI battles still score the OLD keys. The dev/seeded
path (`generateMetrics`) uses the client's `metrics.ts`, so it updates instantly —
which is how this was verified locally without spending credits.

Three test files key off the canonical metric keys and the count of 5 — updated:
`assemble.test.ts`, `aiSchema.test.ts`, `computeBattle.test.ts` (5 → 4).

### 2. First-view stats reveal (suspense stagger)
Plays **once**, only right after a scan finishes — never on refresh, tab-flip, or a
vault reopen, and never under reduced-motion.

- `VersusScan` sets a one-shot `sessionStorage['fvf:reveal']='1'` on the "Reveal the
  verdict" click (right before navigating to `/versus/result`).
- `VersusResult` captures it into `firstView` and a per-section `playedRef` guard.
- `ComparisonTab` freezes the decision at mount (`useState(reveal)`), threads it to
  the two `Column`s (big score counts up) and each `SplitBar` (row fades up, bar fills
  from empty, numbers count up — staggered top-to-bottom by `index`, 110ms each).
- `useCountUp` gained an optional `delayMs` for the per-row stagger (backward-compatible).

**StrictMode gotcha (the real trap here):** the obvious version read **and removed**
the flag inside the `useState` initializer. Under StrictMode the initializer is
double-invoked (impure → first call sees the flag, second sees it gone), so the reveal
would silently never fire in dev. Fix: the initializer is a **pure** read
(`getItem === '1'`, idempotent across the double-invoke); the flag is cleared in a
separate `useEffect`, which runs after the value is already captured. Also froze the
reveal at `ComparisonTab` mount so a stray parent re-render can't flip `reveal` false
mid-animation and snap the count-ups to final.

### 3. The inconsistent text → contender-coloured verdict line (asks #2/#5, iterated)
`.vs-sidecopy` (the per-side flex + burn copy) was the culprit: side B was force
`text-align: right` while side A read centered, both tiny (12–12.5px) mono-ish text.
Iterated live with the user to the final treatment:
- **Burn line removed** — only the flex (the "verdict") shows now (`<p class="roast">`
  dropped from `Column`; `SideCopy.roast` stays in the AI payload, just unused in UI).
- **Centered** under the column (matches the centered name/score/chips).
- **Pull-quote card** (final): a bordered, contender-tinted box (`border` + `background`
  at `color-mix(var(--c) …)`) with the text **left-aligned**, in the **FITAURA wordmark
  font (Hanken Grotesk 800, 14px)**, wrapped in curly quotes via `::before`/`::after`.
  Text reads in the contender's **blue/gold** (`color-mix(var(--c) 82%, #fff)`), quote
  marks in the solid contender colour. (Iterated through Anton-uppercase-centered → a
  white-text variant → back to the contender colours the user preferred.)

(Verified on a seeded `fvf:result` with copy injected into sessionStorage — the seeded
`generateMetrics` path alone renders no side copy.)

### 4. Bigger outfit photos
`.vs-fitframe` width `clamp(108px,11vw,142px)` → `clamp(132px,14vw,178px)`. Face
avatars untouched — the outfit is the subject of that tab.

### 5. Fresh fixed palette + yellow crown (image-accent explored, then reverted)
The icy/gold deck felt bland. First tried **photo-matched per-contender colour** (a
client-side vibrancy read of each outfit photo, clamped for legibility) — worth noting
the learning that surfaced: the accent must come from the **outfit, never the face**,
since reading a colour off a face is skin tone, which is off-brand and wrong for
darker-skinned players. It worked end-to-end, but the user preferred **fixed** colours,
so the whole image-accent path was reverted (extractor, `--ca/--cb` plumbing, the shared
`clampAccentHex` addition — all removed).

Final: a **varied, muted palette set**. The mechanism is a **scoped token override** —
`--icy` (A) / `--gold` (B) set **inline on `.vs-result-app`** per battle. Because the
entire FvF result (deck, verdict panel, share card) already paints off `--icy`/`--gold`,
overriding those two on the result root repaints everything at once with **zero** changes
to the ~30 usages, and Solo Scan's global tokens are untouched.
- Colour journey: electric-blue/orange "too bright" → muted → "vary per matchup" →
  "vibrant" jewel tones → finally **Solo Scan's own tokens** (the user pointed at Solo's
  score-breakdown as the reference). Landing point: `PALETTES` (in `VersusResult`) =
  **A always icy `#83b4ff`** (Solo's brand accent), **B varies** per matchup among Solo's
  other distinct accents — **`--lime #b6ff3c` / `--gold #ffcf66` / `--red #ff3b49`** (cyan
  clashes with icy A; magenta is the blue+pink combo the user dislikes — both omitted). A
  string hash of `"<A>|<B>"` picks one — **deterministic so a matchup is stable**. Applied
  inline on the root; the export card's `accentHex` comes from the same pair (via `VerdictTab`).
- The **winner crown** went white → **yellow `#ffd23f`** (`.vs-crown`, soft yellow glow);
  no contender colour collides with it.
- **Glow pass** (playful "VS" energy): the bars use Solo's score-breakdown style
  (`.gc-bar` — a lighter→full gradient that brightens toward the centre divider + a glow
  line), plus a lit white "VS" and a faint neon edge on the quote cards — all off `--c`/
  `--icy`/`--gold`, so they follow whichever palette the matchup drew. **Numbers/scores are
  kept crisp (no glow** — the user nixed glowing numbers, so the score, per-metric, and
  winner-number text-shadows were removed).

### 6. Score badge, player label, bigger outfit photos overlaid (no-scroll)
Modelled on a Solo card (`.score-badge`) + the user's screenshot:
- Score became a **bordered "SCORE" badge** (small mono label over the Anton number, in a
  contender-coloured pill with a soft glow), and a **"PLAYER A/B" eyebrow** sits over the name.
- **Outfit photo enlarged** to ~`clamp(186px,21vw,248px)` (fills the column).
- **Outfit tab overlays the player/name (bottom-left) + score badge (top-right) ON the
  photo** (scrim for legibility) instead of stacking them below — which is also the
  **no-scroll** fix: moving that block onto the photo keeps the column short enough that
  the result fits the viewport. `Column` branches on `category`: face keeps name/score
  below the round avatar; outfit puts them inside `.vs-fitframe` (`.fit-tr` / `.fit-bl`).
- Measured at a 770px-tall viewport: both tabs `scrollHeight === innerHeight` (no scroll).
  (An early 66px-over reading was a pre-layout timing artifact, not a real overflow.)

## Verification
- `npm run typecheck` clean (web + shared); full suite 187 passing (the one failing
  *file*, `creditsService.refund.test.ts`, is a pre-existing env gate — imports the
  Supabase client which throws without `VITE_SUPABASE_*`).
- Browser smoke (seeded `/versus/result`): new labels on both tabs, bigger photos,
  reveal engages (`data-reveal="1"` + stagger, count-ups land on correct finals), zero
  console errors. **Palette:** different matchups pick different muted pairs (verified
  the hash across 6 names → 4 distinct pairs); Kanye|Kendrick → root `--icy #6f93b8` /
  `--gold #c47a55`, bars resolve to those, crown `rgb(255,210,63)` (yellow); whole deck +
  quote cards recolour, A/B stay distinct.

## Status
- **`versus-scan` redeployed** (new metric set live on real AI battles).
- All client changes (stats, reveal, fonts/quote, photos, fixed palette + crown) are
  local / uncommitted — push held per the iterate-then-push rule.
