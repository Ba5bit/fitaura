# 015 — Gemini 2.5 Flash Solo Scan (Cycle 3)

Replaces the mock generation path with a real Gemini 2.5 Flash analysis of the
user's face + outfit photos, behind a Supabase Edge Function. The Result page is
unchanged — the AI feeds the same `FullGenerationResult` the mock used to.
Spec: `docs/superpowers/specs/2026-06-13-gemini-solo-scan-design.md`.
Plan: `docs/superpowers/plans/2026-06-13-gemini-solo-scan.md`.

`tsc --noEmit` + `vite build` clean; 40 unit tests pass (8 files). Built
subagent-driven: a fresh implementer per task + two-stage review (spec then code
quality) each time. Live deploy + photo verification is the one remaining step
(needs the `GEMINI_API_KEY` Edge Function secret).

## The one rule that shaped everything
From the rules doc (`fitaura_gemini_2_5_flash_solo_scan.md`):

> **Gemini observes and classifies. The backend decides and calculates. The
> frontend presents.**

So Gemini never invents a score, a verdict, or a caption. It returns a bounded
`1–5` rubric (with confidence + one-line evidence per category) plus *candidate*
content IDs. All the numbers a user sees — the display scores, the Aura Index, the
dating score, the green/normie/red verdict, the sticker/caption choice — are
computed by deterministic code from that rubric. This keeps scores stable across
re-scans, keeps business logic out of the prompt, and lets the scoring be unit
tested without calling the model.

## Translating the rules doc to this codebase
The rules doc was written assuming a NestJS backend. This repo dropped NestJS for
**Supabase-direct + Edge Functions (Deno)**, so every "backend" responsibility
moved into the `solo-scan` Edge Function. Two Deno realities forced small
deviations from the doc:

- **No `sharp`.** Image preprocessing (resize, EXIF strip) the doc assigns to the
  server moves client-side — and the app already does it: `bakeCrop` (the existing
  upload crop) re-encodes each photo to a ~640–1200px WebP data URL via canvas,
  which strips EXIF for free and is already within Gemini's inline-image sweet
  spot. The client sends base64; the function forwards it inline (no Files API).
- **REST, not the SDK.** The function calls Gemini's `:generateContent` REST
  endpoint with `fetch` + the `x-goog-api-key` header (verified to be the auth
  scheme this project's key uses — not OAuth Bearer). Fewer moving parts than the
  Node SDK under Deno.

Photos transit the function and are discarded — never persisted server-side
(the privacy rule holds). The function returns the result *without* images; the
client re-attaches the local data-URL it actually scanned.

## Where the code lives (and why)
The pure logic lives in `packages/shared/src/solo-scan/` so it can be unit tested
in Node (Vitest) and imported by the Deno function via an import map — one source
of truth, no cross-runtime duplication:

- `schema.ts` — the `solo_scan_v1` Zod schema (`SoloScanAIOutput`) + a
  `superRefine` enforcing "retake instruction required when not usable", plus the
  canonical `FACE_KEYS`/`OUTFIT_KEYS`.
- `scoring.ts` — the `1→35 … 5→92` rating curve, weighted averages that **drop
  null (not-assessable) categories and redistribute their weight**, the Aura Index
  formula, a deterministic FNV-1a **seeded ±3 jitter** (so a saved result renders
  identical numbers forever — no fresh `Math.random` per render), and the verdict
  thresholds.
- `content-bank.ts` — allowlists mapping Gemini's candidate IDs onto the *real*
  `STICKER_BANK` + per-verdict fallbacks; `pick()` throws if a default is ever
  misconfigured rather than rendering a blank card.
- `assemble.ts` — `assembleResult(ai, scanId, promptVersion)` maps the rubric into
  a `FullGenerationResult`, throwing `insufficient_signal` when face/outfit can't
  be scored (→ treated as a retake). The displayed breakdown/supporting stats are
  re-derived from the *real* rubric categories, not the mock's invented labels.

The Deno shell is thin: `supabase/functions/solo-scan/gemini.ts` (system
instruction, OpenAPI-subset response schema, one-retry `callGemini`) and
`index.ts` (CORS, validate, Gemini call, Zod parse, input-quality gate, assemble,
console cost log).

## The frontend seam
`runGeneration` (in `state/generation.tsx`) went from a synchronous mock pick to
`async` → `runSoloScan` (the new `services/soloScanService.ts`, the only file that
invokes the Edge Function). A subtle but important fix surfaced in review: after
the `await`, history must be merged with a **functional `setState((prev) => …)`**
updater — a plain-value `setState` built from the pre-await snapshot would clobber
any photo swap or vault rename made while the (multi-second) scan was in flight.

`Scan.tsx` now spends the credit, `await`s the result, and on **any** failure
refunds it (`AccountContext.refundScan` — the inverse of `spendForScan`: guest free
flag restored, or +1 credit). A retake shows the AI's instruction with a "Replace a
photo" affordance; a technical error shows a friendly "credit refunded" message. A
`revealingRef` guards against a double-tap double-spend before the button disables.
**No failed scan ever costs a credit.** `MOCK_GENERATIONS` survives only for the
Landing page's static example cards — the scan path is AI-only.

## Reliability details worth remembering
- **One retry**, transient-only (429/5xx/timeout/empty/malformed-JSON), via a typed
  `GeminiError { transient }` — not duck-typing. A 30s `AbortSignal.timeout` fails a
  stalled request fast so the retry still fits the platform budget.
- **`issues` is enum-constrained in the Gemini response schema** (sourced from
  `inputIssueSchema.options`) so a stray free-text issue can't fail Zod and sink an
  otherwise-valid scan.
- **Observability is console-only this pass** (token counts + latency + estimated
  cost from `usageMetadata`, never image bytes). The durable `scan_jobs` table and
  the proper credit reserve/consume/release RPC are deferred to Cycle 1 (credit
  hardening) — the moment that ledger is actually needed.

## Deferred / next
- Set the `GEMINI_API_KEY` (+ optional `GEMINI_SOLO_SCAN_MODEL`) Edge Function
  secret, deploy `solo-scan`, and live-verify (valid pair → result; bad photo →
  retake, credit unchanged; forced error → credit refunded).
- Calibrate the scoring weights / verdict thresholds against real photos.
- Cycle 1 credit hardening (reserve/consume RPC) + the `scan_jobs` analytics table.
