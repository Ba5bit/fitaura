# 002 — Fix: "Scan my aura" didn't proceed (hidden confirm-crop gate)

**Date:** 2026-06-11
**Scope:** Upload → Scan navigation.
**Symptom (user):** clicking "Scan my aura" doesn't go to the scan page.

---

## Root cause

A photo only became scan-eligible after the user pressed **"Looks good"** inside its
crop zone. `UploadZone.confirmCrop()` was the *only* path that baked the crop and
called `onConfirm(url)`, which set `face`/`outfit` in the generation context. Until
both were confirmed, `bothPhotosReady` was false, so the CTA rendered as
`cta disabled` and `onGenerate()` returned early (showing an "Add both photos"
banner) instead of navigating.

So a user who uploaded both photos but didn't notice/realize they had to press
"Looks good" on each zone saw a visibly-populated page, clicked Scan, and got a
misleading "add both photos" message with no navigation. `.cta.disabled` has no
`pointer-events:none`, so the click fired — it just hit the early return.

Reproduced via Playwright: clean `localStorage`, load both samples, **skip** "Looks
good", click Scan → previously blocked. (Earlier "passing" tests were polluted —
clearing `localStorage` does not reset already-mounted React context state, so the
photos lingered in memory and masked the bug.)

## Fix

A photo is now registered the moment it finishes loading, baked at its **default
crop**, so the scan unlocks as soon as both photos are present. `"Looks good"` and
`Adjust` only *refine* the framing — they're no longer a hard gate.

`apps/web/src/features/upload/UploadZone.tsx`:
- Added `bakeAndConfirm(img, view)` helper; call it from both ingest paths
  (`ingest` done + `loadSample` done) right after the zone goes `ready`.
- `confirmCrop()` now re-bakes via the helper (commit adjusted framing).
- `adjustCrop()` **no longer calls `onConfirm(null)`** — reopening to re-frame must
  not de-register the photo / disable the scan. The committed crop changes only on
  "Looks good".

## Notes / trade-offs

- If the user drags to re-frame but never presses "Looks good", the scan uses the
  **default** crop, not the in-progress adjustment. Acceptable: "Looks good" commits
  adjustments. (A future improvement could debounce-bake on drag-end for full WYSIWYG.)
- The separate **out-of-credits** path (`!canAffordScan`) still routes to
  `/#credits` (landing pricing) by design — that's a different, intended branch and
  was not the reported issue.

## Verification

- `npm run typecheck` clean; `npm run build` clean.
- Playwright, fresh state: load both samples → CTA becomes `cta go` →
  click → navigates to `/scan/run`. No "Looks good" required.
