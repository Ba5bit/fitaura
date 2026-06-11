# 004 — Outfit "Fit & Physique Read": supporting stats group

**Date:** 2026-06-11
**Scope:** Outfit Analysis Block (`/result#outfit`).
**Ask:** keep the existing 4 metrics unchanged; add an optional group of 3–4 new
supporting physique stats below them, visually secondary, with a short reason each.

---

## What changed

The four main metrics (Silhouette, Proportions, Fit, Physique Match) are untouched.
Below them, an optional **"Supporting read"** group renders 4 new stats:
Shoulder Definition, Waist Definition, Leg Length Effect, Body Balance — each with a
score, a **segmented neon indicator**, and a one-line reason.

These are *new* metrics — they never repeat the main four.

### Files

- `packages/shared/src/result.ts` — new `SupportingStat { id, label, value, note }`;
  `OutfitAnalysisContent.supporting?: SupportingStat[]` (optional, so the group is
  conditional and other flows/AI can omit it).
- `apps/web/src/data/mockGenerations.ts` — `supporting` arrays for all 3 verdicts
  with verdict-appropriate scores + short notes (red flag = top-heavy/weak waist,
  green flag = balanced/elite, normie = neutral).
- `apps/web/src/components/analysis/SupportingStat.tsx` — new component: count-up
  value + 10-segment bar (filled = `round(value/10)`) + note.
- `apps/web/src/components/analysis/OutfitAnalysisBlock.tsx` — renders the group
  under the existing `.rs-traits`, gated on `supporting?.length`.
- `apps/web/src/design/components.css` — `.rs-subhead` / `.rs-subgrid` /
  `.rs-substat` / `.seg` styles.

## Visual rules honored

- **Secondary by design:** smaller, dimmer (`--ink-dim`/`--ink-faint`), bordered
  transparent panels (`rgba(255,255,255,.025)` + `--hair-soft`) vs the main metrics'
  bold full-width neon bars. Segmented (not solid) indicator reinforces subordination.
- Gym-app/transparent aesthetic, neon-cyan `--accent` segments. **No solid purple.**
- 2-column grid on desktop, **single column under 560px** (no horizontal overflow).
- Compact — minimal added page height.

## Verification

- `npm run typecheck` + `npm run build` clean.
- Playwright: Outfit tab shows the unchanged 4 main bars + a "SUPPORTING READ ·
  4 more · optional" divider + 4 substats. Desktop grid = 2 cols (`287px 287px`),
  segments on = 25/40 (8+5+6+6 for 82/54/61/58). Mobile stacks single-column.

## Note for the AI integration

The model already carries `supporting`; when the vision backend lands, populate it
the same way (optional, 3–4 items, never repeating `card.scores`). The frontend
renders 0 or N gracefully.
