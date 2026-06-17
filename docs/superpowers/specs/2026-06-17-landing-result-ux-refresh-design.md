# Landing + Result UX Refresh — Design

**Date:** 2026-06-17
**Status:** design — awaiting user review before writing-plans

A presentation-layer refresh that makes the landing punchier and the result page denser,
and brings all copy in line with **partial scans** (face-only / outfit-only / both). No
backend, scoring, schema, or edge-function changes — frontend + copy only, so it ships via a
normal push (no edge redeploy). A later, separate effort will add the user's new card
designs; this spec does not cover those.

---

## 1. Landing — Hero: three character face cards

Replace the current Face/Outfit/Receipt fan in the hero with **three character FACE cards**,
fanned mid-roll (same tilted, "about to roll" look), GigaChad front-and-center:

- **GigaChad** (front, center) — existing asset `apps/web/src/assets/example-face.jpg`.
- **McLovin** (behind) — new asset, provided by user (source `Downloads/images (1).jpg`).
- **Patrick Bateman** (behind) — new asset, provided by user (source
  `Downloads/bab1b52fee55efe0eb9646e6d0283c8f.jpg`).

New images are copied into `apps/web/src/assets/` (e.g. `hero-mclovin.jpg`,
`hero-bateman.jpg`) and imported. These are **static showcase cards** — each reuses the real
`FaceCard` component with fixed mock `FaceCardContent` (archetype line, aura, 4 scores,
sticker, image). New mock data `HERO_CHARACTERS` (3 `FaceCardContent`) lives in
`apps/web/src/data/mockGenerations.ts`. Suggested: GigaChad "GIGACHAD / AURA 99", Patrick
Bateman "SIGMA / 93", McLovin "HONORABLE MENTION / 84" — final copy tunable.

The hero layout (headline, sub, CTAs, trust pills on the left; fanned cards on the right) is
otherwise unchanged.

## 2. Landing — remove the "Full breakdown" section

Delete the `Analysis` section component (the tabbed `MORE THAN A SCORE / The full breakdown`
that re-renders `FaceAnalysisBlock` / `OutfitAnalysisBlock` / receipt summary). Also remove:
- its `analysis` entry from the section-rail `RAIL` (renumber the rest),
- the "Full analysis" link in the footer Product column,
- the now-unused `FaceAnalysisBlock` / `OutfitAnalysisBlock` imports in `Landing.tsx` if no
  other landing section uses them.

## 3. Landing — "Distinct cards" section: tappable fan + 2×2 breakdown

Rebuild the `Artifacts` section as a **two-column** block:

**Left — tappable card fan.** The three real cards (`FaceCard`, `OutfitCard`, `Receipt`,
driven by the existing single `HERO` mock generation). Front card centered/upright; the other
two tilted behind it (fan). **Tap the front card → it animates to the back of the stack and
the next card rotates to the front** (cycle order: Face → Outfit → Receipt → Face…); the
previous front settles behind. A short caption + the right column update to the new front card.
- Click + touch tap to advance; keyboard accessible (focusable, Enter/Space advances).
- `prefers-reduced-motion`: cards snap (no transition) but still cycle.

**Right — 2×2 compact breakdown blocks.** Four blocks in the real Score-breakdown card style
(icon · big score · HIGH/ELITE tag · name · descriptor · thin bar), **synced to the front
card**:
- Face front → Aura, Haircut match, Masculinity, Main character.
- Outfit front → Fit, Silhouette, Proportions, Physique (blue accent).
- Receipt front → Dating, Lover-boy, Main-char, Ghosting.
A one-line caption sits under the grid.

Section heading: eyebrow **"ONE SCAN, DISTINCT CARDS"**, h2 "Distinct cards / One verdict";
the bundle note becomes **"Scan a face, a fit, or both — get the cards that fit."**

This block is the single replacement for both the old Artifacts row and the removed
full-breakdown — it keeps the analysis *flavor* (the charts) without the wall of text.

## 4. Landing — copy trims + partial-scan fixes

| Section | Now | New |
|---|---|---|
| Hero sub | "Scan yourself, a friend, or your glow-up. FitAura reads your aura and hands back a verdict built to post." | "Scan yourself, a friend, or your glow-up. Get a verdict built to post." |
| How · h2 | "From two photos to **posted** in under a minute" | "From photo to **posted** in under a minute" |
| How · step 1 | "Upload two photos / A selfie and a full outfit shot. Crop and reframe until it's right." | "Upload your photos / A selfie, an outfit, or both — crop till it's right." |
| How · step 3 | "Three finished cards land at once, ready to screenshot and post." | "Your cards land ready to screenshot and post." |
| Artifacts eyebrow | "ONE SCAN, THREE ARTIFACTS" | "ONE SCAN, DISTINCT CARDS" |
| Artifacts note | "Every scan returns **all three**, not one card at a time." | "Scan a face, a fit, or both — get the cards that fit." |
| Credits lead | "…top up with credits whenever you want another. Friends, exes, celebrities, all fair game." | "…top up whenever. Friends, exes, celebrities — all fair game." |
| Credits foot | "Credits never expire. One credit always returns the full three-card verdict." | "Credits never expire. One credit = one verdict." |
| Privacy ¶ | (4 sentences) | "We use your photos to build your verdict, then drop them — never stored on our servers. Your cards and history live on your device." |
| Final CTA ¶ | "Two photos, one credit, three cards your group chat won't let go of. First one's free." | "One scan, one credit, cards your group chat won't let go of. First one's free." |

