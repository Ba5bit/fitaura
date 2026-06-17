# 046 — Back-from-result re-spends a credit: guard the scan route against already-scanned photos

Bug report: "going back from result to the animation decreases the credit." Pressing
browser-back from `/result` to `/scan/run` kicked off a **brand-new scan of an image
whose verdict already existed**, spending another credit (and re-calling the AI). Also
small UI changes shipped alongside: 80-credit pack → `$19.99`, two landing lead
paragraphs removed, scan animation 9s → 6s, mobile face medallion moved top-left and
enlarged to 132px. `tsc` clean; full web suite green (99 tests, +5 new).

## Root cause
`Scan.tsx` runs its generation kickoff in a `useEffect`. The only re-entrancy guard was
`startedRef` — a `useRef(false)` that **resets to `false` on every mount**. It exists to
defeat StrictMode's double-invoke within a single mount, not to defeat remounts.

Navigating back to `/scan/run` remounts the component:
- `startedRef.current` is `false` again,
- `bothPhotosReady` is still `true` (face/outfit persist in the session via IndexedDB),
- a signed-in user with `canScan` therefore hits `spendForScan()` → `runGeneration()` a
  second time.

Nothing checked "does a result already exist for *these* photos?". The route treated
every mount as a fresh scan.

## Fix
A pure predicate `resultMatchesPhotos(result, face, outfit)` in
`features/scan/scanGuards.ts`: true when the current result's card image urls equal the
session photo urls. Photo urls are **baked WebP data URLs** (`bakeCrop` →
`canvas.toDataURL`, see `015`), so they are stable within a session and across reloads —
an exact string match is reliable, not a heuristic.

Wired into `Scan.tsx` in three places (defense in depth):
1. **Redirect effect** — `if (hydrated && alreadyScanned) navigate('/result#face', { replace: true })`.
   `replace` drops the unreachable animation entry from the back stack, so a second
   back-press lands on the upload page, not the scanner.
2. **Kickoff early-return** — `if (alreadyScanned) { startedRef.current = true; return; }`
   *before* any `spendForScan`. The redirect is async (fires after commit), so the
   kickoff (same tick) must independently refuse to spend.
3. **Render guard** — `if (alreadyScanned) return <div className="scan-page" />;` so the
   scanner never flashes for a frame before the redirect navigates.

All three key off `hydrated` first: during IndexedDB hydration `result` is briefly `null`,
so we must not decide until the session has loaded (same discipline as the existing
"needs both photos" guard).

## Why this also satisfies the product ask
"Don't let the user go back to scanning that image after its result" — the redirect makes
`/scan/run` a dead end for already-scanned photos. The legitimate re-scan path is
untouched: result page "scan again" calls `startNewScan()` (clears face/outfit) → `/scan`
upload, so new photos get fresh urls → `alreadyScanned` is false → a real scan runs. The
only way to reach `/scan/run` with matching photos is back-navigation, which is exactly
what we intercept.

## Tests
`scanGuards.test.ts` — 5 cases for the predicate (both match, face differs, outfit
differs, no result, no photos). The predicate is the error-prone part (url matching); the
effect wiring is straightforward. Pure module (no CSS/React import) so it runs in the
plain node vitest env. Run the suite from `apps/web` (its `.env.local` feeds
`supabase.ts`); running vitest from the repo root throws "Missing VITE_SUPABASE_URL".
