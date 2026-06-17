# 049 — Landing + Result UX refresh (partial-scan-aware)

Feature branch `feat/ux-refresh`, built subagent-driven from
`docs/superpowers/plans/2026-06-17-landing-result-ux-refresh.md` (spec:
`docs/superpowers/specs/2026-06-17-landing-result-ux-refresh-design.md`). Frontend + copy
only — no scoring/schema/edge change, no redeploy. `tsc` clean, **116 tests** (+3 new),
`vite build` OK.

## Landing
- **Hero** now shows three **character face cards** (GigaChad center · Patrick Bateman · McLovin),
  fanned, reusing the real `FaceCard` with fixed `HERO_CHARACTERS` mock content + roast lines.
  GigaChad reuses `assets/example-face.jpg`; McLovin + Bateman are new assets.
- **Removed the full-breakdown section** (the tabbed `Analysis` block) + its section-rail entry
  and footer link — it was the wordiest block.
- **Distinct-cards section** rebuilt as two columns: left a **tappable `CardFan`** (Face →
  Outfit → Receipt; tap the front card → it cycles to the back), right a **2×2 grid of compact
  breakdown blocks** (`fanBreakdown(front)`) that **syncs to the front card** (face = lime tiers,
  outfit = blue accent, receipt = verdict stats), plus a one-line caption.
- **Copy** trimmed + partial-scan contradictions fixed ("two photos"/"three cards"/"all three"
  → photo-agnostic) across hero/how/credits/privacy/final-CTA.

## Result
- **Two-column compact breakdown**: the face `Score breakdown` GymCards are denser, and the
  outfit `Fit & physique read` (was 1-col `TraitRow`s) is now a 2-col grid of the same compact
  block style (blue-accented, icon-less; `capFor` exported from `TraitRow` for reuse). Receipt
  untouched.
- **Roast on the cards**: a borderless quote line under the verdict on `FaceCard`
  (`analysis.roast`) and `OutfitCard` (`analysis.verdict`), via a new optional `roast` prop. It's
  passed on the visible card **and** the offscreen export host, so the shareable PNG includes it.
  Because the source is existing `analysis.*` data, it works for already-saved verdicts with no
  migration/redeploy. The separate "The roast" analysis block was dropped.

## Copy (scan / vault)
- Solo mode blurb, vault empty state, "new scan" tile sublabel, and the scan reveal subs all
  trimmed/partial-scan-fixed. Scan-stage flavor microcopy + "for the bit, not science" kept.

## Notes
- `cardFan.ts`/`cardFan.test.ts` were renamed to `cardFanCycle.ts`/`.test.ts` to avoid a
  case-insensitive filename collision with `CardFan.tsx` on Windows.
- `.gstack/` (browser-QA scratch dir) added to `.gitignore`.
- Final pixel-level visual QA (fan scale, card-roast fit, mobile stacking) is the remaining
  sign-off; the fan cycling + sync was browser-dogfooded during Task 8.
