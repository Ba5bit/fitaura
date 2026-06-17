# Partial Scans — Face-only / Outfit-only / Both — Design

**Date:** 2026-06-17
**Status:** design — awaiting user review before writing-plans

Today every Solo Scan forces **both** a face photo and an outfit photo. This change lets a
user scan **face only**, **outfit only**, or **both**. The verdict then contains only the
cards for what was provided, with a dating receipt produced in every case ("score from what
you give us"). Vault, result view, and the scan animation adapt to the parts present.

User decisions captured up front:

- **Score from what's given.** A single-photo scan still gets a full Dating Score Receipt,
  headlined "Dating Score" as today (not relabelled).
- **Phase it.** Phase 1 is invisible plumbing (data model + scoring + AI + edge function all
  support partial, every consumer null-checked, UI still requires both → behaviour
  unchanged, independently shippable). Phase 2 flips the UI on.
- **1 credit** per scan regardless of photo count.

---

## Core concept: `parts`

A scan's composition is authoritative input, not something inferred from null ratings. The
edge function knows which images it received, so it passes `parts` into assembly, and `parts`
is persisted on the result.

```ts
// packages/shared/src/result.ts
export interface ScanParts { face: boolean; outfit: boolean }
```

At least one of `face`/`outfit` is always true.

---

## Phase 1 — Invisible plumbing (no user-visible change)

Phase 1 ships with the **UI still requiring both photos**, so the live product is unchanged.
It is independently shippable and lets us deploy + smoke-test the edge function before any UI
exposure.

### 1.1 Result type (`packages/shared/src/result.ts`)

- Add `ScanParts`.
- On `FullGenerationResult`:
  - `parts: ScanParts` (new, required).
  - `face: FaceResult | null` (was required).
  - `outfit: OutfitResult | null` (was required).
  - `receipt: DatingReceiptResult` — unchanged, **always present**.
- The stored `GenerationResult` (`apps/web/src/state/generationDb.ts`) extends this, so it
  inherits the optional fields + `parts`.

**Backward-compat:** existing saved verdicts have no `parts` and always have both cards. A
loader shim treats a missing `parts` as `{ face: true, outfit: true }` (read at
`loadAccount` time, or via a `partsOf(result)` helper that defaults when absent). No
IndexedDB migration required — the shim covers old rows.

### 1.2 Scoring (`packages/shared/src/solo-scan/scoring.ts`)

`auraIndex` becomes parts-aware. Visual presence (`vp`) is a face metric, so it only
participates when face is present.

| parts        | aura formula                          |
|--------------|---------------------------------------|
| both         | `face×0.45 + outfit×0.45 + vp×0.10`   |
| face-only    | `face×0.90 + vp×0.10`                  |
| outfit-only  | `outfit×1.0`                          |

Signature: `auraIndex(ai, { face, outfit }, parts)` where `face`/`outfit` are the
already-computed non-null modality scores for present modalities (null/absent for missing).
The dating verdict (`pickVerdict`) and band (`scoreBand`) continue to derive from this aura
unchanged, so a one-photo scan still yields a full receipt.

`faceScore` / `outfitScore` are unchanged (they already drop null categories). They are only
*called* for present modalities.

### 1.3 Assembly (`packages/shared/src/solo-scan/assemble.ts`)

`assembleResult(ai, scanId, promptVersion, parts)` — new `parts` argument.

- Compute `face = parts.face ? faceScore(b) : null`, `outfit = parts.outfit ? outfitScore(b) : null`.
- Throw `insufficient_signal` only when a **provided** modality fails to score
  (`parts.face && face == null`, or `parts.outfit && outfit == null`). An absent modality is
  expected, never an error.
- `aura = auraIndex(b, { face, outfit }, parts)`.
- Build `faceCard`/`faceTraits` only when `parts.face`; emit `face: null` otherwise.
- Build `outfitCard`/supporting/tags only when `parts.outfit`; emit `outfit: null` otherwise.
- **Receipt (always):** rows that reference a missing modality are dropped — e.g. the
  `main-char` row (face `mainCharacterEnergy`) is omitted on outfit-only. Dating Score, Aura
  Gained, Lover-Boy, Ghosting stay (they read off aura/verdict). `summary` composes from the
  copy blocks that exist (`faceCopy.summary` and/or `outfitCopy.verdict`).
- Set `result.parts = parts`.

### 1.4 AI schema + prompt (`packages/shared/src/solo-scan/schema.ts`, edge prompt)

- Bump `SOLO_SCAN_SCHEMA_VERSION` (`solo_scan_v3_1` → `solo_scan_v3_2`) and
  `SOLO_SCAN_PROMPT_VERSION` (`v3_1` → `v3_2`) in `constants.ts`.
- Prompt change: "You may receive only one image (face *or* outfit) or both. Score only the
  modality(ies) present. For an absent modality, set **every** rating in that block to
  `null`. Do **not** report the absent modality as an input issue and do **not** request a
  retake for it." Retake logic still fires for genuinely bad *provided* photos.
- `inputQuality`: for an absent modality, `faceUsable`/`outfitUsable` is reported `false` but
  this must **not** drive a retake on its own — the edge function only treats provided
  modalities' usability as retake-worthy (see 1.5). Schema `superRefine` unchanged
  (retakeInstruction still required when `usable === false`).

### 1.5 Edge function (`supabase/functions/solo-scan/index.ts`) + service

- Request body: `{ scanId, face?, outfit? }`. Validate **at least one** valid image
  (`okImg(face) || okImg(outfit)`); reject only when neither is valid.
- Derive `parts = { face: okImg(face), outfit: okImg(outfit) }`.
- Send only the provided image(s) to `callGemini` (`gemini.ts` accepts optional face/outfit).
- Retake gate: only consider provided modalities. `usable` is treated relative to what was
  sent (a missing modality is not "unusable input").
- `assembleResult(ai, scanId, SOLO_SCAN_PROMPT_VERSION, parts)`; return
  `{ ok: true, result }` (result now carries `parts`).
- **Manual redeploy required** (per project convention: the edge function is a manual deploy,
  `.ts` import extensions required). Smoke-test both-photo path first (must be byte-identical
  in behaviour), then face-only and outfit-only via direct invoke.

Client service (`apps/web/src/services/soloScanService.ts`):
- `runSoloScan(faceDataUrl: string | null, outfitDataUrl: string | null)` — at least one
  non-null; build inline images only for provided urls; body includes only provided
  modalities. Returns the same `SoloScanOutcome`.

### 1.6 Consumers null-checked (still both-only in UI, but type-safe)

Update every reader of `result.face` / `result.outfit` to handle null, even though Phase 1
always produces both:

- `apps/web/src/state/generation.tsx` — `runGeneration` still sends both in Phase 1; the
  result's card `imageUrl` injection guards for null modalities.
- `apps/web/src/features/scan/scanGuards.ts` — `resultMatchesPhotos` must compare **present**
  parts only (face-only result matches when face urls match and outfit is absent, etc.).
- `apps/web/src/features/result/Result.tsx`, card components, `exportCard.ts`,
  vault `SoloMode.tsx` (`OutfitThumb`, `SoloCard`) — null-safe access.

### 1.7 Phase-1 verification

- `tsc` clean across `packages/shared` + `apps/web`.
- Unit tests: `scoring` (the three aura formulas), `assemble` (face-only, outfit-only, both;
  receipt-row dropping; insufficient_signal only on provided-but-unscorable), `scanGuards`
  (partial matching). Reuse the vitest patterns already in `solo-scan/*.test.ts`.
- Manual: existing both-photo flow unchanged end-to-end after edge redeploy.

---

## Phase 2 — Flip the UI on

### 2.1 Upload (`apps/web/src/features/upload/Upload.tsx`)

- Both zones remain; **"Generate verdict" enables once ≥1 photo is confirmed** (was: both
  required). A light hint communicates "one is enough — add both for the full verdict."
- On submit, navigate to `/scan/run` as today; the generation reads whichever photos exist.

### 2.2 Generation state (`apps/web/src/state/generation.tsx`)

- Replace the hard `bothPhotosReady` gate with `canScanPhotos = !!face || !!outfit`.
- `runGeneration` sends `face?.url ?? null`, `outfit?.url ?? null`.
- Persisted result carries `parts` from the service.

### 2.3 Scan animation (`apps/web/src/features/scan/Scan.tsx`, `scanner.css`)

- Build the stage list from parts: `prep → [face] → [fit] → aura → verdict`. Face stage only
  when face present; fit stage only when outfit present. Stage boundaries recomputed for the
  active count so the bar still fills 0→100.
- Specimen: the **face circle renders only when face is present**. Outfit-only → outfit fills
  the frame, no circle (the look you described). Face-only → face fills the frame, no circle,
  no fit stage.
- `Scan.tsx`'s entry guard uses `canScanPhotos` instead of `bothPhotosReady`.

### 2.4 Result view (`apps/web/src/features/result/Result.tsx` + cards)

- Tabs show only present cards + receipt; default tab = first present card.
- Deep-link/hash to an absent tab falls back to the first present tab.

### 2.5 Vault (`apps/web/src/features/vault/SoloMode.tsx`)

- `SoloCard` asset chips reflect present parts — `Face · Outfit · Receipt` or
  `Outfit · Receipt` or `Face · Receipt`.
- `OutfitThumb` thumbnail prefers the outfit image and **falls back to the face image** when
  outfit is absent, so face-only cards still render a preview.

### 2.6 Export (`apps/web/src/lib/exportCard.ts`)

- Export only the present cards (+ receipt). No empty/placeholder card for an absent modality.

### 2.7 Phase-2 verification

- `tsc` clean; web suite green.
- Manual QA across all three modes: upload gating, animation variant per mode, result tabs,
  vault chips + thumbnail fallback, export.

---

## Out of scope (YAGNI)

- No change to credit pricing or the per-scan cost (stays 1 credit).
- No new "mode picker" UI — the presence of photos *is* the mode.
- No retroactive re-scoring of existing saved verdicts (the compat shim is read-only).
- Friend-vs-Friend / Glow-Up modes untouched.

## Risks

- **AI reliability (highest):** the model must not hallucinate the absent modality. Mitigated
  by an explicit prompt rule (set absent block to all-null), schema tolerance (ratings already
  nullable), and the edge-function not sending the absent image at all. Verified by direct
  single-image invokes before Phase 2.
- **Type churn:** making `face`/`outfit` nullable touches many consumers. Mitigated by doing
  it all in Phase 1 behind an unchanged UI, with `tsc` as the safety net.
- **Receipt semantics for one photo:** a "Dating Score" from an outfit alone is thin by
  nature; accepted per product decision ("for the bit, not science").
