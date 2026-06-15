# 036 — Landing: add a "Full analysis" section + resequence

## Ask

The landing never showed the in-app score breakdown. Add a section that
showcases it, reusing the result page's analysis elements. Also resequence:
How it works → Analysis → Distinct cards → (rest as before).

## Design (approved)

- New `Analysis` section (`id="analysis"`) with **click-only** Face / Outfit /
  Receipt tabs, driven by the same `HERO = MOCK_GENERATIONS[DEFAULT_VERDICT]`
  mock data the hero fan uses, themed via `--verdict`.
  - **Face** → reuse `FaceAnalysisBlock` (aura ring + verdict + roast + score
    breakdown grid).
  - **Outfit** → reuse `OutfitAnalysisBlock` (fit score + tags + trait rows).
  - **Receipt** → a **trimmed** inline summary using the same `rs-*` classes
    (dating score + verdict + punchline + "photos never stored" line). The
    result page's Export/Share/Save/New-scan buttons are intentionally dropped —
    they're result-only actions and would re-introduce the "too many scan
    buttons" problem.
  - Conditional render (not hidden) remounts the active block, so its count-up
    animations replay on each tab switch; `run` is gated on `useInView`.

## Implementation

- `Landing.tsx`: import `FaceAnalysisBlock`/`OutfitAnalysisBlock`,
  `VERDICT_LABEL`, and `result-shell.css`. New `Analysis()` component. Render
  order now `Hero → How → Analysis → Artifacts → Modes → Credits → Privacy →
  FinalCTA → Footer`. Section rail reordered + renumbered (+ "Full analysis"
  entry, initial active `how`). Footer Product links reordered + "Full analysis".
- `landing.css`: `.ln-an-tabs` / `.ln-an-tab` / `.ln-an-panel` (segmented tabs +
  760px panel cap). Analysis section is plain (not `.alt`) so it doesn't stack a
  second tint under the `.alt` How section.

The analysis blocks' `rs-block`/`rs-analysis` styles are self-contained in
`result-shell.css`, so they render correctly outside the result page.

## Verification

Dev server + Playwright. Desktop (1280) + mobile (393): all three tabs render
correctly; count-ups settle to the real values (AURA 92, fit 91, dating 9.1);
receipt has no action buttons; section order is
`how → analysis → outputs → modes → credits → privacy`.

## Addendum — fill the empty right half (desktop)

The panel was capped at 760px and left-aligned, leaving the right ~40% empty.
Each Face/Outfit tab already renders two blocks (intro + breakdown), so on
desktop (`min-width:980px`) the panel becomes a 2-column grid — intro on the
left, detailed breakdown on the right — filling the width. The Receipt tab is a
single block, so it gets a `.single` modifier that keeps it `display:block`,
capped at 640px. The grid override uses `.ln-an-panel.rs-analysis` specificity
because `result-shell.css` (which sets `.rs-analysis { display:flex }`) loads
after `landing.css`. Mobile still stacks (flex column). Verified all three tabs
at 1320 + 393.

## Files

- `apps/web/src/features/landing/Landing.tsx`
- `apps/web/src/design/landing.css`
