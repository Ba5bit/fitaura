# 047 — Partial scans, Phase 1: invisible plumbing (face-only / outfit-only / both)

Feature branch `feat/partial-scans`. Phase 1 of the partial-scans feature
(spec `docs/superpowers/specs/2026-06-17-partial-scans-face-or-outfit-design.md`,
plan `docs/superpowers/plans/2026-06-17-partial-scans-phase-1-plumbing.md`). Built
subagent-driven, one task per implementer, TDD throughout. Result: `tsc` clean across
`apps/web`, **113 tests green** (was 99 → +14 new). **No user-visible change yet** — the
upload UI still requires both photos; Phase 2 flips that on.

## The core idea: `parts`
A scan's composition is now an explicit value, not inferred from null ratings.
`ScanParts = { face: boolean; outfit: boolean }` (at least one true). The edge function
derives `parts` from the images it actually received and threads it into `assembleResult`,
which stamps it onto the result. `FullGenerationResult.face` / `.outfit` became nullable;
`receipt` stays required (always produced — "score from what you give us").

`partsOf(result)` (in `result.ts`) resolves a possibly-legacy result: rows saved before this
feature have no `parts`, so it falls back to presence (which, for those, is both). No
IndexedDB migration — the shim is read-only.

## Scoring redistribution (`scoring.ts`)
`auraIndex(ai, { face, outfit }, parts)` redistributes a missing modality's weight:
- both → `face*0.45 + outfit*0.45 + vp*0.10` (unchanged)
- face-only → `face*0.90 + vp*0.10`
- outfit-only → `outfit*1.0` (visual presence is a face metric, so it drops out)

The dating verdict + receipt still derive from this aura, so a one-photo scan gets a full
"Dating Score" receipt.

## Assembly (`assemble.ts`)
`assembleResult(ai, scanId, version, parts)` now: scores only provided modalities; throws
`insufficient_signal` **only** when a *provided* modality can't be scored (an absent modality
is expected, never an error); builds the face card / outfit card only when present; and drops
receipt rows referencing a missing modality (e.g. `main-char` Main-Char Energy is omitted on
outfit-only). `summary` composes from whichever copy blocks exist.

## AI contract (`constants.ts`, `gemini.ts`)
Schema/prompt bumped `solo_scan_v3_1 → solo_scan_v3_2` / `v3_1 → v3_2`. `buildBody` now sends
only the provided image part(s). The system prompt gained a SINGLE IMAGE rule: score only the
present modality, set the absent block's ratings all to null, and do **not** treat the absent
modality as a quality issue / retake. (The fixture had hard-coded the version string — switched
it to import the constant so schema `z.literal` and fixture can't drift again.)

## Edge + service + state
- `index.ts`: accepts `face?`/`outfit?`, requires ≥1 valid image, derives `parts`, sends only
  provided images to Gemini, passes `parts` to assemble, and the retake guard reports an absent
  modality as not-unusable.
- `soloScanService.ts`: `runSoloScan(faceUrl | null, outfitUrl | null)` — sends only provided.
- `generation.tsx`: null-safe, parts-aware imageUrl injection. **Both-photo gate kept** (Phase 1).
- `scanGuards.ts`: `resultMatchesPhotos` now matches on the present parts (a face-only result
  matches a face-only session, etc.) so the back-from-result credit-reuse guard still holds.

## Null-safety sweep
Making the modalities nullable rippled through consumers. Minimal guards / non-null assertions
added so `tsc` is clean without changing what renders today (runtime always has both in Phase 1):
`mockGenerations.ts` (added `parts` to the 3 mocks), `SoloMode.tsx` (thumbnail fallback + guarded
FIT badge/caption), `Landing.tsx` + `Result.tsx` (non-null assertions — both always present in
Phase 1; Phase 2 replaces the Result ones with real dynamic-tab logic), and test files.

## Still TODO for Phase 1 to be live
**Manual edge deploy** (a git push does nothing for the edge function):
```
npx supabase functions deploy solo-scan --project-ref rxtlbhjysksoxkdcdqyr --no-verify-jwt
```
Then smoke-test: (1) a normal both-photo scan is unchanged; (2) a direct single-image invoke
returns `result.parts` reflecting the one modality, the missing card `null`, receipt present.