## 5. Result page — two-column compact breakdown

- **Face** `Score breakdown` (currently tall 2-col GymCards) → **compact** 2-col grid of the
  block style (smaller score, tighter padding).
- **Outfit** `Fit & physique read` (currently 1-col `TraitRow`s) → **2-col compact** grid of
  the same block style. The "Supporting read" 2×2 sub-grid stays as-is.
- Same compact block visual as the landing right column (one shared style).
- **Receipt: untouched.**

## 6. Result page — roast on the cards

- Add the roast as a **borderless quote line under the verdict** (above the scores) on the
  `FaceCard` and `OutfitCard`: a small accent quote mark + one short line, no box/border.
- It's a new **optional `roast` prop** on the card components — NOT a change to the card
  content model, assembly, schema, or the edge function. Callers pass it from data that
  already exists:
  - **Result page + export hosts** → `result.face.analysis.roast` (face) and
    `result.outfit.analysis.verdict` (outfit's punch line).
  - **Landing showcase/hero cards** → the mock roast strings.
- Because the export host renders the same `FaceCard`/`OutfitCard` with the prop set, the roast
  appears on the **shareable export** automatically. Because the source is `analysis.*` (which
  every result already has), this works for **existing saved verdicts** with no migration and
  **no edge redeploy**.
- **Drop the separate "The roast" block** from `FaceAnalysisBlock` (it's now on the card).

## 7. Copy trims — scan / vault

| Where | Now | New |
|---|---|---|
| Solo mode blurb (`modes.ts`; vault header + landing) | "Upload your face and fit. Get your full three-part verdict: Face Card, Outfit Check and Dating Score Receipt." | "Scan a face, a fit, or both — get the cards that fit." |
| Vault empty state (`SoloMode.tsx`) | "Drop a face photo and an outfit photo. FitAura returns your full three-part verdict. First scan is free." | "Drop a photo and get your verdict. First scan's free." |
| Vault "new scan" tile | "1 CREDIT · FACE · OUTFIT · RECEIPT" | "1 CREDIT · ONE VERDICT" |
| Scan reveal (signed-in) | "Three cards and one dating receipt, fresh off the press." | "Your verdict's printed — fresh off the press." |
| Scan reveal (guest) | "Create your free account to reveal all three cards and your dating receipt." | "Create your free account to reveal your verdict." |

**Kept deliberately:** the scan-stage flavor microcopy ("Finding the jawline…", "Consulting
the group chat…") and "for the bit, not science" — that's the personality, not clutter.

## Files touched (frontend only)

- `apps/web/src/features/landing/Landing.tsx` (+ `landing.css`) — hero, remove Analysis, new
  fan+breakdown section, copy, rail, footer.
- `apps/web/src/data/mockGenerations.ts` — `HERO_CHARACTERS` (3 face cards); roast fields.
- `apps/web/src/assets/` — add McLovin + Bateman images.
- `apps/web/src/features/result/Result.tsx` + analysis blocks (`FaceAnalysisBlock`,
  `OutfitAnalysisBlock`) + `components/analysis/*` + `result-shell.css` — two-col compact
  breakdown, drop roast block.
- `apps/web/src/components/cards/FaceCard.tsx` / `OutfitCard.tsx` (+ card CSS) — optional
  `roast` prop + borderless quote line.
- `apps/web/src/features/vault/modes.ts`, `SoloMode.tsx`, `features/scan/Scan.tsx` — copy.

No `packages/shared` or `supabase/functions` changes — this is frontend + copy only.

A new tappable-fan component (e.g. `features/landing/CardFan.tsx`) and a shared compact
breakdown-block component keep `Landing.tsx` from growing unwieldy.

## Out of scope / non-goals

- The user's new card designs (separate later effort).
- Any scoring / schema / edge-function change — none. The roast is a render-time prop sourced
  from existing `analysis.*` data, so no version bump and no edge redeploy.
- The receipt design.

## Risks

- **Card export** must still render correctly with the new roast line at full scale (snapdom
  WYSIWYG) — verify the exported PNG.
- **Real-person likeness**: McLovin/Bateman/GigaChad are meme/film faces the user is providing
  and chose to use; product/legal call is the user's. App is "for the bit," entertainment only.
- **Card vertical space**: the roast line + scores must fit the fixed card proportions without
  overflow — keep the roast to one short line (truncate/clamp).
