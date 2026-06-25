# 071 — FvF: enable the inverted webcam input (match Solo Scan)

**Date:** 2026-06-24
**Area:** Friend vs Friend upload arena (`apps/web/src/design/versus.css`)

Asked to add Solo Scan's "inverted" (selfie-mirrored) webcam capture to Friend vs Friend.

## What it actually took — one line
The webcam was already there. FvF reuses Solo's `UploadZone`, which renders a **"Take
photo"** button for **face zones on desktop** (`kind === 'face' && !mobile`) that opens
`WebcamCapture` — a live preview mirrored with `transform: scaleX(-1)` that also captures
the frame mirrored (so the saved selfie matches the preview).

The FvF arena was just **hiding** that button to declutter its compact (up-to-4) zones:

```css
/* versus.css — removed */
.vs-contender .zone-drop .sample ~ .sample { display: none; } /* hide per-contender "Take photo" */
```

`.sample` is shared by both "Use a sample" and "Take photo", so the `~ .sample` sibling
rule hid the second one. Removing it surfaces "Take photo" on both contenders' face zones
— the exact same mirrored capture component Solo uses, no new code.

## Verification
Browser smoke on `/versus`: both face zones (A + B) now show a visible "Take photo"
button (`display !== none`); clicking it renders `.webcam-capture` with a `<video>` whose
computed transform is `matrix(-1, 0, 0, 1, 0, 0)` (mirrored/inverted) — identical to Solo.
Outfit zones + mobile correctly still have no webcam (matches Solo). Zero console errors.

Local/uncommitted; no edge/deploy impact (pure client CSS).
