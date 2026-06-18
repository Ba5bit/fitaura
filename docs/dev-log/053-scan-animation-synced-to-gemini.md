# 053 — Scan animation synced to the real Gemini call (no more fixed timer)

## Problem

The scan animation "felt too long." It ran on a **fixed 4s timer** (3s reduced):
progress climbed linearly to 100% over `dur`, capped at 95% until the AI settled.
Consequences:

- A **fast** Gemini response still had to wait out the full 4s — `finish` required
  `rawP >= 100`, which only happens at `t = dur`. So fast scans were padded.
- The duration didn't track the real work at all; it was a timer that *also*
  happened to hold near the end.

Goal: the animation should take **the same time as the actual analysis** — fast
scan → fast animation, slow scan → it holds — identically on desktop and mobile.

## Fix (`apps/web/src/features/scan/Scan.tsx`, progress driver)

Replace the linear timer with a **two-stage, generation-driven** rAF model
(signed-in users, who run the Gemini call *during* the scan):

1. **Analyzing** — progress eases asymptotically toward a soft cap:
   `p = CAP * (1 - e^(-elapsed / TAU))`, `CAP = 92`, `TAU = 2200ms`. This always
   creeps forward (never visually stalls) and slows as it nears the cap, so it can
   wait out a slow AI without looking frozen.
2. **Sprint** — the moment the generation settles (`genState` ≠ idle/running) and a
   small floor has passed, progress runs `current → 100` over `SPRINT` (600ms,
   ease-out cubic), then `phase = 'done'`.

Total animation ≈ **AI time + ~0.6s tail**. A `FLOOR` (1600ms / 1100ms reduced)
prevents an unusually quick response (e.g. a mock) from flashing past every stage.

Guests have no generation in flight (it's deferred to post-sign-up), so they keep a
fixed **teaser** to 100 (`TEASER` 3400ms / 2600ms reduced) — down from the old 4s.

```
signed-in:  ease→92% (while analyzing) ──settle+floor──▶ sprint→100 ▶ done
guest:      linear→100 over TEASER ▶ done
```

Same logic on desktop and mobile (the driver isn't gated on viewport). `genState`
is read via `genStateRef` so the rAF loop sees the settle without re-subscribing;
the effect deps stay `[canScanPhotos, reduced, signedIn]`.

## Why eased-cap + sprint (not linear-to-cap)

A linear ramp that holds at a flat 95% reads as "stuck" when the AI is slow. The
exponential ease keeps inching toward 92% so it always looks alive, and the
ease-out sprint makes the hand-off to 100% feel like a completion, not a jump.

## Verification

`npm run typecheck` (web + shared) clean, `npm run build` ✓. Behavior reasoned
across the cases: fast settle (floor → ~2.2s total), slow settle (holds near 92%,
then sprints), error/retake (settles → sprints → `done` shows the hiccup variant),
guest (teaser). On-device timing confirmation is the recording loop.

## Files

- `apps/web/src/features/scan/Scan.tsx` — progress driver rewrite
