# 062 — Solo Scan dual-model comparison harness (2.5 vs 3.5 Flash)

**Date:** 2026-06-20
**Spec:** `docs/superpowers/specs/2026-06-20-solo-scan-dual-model-compare-design.md`
**Plan:** `docs/superpowers/plans/2026-06-20-solo-scan-dual-model-compare.md`
**Branch:** `feat/solo-scan-model-compare` · **commit/push held** (iterative session)
**Status:** Tasks 1–6 implemented, 19 tests green, CLI wiring verified · Task 7 (live
run on real photo + real keys) is the user's manual step (see Verification)

## Why

To "redo the logic of Gemini Answers," we first want **evidence**: run the same photos
through `gemini-2.5-flash` and the newer `gemini-3.5-flash` and compare their actual
output side-by-side. Decision (brainstorm): build an **offline eval harness** that
compares *models, not prompts* — it reuses the production prompt/schema verbatim so the
only variable is the model id. No production traffic split, no `assembleResult`.

## What changed

A self-contained harness under `supabase/functions/solo-scan/eval/`, run with Node +
`tsx` (Deno isn't installed locally). It imports the **production call path**
(`callGemini` from `../gemini.ts`) and validates with the real `soloScanSchema`, so the
comparison is faithful.

### The pieces (6 scoped commits on the branch)

1. **Tooling** (`393d486`) — root `tsx` + `vitest` dev deps; `scan:compare` /
   `scan:compare:test` scripts; `eval/tsconfig.json` (a `shared/*` → `packages/shared/src/*`
   path alias so `tsx` resolves the bare specifier the edge function's `deno.json`
   normally handles); `eval/vitest.config.ts` (isolated, own `^shared/` alias, node env);
   `.gitignore` for `eval/cases/*` (test photos) and `eval/out/` (run output).
2. **Types + model config** (`types.ts`, `models.ts`) — `MODELS` array with **per-model
   API keys** (`GEMINI_API_KEY` for 2.5, `GEMINI_API_KEY_35` for 3.5, falling back to the
   former — the two models live in separate Google projects under one billing account)
   and a **per-model thinking knob**: 2.5 keeps `thinkingConfig.thinkingBudget: 0`; 3.5
   sends `thinkingLevel: 'low'` (Gemini 3.x replaced `thinkingBudget` with `thinking_level`).
3. **Case discovery** (`cases.ts`) — `discoverCases()` reads `eval/cases/<name>/` folders,
   loading `face.*` and/or `outfit.*` (jpg/png/webp) as base64. Either or both → exercises
   all three scan modes. Empty folders skipped.
4. **Additive `gemini.ts` change** — `GeminiOpts` gains optional `thinkingConfig` +
   `maxOutputTokens`; `buildBody` now takes the full opts and is **exported** (testable),
   defaulting to the old values so **production behavior is unchanged**. This is the only
   edit to shipping code.
5. **HTML report** (`report.ts`, `fixtures.ts`) — `renderReport()` lays out, per case:
   input image(s), a **Face Card** panel (verdict line, strongest/improvement/summary,
   the 7 face scores, presentation), an **Outfit Card** panel (works/hurts/verdict/caption,
   the nameplate with an accent swatch, the 9 outfit scores), a **Banks table** (which
   archetype/caption/sticker/punchline IDs each model picked), and a meta footer
   (schema ✓/✗, latency, tokens, cost). All HTML-escaped.
6. **Orchestration** (`compare.ts`) — `runCompare()` discovers cases, runs every model per
   case (sequential), times each call, `safeParse`s against `soloScanSchema`, computes cost,
   and writes `eval/out/<timestamp>/{report.html,results.json}`. A CLI guard runs it only
   when invoked directly (so tests can import it). Failures (call error or schema-invalid)
   are captured per-cell, not fatal.

## What I learned / gotchas

- **`gemini.ts` is Deno-flavored but Node-safe** — it uses only `fetch` /
  `AbortSignal.timeout` / `setTimeout`, no `Deno.*`, so it runs unmodified under Node 24.
  Only the bare `shared/...` import needed bridging (the tsconfig/vitest aliases).
- **`tsx --tsconfig <path>`** is the reliable way to apply the `paths` alias from the repo
  root (don't rely on cwd-based tsconfig auto-detection). Verified: a no-cases run loads the
  full module graph and hits the guard cleanly.
- **Two test runners coexist** — the web app's vitest is untouched; the harness has its own
  config invoked via `-c`, so `npm test` and `npm run scan:compare:test` don't collide.

## Verification

- ✅ `npm run scan:compare:test` → 19 passing (models, cases, gemini-body, report, mocked
  orchestration).
- ✅ CLI wiring: `npm run scan:compare` with no cases loads everything and prints the guard.
- ⏳ **Live smoke (Task 7, user):** drop a real photo at `eval/cases/smoke/face.jpg`, run
  `GEMINI_API_KEY=… GEMINI_API_KEY_35=… npm run scan:compare`, open the printed `report.html`.
  If 3.5 returns `gemini_http_400` (thinking field) or `schema ✗` (truncation), tune
  `eval/models.ts` (`thinkingLevel` value / `maxOutputTokens`) and re-run.
- ⏳ **Open items:** confirm `gemini-3.5-flash` pricing (placeholder = 2.5 rates) and the
  exact `thinking_level` value the API accepts.
- 🔐 Rotate the 3.5 key pasted in chat once testing is done.
