# 037 — Fix: card export broken on Safari (blank photo, partial render)

## Symptom

When a result card is **downloaded or shared on Safari** (iOS and macOS), the
exported PNG comes out broken: the user's photo is missing (e.g. the Face Card
exports with its ring/frame but an **empty circle** where the cropped selfie
should be) and the rest of the card design renders incompletely. Chrome exports
the same card perfectly. The on-screen card looks fine in every browser — only
the rasterized image is wrong.

## Root cause

The export core (`apps/web/src/lib/exportCard.ts`) uses **html-to-image**, which
rasterizes the card by:

1. cloning the DOM subtree,
2. serializing it into an `<svg><foreignObject>…</foreignObject></svg>`,
3. loading that SVG string into an `Image`, and
4. `drawImage`-ing the loaded SVG onto a `<canvas>`.

The failure is a **WebKit image-decode race** in steps 3–4. When Safari loads
the SVG, it fires the SVG image's `onload` **before the inner `<img>` elements
referenced inside the foreignObject have been decoded**. So at the moment
html-to-image draws to canvas, those images are still un-decoded and paint as
blank — the empty-circle symptom. This is the well-documented "first one or two
captures are blank on Safari" bug.

Two things in the existing code did **not** prevent it:

- `withExportHost` in `Result.tsx` waited on `img.complete` / `img.onload` for
  the live DOM images. But `complete`/`onload` only means *the bytes arrived* —
  **not** that the bitmap is decoded and paint-ready. Chromium decodes eagerly
  so it never noticed; WebKit decodes lazily and lost the race.
- The capture ran exactly **once**. Safari "warms up" foreignObject-embedded
  images across repeated serializations — the first pass can still be blank even
  after a decode, but a subsequent pass reliably includes the bitmap.

The cropped user photos are `canvas.toDataURL('image/webp', 0.85)` data URLs
(see `features/upload/cropMath.ts`) — same-origin, so there is **no CORS taint**;
ruling that out left the decode race as the cause. (WebP also happens to be a
slow async decode inside a foreignObject, which only widens the race window.)

## Fix (`apps/web/src/lib/exportCard.ts`)

Applied the proven WebKit-robust combination, both additive and guarded so the
Chromium path is unchanged:

1. **Decode every image before capture.** New `decodeAllImages(node)` awaits
   `img.decode()` (after `onload`/`complete`) for every `<img>` in the card
   subtree. `decode()` is the one API that guarantees a paint-ready bitmap.
   Called at the top of `renderCardBlob` before `toCanvas`. On Chromium this is
   effectively a no-op (already decoded); decode rejections are swallowed so a
   genuinely broken image still falls through to its empty slot rather than
   throwing.

2. **Multi-pass capture on WebKit only.** New `isWebKit()` detects Safari/iOS
   (incl. iOS Chrome, which is WebKit underneath). On WebKit we run `toCanvas`
   **3 times and keep the last** result; on Chromium we keep the single pass, so
   there's no perf cost where it isn't needed.

3. **`cacheBust: true`** on the capture options so Safari can't re-serve a
   still-undecoded image from cache and re-drop it across passes.

Font embedding is untouched: we still build `fontEmbedCSS` from the inlined
Google woff2 data URIs and only fall back to `skipFonts` when that build fails
(offline). The `skipFonts` deliberate-design note from memory is preserved.

`Result.tsx` was left as-is — its `onload` wait is still a useful pre-capture
paint gate, and the decode guarantee now lives in `renderCardBlob` where the
actual rasterization happens.

## Why this is safe for Chromium (no regression)

- `isWebKit()` is `false` in Chromium → still a single capture pass (identical
  to before).
- `decodeAllImages` resolves immediately for already-decoded images.
- `cacheBust` only appends a query param to resource fetches.

## Verification

- `cd apps/web && npx tsc --noEmit` → clean (exit 0).
- `npm run test` → 42 tests pass; the only failing *suite*
  (`creditsService.refund.test.ts`) is pre-existing and unrelated — it throws
  "Missing VITE_SUPABASE_URL" because env vars aren't set in this worktree.
- Real Safari (iOS/macOS) cannot be driven from this environment, so the WebKit
  path must be confirmed on a device — see below.

## How to verify on real Safari

1. Deploy this branch (`fix/card-export-safari`) to a Vercel preview (do **not**
   merge to main yet).
2. On an **iPhone (Safari)** and a **Mac (Safari)**, run a scan to reach the
   Result page.
3. On the **Face** tab, tap **Save / Download** (and **Share**). Open the
   resulting PNG.
   - Expected: the cropped face photo is present inside the ring, and the whole
     card design is complete — matching what's on screen.
4. Repeat on the **Outfit** tab and the **Receipt** tab, and try **Export all 3**.
5. Do it **twice in a row** (the old bug was worst on the first one or two
   exports of a session); both should now be correct.
6. Sanity-check Chrome (desktop + Android) still exports correctly.
