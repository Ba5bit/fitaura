# 001 — Initial frontend build from imported design

**Date:** 2026-06-11
**Scope:** Stand up the production frontend from the imported Claude design files.
**Outcome:** Working Vite + React + TS app, full flow Landing → Upload → Scan → Result, verified in-browser. Backend not started.

---

## 0. Sources of truth (read these first)

- **Visual:** `uploaded/` — the imported Claude-design prototypes (Babel-in-browser
  React). These define layout, type, color, spacing, motion, copy.
- **Product/behavior:** `aura_project_context_rebuilt_cards_v2.md` (repo root and
  `~/Downloads`). Defines the 3-output system, credit logic, privacy rules, data shape.

Rule when they conflict: **behavior** from the markdown, **presentation** from the
design files. Prefer the newest/most complete design implementation.

---

## 1. Inspection (what's in `uploaded/`)

Mapped before writing any code:

- **Landing** — `landing.jsx` + `landing.css`: hero with fanned cards, three-output
  preview, how-it-works, bundle, credits ($4.99/5, $11.99/15, $29.99/40), privacy,
  examples, final CTA, mobile sticky bar.
- **Upload** — `upload.jsx` + `upload-zone.jsx` + `upload.css`: one page, two zones
  (face 1:1 circle, outfit 3:4), inline crop (drag + zoom + pinch), validation,
  sample loader. **Wrapped in a device-frame review harness + spec sheet (QA only).**
- **Scanner** — `scan-app.jsx` + `scanner.css`: 5 finite stages
  (prep→face→fit→aura→verdict), HUD chips, per-stage aura recolor, receipt-print
  reveal, reduced-motion + slow-network variants.
- **Result** — `result-shell.jsx` + `result-analysis.jsx` + `result-shell.css`: the
  real product shell. 3 tabs, sticky card left + analysis right, sticker controls,
  paper toggle, export/share, credits, toasts.
- **Cards + data** — `cards.jsx` + `fitaura.css`: `FaceCard`, `OutfitCard`, `Receipt`
  + `FITAURA_DATA` content bank for 3 verdicts.
- **Design-time-only (NOT ported):** `image-slot.js` (custom element bound to Claude's
  "omelette" canvas runtime), `tweaks-panel.jsx` (A/B dev tool), the upload/scanner
  device frames + spec sheet.

**Design tokens** live in `fitaura.css :root`: surfaces `#06070a`→`#13161d`, ink scale,
semantic `--cyan #54e6f0` (default accent), `--lime`, `--red`, `--magenta`, `--icy`,
`--gold`, chrome gradient. Fonts: **Anton** (display), **Hanken Grotesk** (UI),
**Space Mono** (labels/receipt).

---

## 2. Decisions

- **Scaffold:** frontend-first, backend-ready **npm-workspaces monorepo**
  (`apps/web`, `packages/shared`, future `apps/api`). Chosen by the user over a
  flat single app or full-monorepo-now.
- **`<image-slot>` → `<CardImage>`:** the design-time custom element can't ship
  (needs the omelette runtime). Replaced with a React component fed by the upload
  crop. CSS selectors `image-slot` were renamed to `.card-image` in `fitaura.css`
  and `scanner.css` via sed.
- **Mock data, not AI yet:** `apps/web/src/data/mockGenerations.ts` ports
  `FITAURA_DATA` + `FACE_ANALYSIS` + `RESULT_READS` into the typed model. This is the
  stand-in for the AI's structured JSON; the backend will replace it.
- **Result model** (`packages/shared/src/result.ts`): aligned with the context md §7
  but extended to carry full design fidelity (two-part highlighted verdict line,
  `hot` stats, receipt row tones, seal/stamp, summary). `datingVerdict` is a single
  enum — never three scores, kept separate from the punchline.

### Conflicts resolved

- **Privacy copy:** upload said "deleted after 24h"; context/landing say "never
  permanently stored on our servers." → standardized on **never permanently stored**.
- **Outfit analysis shape:** context lists Works/Hurts/Verdict; the design's
  `OutfitAnalysis` renders an explanation + tags. → render the design (explanation +
  tags) but keep works/hurts/verdict in the model so no product data is lost.

---

## 3. Build order

1. Root workspace + `.gitignore` + README.
2. `packages/shared` — `verdict.ts`, `result.ts`, `sticker-bank.ts`, `pricing.ts`.
3. `apps/web` config — `vite.config.ts` (aliases `@fitaura/shared` → its TS source),
   `tsconfig.json` (strict, `verbatimModuleSyntax`), `index.html` (Google Fonts).
4. Design CSS copied verbatim into `src/design/`; `components.css` added for
   production-only supplements (CardImage sizing, `.ua-page`/`.scan-page` wrappers,
   real mobile media queries the harness previously faked via a `data-mobile` attr).
5. Libs: `useCountUp`, `useInView`, `icons.tsx`, `format.ts`.
6. Cards: `CardImage`, `Sticker`, `Bars`, `MiniStat`, `FaceCard`, `OutfitCard`, `Receipt`.
7. Analysis: `ScoreRing`, `GymCard`, `TraitIcon`, `TraitRow`, and the 3 block components.
8. State: `useLocalStorage`, `generation.tsx` (context, credits, on-device persistence).
9. Routes/features: `Landing`, `Upload` (+ `UploadZone`, `cropMath`), `Scan`, `Result`.

---

## 4. Gotchas (read before editing these areas)

- **`components.css` MUST stay imported in `main.tsx`.** It holds CardImage cover
  sizing, placeholder styling, and the page-centering wrappers. The design CSS alone
  positions `.card-image` but not the inner `<img>`. Forgetting the import = overflowing
  specimen panels and uncentered pages.
- **`verbatimModuleSyntax: true`** — bare `React.*` type references error. Import the
  specific types (`type CSSProperties`, `type RefObject`, `type DragEvent`, …) instead
  of relying on a global `React` namespace.
- **CSS custom properties in `style={}`** need a cast, e.g.
  `style={{ ['--rot']: v } as CSSProperties}`.
- **StrictMode double-invokes `setState` updaters.** `runGeneration` originally derived
  its return value from inside the updater; the second invocation saw `freeUsed`
  already flipped and wrongly returned `no_credits`, bouncing the *free* scan to
  `/#credits`. **Fix:** compute the outcome purely from a `stateRef`, then call
  `setState` with the finished object. Keep that updater pure.
- The scanner's **pink/magenta at the aura stage is intentional** (per-stage aura
  recolor), not a bug.

---

## 5. Verification

- `npm run typecheck` — clean (both workspaces).
- `npm run build` — clean, 69 modules.
- Playwright walk-through, desktop (1280) + mobile (390): Landing, Upload (sample load
  → crop → confirm), Scan (5 stages → reveal), Result (all 3 tabs). Two-pane collapses
  to card-first single column on mobile, no horizontal scroll. Only console error is a
  harmless `favicon.ico` 404.

---

## 6. Next

1. `apps/api` — NestJS skeleton: Supabase Auth, credit ledger, `POST /generate` auth.
2. Replace `mockGenerations.ts` with the vision-model structured-JSON call.
   **Open question:** how photos transit to the model without violating "no permanent
   server storage" (ephemeral, not persisted) — align with product owner first.
3. Wire Download/Share to real card-only image capture (e.g. `html-to-image`).
4. Credit-pack checkout (Stripe) behind the existing pricing.
