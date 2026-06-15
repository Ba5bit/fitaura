# 038 — Auth-gated scan + generation synced to the animation

Branch: `feat/auth-gated-scan-sync` (tasks 2 + 3, which are the same flow).

## Problems

- **(2)** Guests could scan and generate a verdict with **no account**, spending
  AI tokens on people who may never register. The landing also falsely showed
  guests "1 credit" when they were actually out. Verdicts should require an
  account, and — crucially — **no AI tokens should be spent before registration**.
- **(3)** Generation only ran when "Reveal my verdict" was pressed, *after* the
  scan animation (so the animation was fake waiting). The "Scan my aura" press
  should kick off the real AI, the animation should wait for it, and "Reveal my
  verdict" should just open the finished result.

## New model (switches on auth state)

- **`canScan` = signed-in AND credits > 0** (can actually generate). The guest
  free-scan (`freeScanAvailable`, localStorage flag) is **removed** — guests
  never spend tokens. "Free" now means the free credits granted on sign-up.
- **Signed-in flow (synced):** pressing "Scan my aura" → `/scan/run`, which on
  mount spends a credit and starts `runGeneration()` **during** the animation.
  The progress bar holds at ≤95% until the AI settles, then completes. "Reveal
  my verdict" just navigates to the (already generated) result.
- **Guest flow (gated, zero tokens):** the scan animation plays as a **teaser**
  (no AI call). At the reveal step the button is "Sign up to reveal your
  verdict" → opens the auth panel. **Only after sign-up** (when the free credits
  land) does generation run. This is the only place a former guest spends tokens.
- Generation failure (retake/error) refunds the credit; signed-in failures show
  an inline "try again / replace a photo" state on the done screen.

## Files

- `AccountContext.tsx` — drop `freeScanAvailable` + free-scan localStorage;
  `canScan = signedIn && credits>0`; `spendForScan`/`refundScan` signed-in only.
- `Scan.tsx` — kickoff effect (signed-in spend+generate at scan start, guarded by
  a `startedRef` against StrictMode double-invoke); progress driver holds until
  generation settles; `onReveal` opens the result (signed-in) or the auth panel
  (guest); `doRevealGuest` generates after sign-up; done-screen states.
- `Upload.tsx` — guests get "Scan my aura — free" + truthful copy; signed-in
  out-of-credits gets "Out of credits — top up" → `/credits`.
- `AccountChrome.tsx` — guest credit chip is the "1 FREE VERDICT" bait → opens
  sign-up (no fake zero-credit state).
- `SoloMode.tsx` — guests can start the teaser scan from the Vault too.

## Verification

- tsc clean; `vitest run` 43/43.
- Playwright (guest path, **no tokens**): correct guest copy, teaser plays with
  **no AI/edge-function call**, done → "Sign up to reveal your verdict" → auth
  panel opens.
- NOT run here (would spend real AI tokens): the signed-in synced generation and
  the post-sign-up generation. **Needs one live end-to-end test before merge.**

## Note

`creditsService` still exports the now-unused free-scan helpers
(`hasUsedFreeScan` etc.) so its tests stay green; safe to prune later.
