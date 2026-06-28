# 078 — Landing perf: kill scroll-jank blur + split the vendor bundle

**Date:** 2026-06-28
**Area:** `apps/web/src/design/landing.css`, `apps/web/vite.config.ts`,
`apps/web/src/features/versus/components/versusBits.tsx`, `apps/web/src/design/versus.css`

User report: "overall website feels slow — slow scrolls, slow landing." Investigated
statically (no guessing), found two distinct root causes + some dead code.

## Why scrolling felt slow — `backdrop-filter` everywhere

`backdrop-filter: blur()` forces the GPU to re-rasterize everything *behind* the element.
On a **sticky/fixed** element that means re-blurring the whole page every scroll frame.

The landing had **17** blurred compositing layers (measured via `getComputedStyle` over the
live DOM):

| element | count | over scrolling content? |
|---|---|---|
| `.ln-nav` (sticky) | 1 | yes — the prime offender |
| `.ln-mobilebar` (fixed) | 1 | yes (mobile) |
| `.ln-rail .lbl` | 4 | hover labels |
| `.ln-btn` | 4 | **no** — sit on opaque page |
| `.ln-step` / `.ln-pack` / `.ln-privacy-card` | 7 | **no** — content cards on opaque page |

Most of these blur *nothing* (they're in normal flow over the opaque page background), so the
blur was invisible cost. Fix:
- Content cards + buttons + rail labels: **drop `backdrop-filter`** entirely (no visual change).
- Sticky nav + fixed mobile bar (which *do* overlay scrolling content): replace blur with a
  **near-opaque background** (`bg-0` 90%→97% on the nav, 97% on the mobile bar). On the dark
  theme this reads identically to frosted glass but costs nothing per frame.

**Result: 17 → 0 backdrop-filter layers on the landing.** (Note: a headless rAF scroll test
caps at 60fps and can't resolve compositor cost, so the layer count is the honest causal
metric — the per-frame re-raster is simply gone.)

## Why the landing loaded slowly — one 498 KB chunk

`vite.config.ts` had no `manualChunks`, so React + Router + **@supabase/supabase-js** + all
shared components were fused into a single `index` chunk shipped on every route.

Added `manualChunks`: split `vendor-react` and `vendor-supabase` into their own long-lived
chunks.

| chunk | before | after |
|---|---|---|
| `index` (busts cache every deploy) | 498.53 kB / **140.72 gz** | 121.22 kB / **32.92 gz** |
| `vendor-react` | — | 165 kB / 53.9 gz |
| `vendor-supabase` | — | 211 kB / 54.5 gz |

Cold first-load total is ~unchanged (the deps are still needed), but: (a) the browser now
parses several smaller files instead of one blocking monolith, and (b) the volatile app chunk
dropped **4.3×**, so repeat visitors / route navigations re-download ~33 KB gz instead of 141.

**Known follow-up:** `vendor-supabase` (54 gz) still loads eagerly on the landing because
`AccountProvider` imports the Supabase client at module load — the public landing doesn't need
auth immediately. Lazy-loading it would be the real *cold*-load win, but it's more invasive
(defer auth init) and out of scope here.

## Dead code removed
- `VersusMedallion` (`versusBits.tsx`) — never rendered; the FvF medallion was removed in
  dev-log 068, the component lingered. Removed it + its now-orphaned `.vs-medal` CSS block in
  `versus.css` (incl. the `@keyframes vs-spin` and the reduced-motion selector reference).

Scanned the whole `apps/web/src` + `packages/shared/src` for unused files/exports. Findings:
no fully-unused component files; the per-export "unused" list was dominated by **false
positives** — generated `database.types.ts` (never delete), shared exports consumed via
`export *` barrels by the edge function, and types exported for co-location. Only the medallion
was genuinely dead. CSS files: all 17 imported. Assets: all 4 referenced.

## Verification
- `npm run build` (tsc + vite): clean.
- `vitest run`: **204 passed (30 files)**.
- Live Playwright on the prod preview: 0 blur layers; nav renders at 0.97 alpha (solid dark
  bar, no `backdrop-filter`); 3 hero cards + the distinct-cards fan render; buttons/step cards
  visible. No new console errors (the 2 present are env-only: fonts/Supabase env absent in
  local preview).

## Extension — same de-blur applied to Upload, Vault, Result

The blur fix above was landing-only (`.ln-*`). Extended the identical swap (blur →
near-opaque background, nothing else changed) to the other pages' **sticky/fixed scroll
chrome** — the same per-frame re-raster pattern:

- **Upload** (`upload.css`): `.ua-foot` fixed footer (86%→96%). The product header `.ua-head`
  is `position: static` with no blur — nothing to do. (`.rev` is a sticky blurred *prototype*
  toolbar but it's **never rendered** — dead CSS, zero runtime cost, left for a separate
  cleanup.)
- **Vault** (`vault.css`): `.vlt-nav` sticky header (78%→96%).
- **Result / Versus result** (`result-shell.css`, shared shell): `.rs-header` sticky
  (84%→96%, also dropped `saturate(140%)`), `.rs-nav` sticky sub-nav (72%→96%),
  `.rs-mobilebar` fixed mobile footer (92%→97%).

**Deliberately left blurred (design, not scroll-jank):** `.rs-block.glass` (the frosted
Face-analysis panel — and it's not pinned, so it scrolls *with* content and is cheap),
Vault `.lk-blur` (obscures locked previews — the blur *is* the feature), Vault badges/card
menu, modal scrims (`.vlt-scrim`, account overlays), toasts, the mobile dropdown menu, and
the full-screen scan overlays. These are either intentional visual design or
transient/non-scrolling, so per the "don't touch the UI design" constraint they were untouched.

Verified: clean `tsc`+`vite build`, **204/204 tests**, live Playwright on `/vault` and `/scan`
→ **0 pinned-blur layers**, `.vlt-nav` and `.ua-foot` render at 0.96 alpha with
`backdrop-filter: none`, visible. `/result` guards to the landing without a real generation, so
its shell was verified via source + parity with the live headers (same shared CSS mechanism).

## Result page verified live (seeded, no AI spend)

Confirmed the de-blurred Result shell renders by seeding a guest generation into
IndexedDB (the shipped mock, temporarily exposed on `window` then reverted) and loading
`/result` — no login, no billable AI scan. Desktop + mobile: **0 pinned-blur layers**;
`.rs-header`, `.rs-nav` (0.96 alpha) and `.rs-mobilebar` (0.97 alpha, mobile) render with
`backdrop-filter: none`, visible; the intentional `.rs-block.glass` Face panel stays blurred
(design preserved).

## Dead `.rev` / `.seg` review-toolbar CSS removed (upload.css)

The sticky blurred `.rev` toolbar + its `.seg` segmented control (~28 lines) were a
prototype-review affordance that is **never rendered** (zero `className` references anywhere;
the live product uses `.rs-seg` / `.vlt-seg` / `.aw-seg`). Removed both blocks.

## Supabase deferred off the landing's critical path (lazy client)

`lib/supabase.ts` no longer creates the client at module load — it exposes
`getSupabase(): Promise<SupabaseClient>` that **dynamically imports** `@supabase/supabase-js`
on first call (the post-mount session check). The 6 services now `await getSupabase()` at the
top of each call (existing `supabase.x` chains unchanged); `onAuthChange` keeps a synchronous
unsubscribe by attaching the real subscription once the client resolves. The 4 service test
mocks switched from `{ supabase }` to `{ getSupabase: () => Promise.resolve(...) }`.

Why it's safe: nothing renders during the deferral window that needs Supabase; AccountContext's
mount effect (and AuthCallback) call `getCurrentSession()` right after first paint, which creates
the client while still on the callback URL, so OAuth `?code=` exchange + session restore are
unchanged.

**Proof:** the built `index.html` no longer `modulepreload`s `vendor-supabase` (it's gone from
the initial graph — only `index` + `vendor-react` remain). Live resource timing: `index` and
`vendor-react` start at 12 ms; `vendor-supabase` starts at **105 ms** (after the mount effect
fires), i.e. no longer in the initial fetch/parse wave. 212 KB / 55 KB gz of Supabase JS is off
the first-paint critical path. App boots, AccountEntry renders, guest session check runs clean.

Verified: clean `tsc`+`vite build`, **204/204 tests** (incl. the 4 rewritten service mocks).

Frontend-only; no backend / edge-function changes. Push held per session convention.
