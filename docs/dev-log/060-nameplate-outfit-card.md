# 060 — Nameplate outfit card (Gemini-named, image-accented 3rd skin)

**Date:** 2026-06-19
**Spec:** `docs/superpowers/specs/2026-06-19-nameplate-outfit-card-design.md`
**Plan:** `docs/superpowers/plans/2026-06-19-nameplate-outfit-card.md`
**Status:** implemented + all automated checks green · **commit/push held** (iterative
session) · edge function awaits **manual deploy** · live in-app visual drive not yet run
(see Verification)

## What changed

A new **3rd outfit skin, "Nameplate"** replaces `BufferingOutfit` in the outfit
deck (face deck untouched). Unlike the other skins it does **not** rank the four
numeric metrics — it *names and reads the fit* in the Aura-Scan dossier look, with
a per-image accent. Built across the whole stack as a Gemini-driven feature, plus
a readability pass on the in-app analysis block.

### The pieces (7 scoped commits on `main`)

1. **Shared contract** (`9a3a763`) — `OutfitNameplate` + `OutfitDossierRow` types,
   optional `OutfitCardContent.nameplate?`, optional `ScoreItem.note?`. Bumped
   `SOLO_SCAN_SCHEMA_VERSION` → `solo_scan_v3_5` and added a required
   `outfitNameplate` Zod object (`name/eyebrow/tagline/lane/accentHex/dossier[]`).
   `SOLO_SCAN_PROMPT_VERSION` left at `v3_6` on purpose — the nameplate copy
   doesn't change scoring, and bumping it would reshuffle the seeded display
   jitter mid-calibration.
2. **`clampAccent`** (`9f7f6e8`) — pure helper (`packages/shared/src/solo-scan/accent.ts`).
   Keeps Gemini's **hue** (vibe-matched) but pulls saturation into `[0.50, 0.95]`
   and lightness into `[0.582, 0.738]` so the accent always reads on the dark card
   and the bars. A near-gray (`S < 0.12`, i.e. black/white/grey fits) or an
   unparseable value falls back to the gender brand accent (masc `#83b4ff`, femme
   `#ff52a6`). The L-band edges are nudged ~0.002 inward from the round numbers so
   the HSL→8-bit-hex round-trip can't quantize back outside the band (this bit the
   tests at exactly the boundary). Exposes `hexToHsl` for the tests.
3. **assemble** (`2956789`) — under `parts.outfit`, clamps `accentHex` via
   `clampAccent(_, contentGender)` and attaches an `OutfitNameplate` to the outfit
   card; also carries each of the four main metrics' AI `evidence` onto
   `ScoreItem.note` (data we previously computed and discarded).
4. **Gemini** (`b45972c`, **manual deploy**) — `outfitNameplate` added to the
   OpenAPI response schema + top-level `required`; a NAMEPLATE prompt block that
   names the *fit* (not the wearer), forbids roasting for these fields, samples the
   accent from the *clothing* palette, and has the AI choose its own 4 dossier
   labels+values; emits `solo_scan_v3_5`; `maxOutputTokens` 2500 → 2900.
5. **Nameplate skin** (`0d3b13d`) — `NameplateOutfit.tsx` + `nameplate-skin.css`,
   swapped into the outfit registry (id `nameplate`), `BufferingOutfit.tsx`
   removed (`BufferingFace` + `buffering-skin.css` kept). Full-bleed photo +
   static export-safe grain + scrim + corner reticle + brand/lane chrome + bottom
   block (eyebrow → Anton name → gold stars+score → tagline → dossier → barcode).
   Accent flows off one inline `--accent`; stars stay gold. Dark for both genders
   — the accent carries identity. Falls back gracefully (caption / verdict read /
   gender accent, dossier omitted) when `nameplate` is absent (legacy/vault rows).
   A legacy saved `outfitSkin === 'buffering'` resolves to index 0 (Dossier).
6. **Analysis readability** (`bea78aa`) — `OutfitAnalysisBlock` renders
   `stat.note` as a `.gc-note` one-liner under each metric bar (the Image #23
   complaint), so "Silhouette · 98 ELITE" now has a plain-language reason.
7. **Mocks** (`018064d`) — `nameplate` added to the `green_flag` outfit sample;
   other samples left without one to exercise the skin's fallback path.

## Why this shape

- **Optional `nameplate`** on the card type keeps the Dossier/Clean skins, legacy
  rows, and vault restores working untouched, and lets the new skin degrade
  instead of blanking.
- **Accent clamped in shared (`assemble`)**, not in the component, so the stored
  value is already safe and the logic is pure + unit-tested.
- **Hue kept, not snapped** to the `AURA_SCAN_STYLE` "safe" palette — the user
  chose fidelity to the fit's vibe over the style guide's hue rule; legibility is
  enforced via S/L only.

## Verification

- **Unit/integration:** `clampAccent` (6 cases: band, too-dark, too-light, gray
  fallback, invalid fallback, 3-digit/no-#), assemble (nameplate attached +
  clamped, metric notes carried, none when outfit absent), registry (outfit list
  is `dossier/clean/nameplate`; legacy `buffering` → 0). `npm test` →
  **171 passed (24 files)**; `npm run typecheck` clean; `npm run build` clean.
- **Visual:** the layout + vibe-matched accent were signed off during brainstorm
  via a faithful mockup (`.superpowers/brainstorm/.../nameplate-layout.html`); the
  shipped CSS implements that mockup 1:1, and the build compiles the skin.
- **Not yet done — live in-app drive:** the app has no dev seed hook, so rendering
  the real Result page with the Nameplate skin requires hand-seeding IndexedDB
  with a full generation. Deferred as an optional confirmation rather than run
  here. To check manually: `npm run dev`, produce/seed a green-flag scan, open the
  outfit deck, rotate to the 3rd (Nameplate) skin.

## Follow-ups

- [ ] **Manual deploy** the `solo-scan` edge function (see `fitaura-solo-scan-deploy`)
  so production returns the `outfitNameplate` block. Until then, real scans render
  the skin via its fallbacks.
- [ ] (Optional) live Playwright drive of the Nameplate skin on the Result page.
- [ ] Commit/push gate: held per the iterative-session push preference.
