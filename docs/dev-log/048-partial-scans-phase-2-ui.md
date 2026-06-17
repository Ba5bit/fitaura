# 048 — Partial scans, Phase 2: UI unlock (face-only / outfit-only / both)

Feature branch `feat/partial-scans`, continues `047`. Phase 2 flips the partial-scans
feature on in the UI. Built subagent-driven on top of the Phase 1 plumbing. Result:
`tsc` clean, **113 tests green**, `vite build` succeeds. Plan:
`docs/superpowers/plans/2026-06-17-partial-scans-phase-2-ui.md`.

## What changed for the user
You can now scan a **face only**, an **outfit only**, or **both**. The verdict shows only the
cards for what you gave, the scan animation drops the stage/visuals for the missing modality,
and the vault reflects each scan's actual contents. A one-photo scan still gets a full Dating
Score Receipt (Phase 1's "score from what you give us").

## Upload (`Upload.tsx`)
The gate dropped from "both photos" to **≥1 photo** (`anyReady = faceReady || outfitReady`).
Title/subcopy now say "1 or 2 photos … we score whatever you give us"; the validation banner
fires only when nothing is selected; the CTA + unlock hint key off `anyReady`. The two
face/outfit ready chips stayed (now read as optional progress).

## Generation state (`generation.tsx`)
`runGeneration` gate relaxed to `if (!s.face && !s.outfit)`; it sends
`runSoloScan(startedFace?.url ?? null, startedOutfit?.url ?? null)` and injects imageUrls
null-tolerantly. Added `canScanPhotos = !!face || !!outfit` to the context (kept
`bothPhotosReady` for any legacy reader).

## Scan animation (`Scan.tsx`)
Entry/kickoff/progress gates switched to `canScanPhotos`. The stage list is now built per scan:
`activeStagesFor(parts)` filters the fixed `STAGES` to `prep → [face] → [fit] → aura → verdict`
(face stage only with a face photo, fit stage only with an outfit photo) and **re-spaces the
boundaries evenly** so the progress bar still ends at 100; `stageAtIn(stages, p)` replaces the
old `stageAt`. `Rail` takes the active `stages`; the readout shows "Stage n of {stages.length}".
The `Specimen` chooses its frame image (`parts.outfit ? outfitSrc : faceSrc`) and only renders
the circular **face inset when both** modalities exist — so outfit-only has no face circle and
face-only fills the frame with the face. The HUD markers already keyed off the active stage, so
face markers never fire on an outfit-only scan and vice-versa.

## Result view (`Result.tsx`) — the tricky one
Tabs are now derived: `tabs = TABS.filter(face iff result.face, outfit iff result.outfit,
receipt always)`, memoized over `result`. Hash/localStorage slugs map through `tabIdxForSlug`
and fall back to the first present tab (a stale `#face` on an outfit-only result lands on
OUTFIT, never crashes). `setTab` clamps to `tabs.length`; an effect pulls `tab` back in range if
the set shrinks; the tab strip / stepper / arrows / swipe / keyboard all operate over `tabs`
with positional numbering. Card content (`faceContent`/`outfitContent`) is nullable; the
offscreen export hosts and `exportAll` only render/iterate present cards. (The dead module-level
`slugToTab` was removed — `noUnusedLocals`.)

## Vault (`SoloMode.tsx`)
`SoloCard` asset chips render Face/Outfit only when present (Receipt always). `OutfitThumb`
already fell back to the face image for the thumbnail (Phase 1); the badge now shows **FIT**
(outfit `overallScore`) when an outfit exists, else **AURA** (`face.analysis.aura`) for a
face-only card.

## Export (`exportCard.ts`)
**No change needed** — it only rasterizes a single element to a blob. "Export only present
cards" is fully handled by `Result.tsx`: `exportAll` iterates only present kinds and the export
hosts only mount present cards (so `captureKind('face')` no-ops when absent).

## Verification
`tsc` clean, 113 tests, `vite build` OK (the >500 kB chunk warning is pre-existing). Manual QA
across the three modes (upload gating, animation variant, result tabs, vault chips/thumbnail,
export) is the remaining sign-off — see the PR checklist. Phase 1's manual edge deploy
(`solo-scan`) must be live for real single-image scans to score.
