# Nameplate outfit card — Gemini-named, image-accented 3rd outfit skin

**Date:** 2026-06-19
**Status:** Approved (design) — layout + vibe-matched accent signed off via the
brainstorm visual companion.
**Scope:** new 3rd **outfit** skin (replaces `BufferingOutfit`), the AI schema +
prompt + assemble that feed it, a pure `clampAccent` helper, and a readability
pass on the in-app Outfit analysis block. Face deck untouched.

## Problem

The outfit deck's 3rd skin (`BufferingOutfit`) reuses the same logic as the
others: it ranks the four numeric metrics (Silhouette / Proportions / Fit /
Physique Match) as bars. Two issues:

1. The user wants a genuinely different 3rd card — one that **names the fit and
   reads it** in the "Aura Scan" forensic-dossier look (see
   `new card modes/new card/AURA_CARD_STYLE.md` + reference images), with a
   **per-image accent color** that matches the outfit's palette. Not a roast.
2. The numeric characteristics are hard to interpret on their own ("Silhouette
   98 · ELITE" — *meaning what?*). The in-app analysis block (Image #23) should
   read in plain language.

## Goals

- A new outfit skin, **"Nameplate"**, in the Aura-Scan look: full-bleed photo,
  cinematic grade/grain, corner reticle, brand, category pill, big AI **name**,
  gold stars + score, a one-line **read**, and an AI **dossier** (label · dotted
  leader · value). One **image-matched accent** flows through the whole card.
- Gemini generates the name, eyebrow, tagline, category lane, accent hex, and
  the dossier rows (**it picks both labels and values**).
- The accent is **vibe-matched** (Gemini's hue is kept) but **legibility-clamped**
  so it always reads on the dark card; gray/invalid input falls back to the
  gender accent.
- The Outfit analysis block surfaces a **plain-language one-liner** under each of
  the four metrics (reusing the AI `evidence` we already compute and discard).

## Non-goals

- No Face equivalent (outfit only, per decision).
- No change to the Dossier / Clean outfit skins, the kind tabs, the receipt, or
  the export pipeline (the new skin plugs into the existing export host).
- No client-side pixel color extraction — the accent comes from Gemini.
- No new numeric metrics; the analysis change is wording/surfacing only.

## Design

### 1. Data contract — `packages/shared/src/result.ts`

A new optional sub-object on the outfit card content. Optional so the Dossier /
Clean skins, legacy rows, and vault restores are unaffected, and the new skin
**degrades gracefully** when it is absent.

```ts
export interface OutfitDossierRow {
  /** AI-chosen short label, e.g. "Signature", "Palette". */
  label: string;
  /** AI-chosen short value, ≤ ~3 words, e.g. "Trucker jacket". */
  value: string;
}

export interface OutfitNameplate {
  /** Big Anton title — the FIT's name, e.g. "DENIM ARMORY". */
  name: string;
  /** Small descriptor over the name, e.g. "Double-denim, wash on wash". */
  eyebrow: string;
  /** One-line read (descriptive, not a roast). */
  tagline: string;
  /** Category pill (top-right), e.g. "STREETWEAR" / "MINIMALIST". */
  lane: string;
  /** Legibility-clamped accent hex (already safe to render). */
  accent: string;
  /** 3–4 dossier rows; AI picks labels + values. */
  dossier: OutfitDossierRow[];
}

export interface OutfitCardContent {
  // …existing fields…
  /** Present only for results assembled with the Nameplate fields. */
  nameplate?: OutfitNameplate;
}
```

Add an optional `note?: string` to `ScoreItem` (consumed only by the analysis
block; every other renderer ignores it).

### 2. AI schema + prompt — `packages/shared/src/solo-scan/schema.ts` + `supabase/functions/solo-scan/gemini.ts`

> Edge function is a **manual deploy** (see memory `fitaura-solo-scan-deploy`);
> `.ts` import extensions required. The user deploys after the prompt lands.

Add an outfit nameplate block to the AI output (nullable — only meaningful when
the scan includes an outfit; mirror the existing optional/nullable pattern used
by `outfitCopy` / `outfitAnalysis`):

```
outfitNameplate: {
  name: string            // names the FIT, not the person; ≤ 22 chars, punchy
  eyebrow: string         // ≤ 40 chars style descriptor
  tagline: string         // ≤ 60 chars, the read — descriptive, never a roast
  lane: string            // 1–2 word category, e.g. "Streetwear"
  accentHex: string       // "#rrggbb" matched to the dominant CLOTHING palette
  dossier: { label, value }[]  // exactly 4; label ≤ 12 chars, value ≤ 22 chars
}
```

Prompt rules: name the **outfit/aesthetic** (not the wearer or any recognized
icon — keep the existing `scrubName` discipline); the accent should track the
**clothing**, not the background; dossier rows are descriptive traits (a
signature piece, a styling rule, the palette, a finishing detail — but the AI
chooses the labels), values short. Respect gender for tone.

### 3. assemble + `clampAccent` — `packages/shared/src/solo-scan/`

- New pure helper `clampAccent(rawHex, gender)` (own file, e.g. `accent.ts`,
  unit-tested). Algorithm:
  1. Parse `#rgb`/`#rrggbb`. Invalid → gender fallback.
  2. hex → HSL. If **S < 0.12** (gray / black / white fit → no usable hue),
     return the gender fallback (this is why an all-black fit gets the brand
     accent rather than a dull gray — matches the reference's "All Black →
     icy-blue" choice).
  3. Else **keep H**, clamp **S → [0.50, 0.95]**, **L → [0.58, 0.74]**; HSL → hex.
  - Fallbacks: masc → `#83b4ff` (`--icy`); femme → the femme accent token's hex
    (resolve from the existing gender-skins token during implementation).
  - Rationale: the L band keeps the accent bright on `#06070a` without going
    white; the S floor kills muddiness. Hue is preserved → vibe-matched (a
    lime/pink fit stays lime/pink, per the approved tradeoff against
    `AURA_SCAN_STYLE`'s hue rule).
- In `assembleResult`, under `parts.outfit`, when `ai.outfitNameplate` is
  present, build `OutfitNameplate` (running `clampAccent(accentHex, contentGender)`)
  and attach it to `outfitCard.nameplate`.
- Surface evidence on the four main metrics: set
  `note: oa.<metric>.evidence` on each of the four `score(...)` items
  (`silhouette`/`proportions`/`fit`/`physiqueMatch`) — same `evidence` source the
  supporting stats already use.

### 4. Analysis-block readability — `apps/web/src/components/analysis/OutfitAnalysisBlock.tsx`

Render `stat.note` as a muted one-liner inside each `gym-card`, under the bar, so
"Silhouette · 98 ELITE" is followed by its plain-language reason. No new data —
it's the `evidence` now carried on `ScoreItem.note`. Minor CSS for `.gc-note`.

### 5. New skin — `apps/web/src/components/cards/skins/NameplateOutfit.tsx` + CSS

- Renders the Aura-Scan card (see approved mockup
  `.superpowers/brainstorm/.../nameplate-layout.html`): `CardImage` full-bleed →
  grade + **static** grain (seeded `useMemo`, **no opacity-from-0 / no infinite
  flicker** — export-safe; respects `prefers-reduced-motion`) → scrim → corner
  ticks → brand (top-left) + lane pill (top-right) → bottom block: eyebrow →
  name (Anton) → gold stars + score (`overallScore/20`) → tagline → dossier rows
  → footer (handle + barcode via existing `Bars`).
- Accent: set `--accent: nameplate.accent` inline on the card root; tokens/fonts
  reuse the existing Aura-Scan vocabulary. Card is dark for **both** genders —
  the per-image accent carries identity, so no femme cream theme here.
- **Graceful fallback** when `nameplate` is absent (legacy/vault/mock without it):
  name ← `caption`, tagline ← `roast` (the analysis verdict already passed to
  skins), accent ← gender fallback, **dossier row block omitted entirely** (no
  derived rows — keeps the layout honest). The card must never blank out.
- New stylesheet `apps/web/src/design/nameplate-card.css` (imported alongside the
  other card CSS), scoped under `.nameplate-card`.

### 6. Registry, mocks, export

- `registry.ts`: replace the outfit `buffering` entry with
  `{ id: 'nameplate', name: 'Nameplate', Comp: NameplateOutfit }`. Face deck
  keeps `BufferingFace`. A saved `outfitSkin === 'buffering'` falls back to index
  0 (Dossier) via existing `skinIndex` — graceful.
- `mockGenerations.ts`: add `nameplate` to the outfit card content of the mocks
  that carry an outfit image, so dev/preview + Playwright show the real card.
- Export: the offscreen export host renders the selected skin full-size already;
  the new skin works automatically. Verify the textures + accent render in export
  (they will — inline `--accent` + CSS, static grain).
- Decide whether `BufferingOutfit.tsx` is deleted or kept unused. Default:
  **delete** it and its outfit-specific CSS if nothing else references it (check
  first); keep `BufferingFace`.

## Testing

- **Unit (`clampAccent`)**: valid mid color (hue kept, returned in band);
  too-dark (`#0a0f1e` → lightened into band, hue kept); too-light
  (`#eef3ff` → darkened into band); near-gray (`#222` → masc fallback `#83b4ff`);
  invalid (`"nope"`, `""` → fallback); femme gender → femme fallback.
- **Unit (assemble)**: with `ai.outfitNameplate` present →
  `outfit.card.nameplate` populated and `accent` equals `clampAccent` output;
  absent → `nameplate` undefined; the four main scores carry `note` = evidence.
- **Registry test**: outfit list contains `nameplate`, not `buffering`;
  `skinIndex('outfit','buffering') === 0`.
- **In-browser (Playwright)**: seed a mock with `nameplate`, drive the Result
  page, rotate the deck to the Nameplate skin, confirm name/dossier/accent
  render, the accent flows (ticks/leaders/pill), stars are gold, export host
  renders it, 0 console errors. Confirm the analysis block shows per-metric
  notes.
- `npm test` + typecheck + build clean.

## Files

- `packages/shared/src/result.ts` — `OutfitNameplate`, `OutfitDossierRow`,
  `OutfitCardContent.nameplate?`, `ScoreItem.note?`.
- `packages/shared/src/solo-scan/schema.ts` — `outfitNameplate` AI block.
- `packages/shared/src/solo-scan/accent.ts` (+ `accent.test.ts`) — `clampAccent`.
- `packages/shared/src/solo-scan/assemble.ts` (+ test) — wire nameplate + notes.
- `supabase/functions/solo-scan/gemini.ts` — prompt for the nameplate block
  (**manual deploy**).
- `apps/web/src/components/cards/skins/NameplateOutfit.tsx` (new).
- `apps/web/src/design/nameplate-card.css` (new) + import.
- `apps/web/src/components/cards/skins/registry.ts` (+ test) — swap skin.
- `apps/web/src/components/analysis/OutfitAnalysisBlock.tsx` (+ CSS) — notes.
- `apps/web/src/data/mockGenerations.ts` — sample nameplate data.
- `apps/web/src/components/cards/skins/BufferingOutfit.tsx` — remove (after
  reference check).
- `docs/dev-log/` — study log after implementation (per dev-log convention).

## Implementation task graph (for parallel agents)

Per the user's instruction, independent tasks run as **Opus 4.8 subagents** after
this plan is approved. Dependency order:

1. **Contract (sequential, first):** `result.ts` types + `schema.ts` AI block +
   `clampAccent` + tests. Everything else depends on these names.

Then fan out (independent of each other):
2. `assemble.ts` wiring + tests (nameplate build + clampAccent call + metric notes).
3. `gemini.ts` prompt (manual-deploy; no code dependency on 2/4/5).
4. `NameplateOutfit.tsx` + `nameplate-card.css` + registry swap + mock data.
5. `OutfitAnalysisBlock.tsx` notes + CSS.

6. **Integration/verification (sequential, last):** Playwright run + dev-log.

## Open questions / defaults taken

- Dossier row count fixed at **4** (matches the reference + the mockup). Layout
  tolerates 3 if the AI returns fewer.
- `BufferingOutfit` **deleted** by default (kept only if still referenced).
- Femme fallback accent resolved from the existing gender-skins token during
  implementation (not hardcoded here).
