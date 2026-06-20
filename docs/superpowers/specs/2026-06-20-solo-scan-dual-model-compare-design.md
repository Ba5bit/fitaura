# Solo Scan — dual-model comparison harness

- **Date:** 2026-06-20
- **Status:** Approved (design), pending implementation plan
- **Author:** Almas + Claude

## Goal

Run the same test photo(s) through **two Gemini models** using the **exact production
prompt and schema**, and produce a side-by-side report so we can eyeball which model
writes better roasts, adheres to the schema, and at what cost/latency. This is an
offline evaluation tool, not a production feature.

Default models compared: `gemini-2.5-flash` (current) vs `gemini-3.5-flash` (candidate).

## Non-goals

- No prompt or schema rewrite — we compare **models, not prompts**. The production
  `SYSTEM_INSTRUCTION` / `RESPONSE_SCHEMA` are reused verbatim so the only variable is
  the model ID.
- No `assembleResult` / final card rendering — raw Gemini output is the model
  differentiator; assembly adds caption-bank randomness that muddies the comparison.
- No production traffic split / live A/B. Purely local, on-demand.

## Core principle

The harness imports and reuses the production call path (`callGemini`,
`SYSTEM_INSTRUCTION`, `RESPONSE_SCHEMA` from `supabase/functions/solo-scan/gemini.ts`)
so the request sent to each model is identical except for the model ID and the
per-model thinking parameter. No forked prompt to drift out of sync.

## Runtime & location

- **Deno script** at `supabase/functions/solo-scan/compare.ts`. Placing it beside the
  edge function means it inherits the existing `deno.json` import map
  (`shared/` → `../../../packages/shared/src/`) and can `import './gemini.ts'` and
  `import 'shared/solo-scan/schema.ts'` directly with no extra config.
- **Run:** `deno run --allow-net --allow-read --allow-env supabase/functions/solo-scan/compare.ts`
- **Prerequisite:** the `deno` CLI on PATH. If unavailable, fallback is a Node + `tsx`
  variant with tsconfig path aliases (more setup); confirm at implementation time.

## Inputs (test cases)

- Cases live under `supabase/functions/solo-scan/eval/cases/<case-name>/`.
- Each case folder contains `face.jpg` and/or `outfit.jpg` (either or both present →
  exercises face-only, outfit-only, and combined scan modes). `.png` / `.webp` also
  accepted.
- The script auto-discovers every subfolder of `eval/cases/`.
- `eval/cases/` and `eval/out/` are **gitignored** — test faces and run output are
  never committed.

## Models config

A small in-script array, each entry:

```ts
{ id: 'gemini-2.5-flash', keyEnv: 'GEMINI_API_KEY',    thinking: { budget: 0 },        priceIn: 0.3, priceOut: 2.5 }
{ id: 'gemini-3.5-flash', keyEnv: 'GEMINI_API_KEY_35', thinking: { level: 'minimal' }, priceIn: ?,   priceOut: ?  }
```

- **Per-model API key:** each model reads its own env var; `GEMINI_API_KEY_35` falls
  back to `GEMINI_API_KEY` when unset. This supports the two models being on different
  keys / projects / billing.
- **Per-model thinking knob:** 2.5 uses `thinkingConfig.thinkingBudget: 0`; 3.5 Flash
  uses the newer `thinking_level` parameter (`minimal | low | medium | high`) — there
  is no full "off", so the lowest level is used to keep it fast/cheap.
- Adding a third model (e.g. `gemini-3-flash-preview`) is one array entry.

### Required change to production code

One small **additive** change to `gemini.ts`: extend `GeminiOpts` with an optional
`thinking` override and have `buildBody` apply it (default stays
`thinkingConfig.thinkingBudget: 0`, so production behavior is unchanged). This is the
only edit to shipping code; everything else is new files.

## What it captures (per case × model)

- Raw Gemini JSON response.
- `soloScanSchema.safeParse` result — **valid? yes/no** (the real schema-adherence test)
  and, if invalid, the Zod error paths.
- Latency (ms), token usage (input / output / total), estimated cost.
- On call failure: the `GeminiError` code (e.g. `gemini_http_400`, `gemini_invalid_json`).

## Output (the side-by-side)

Each run writes to `eval/out/<timestamp>/`:

- **`report.html`** — one section per case:
  - The input image(s) rendered at the top of the section.
  - A **2-column table** (`gemini-2.5-flash` | `gemini-3.5-flash`) with rows for:
    - copy fields: `faceCopy` (strongestPoint, improvement, summary, verdictLine),
      `outfitCopy` (works, hurts, verdict, captionLine), `outfitNameplate`
      (name, eyebrow, tagline, lane, accentHex, dossier)
    - category scores: `faceAnalysis` + `outfitAnalysis` ratings
    - `presentation`: gender / genderConfidence / ageEstimate / recognizedIcon / kind
    - meta footer: ✓/✗ schema valid, latency, tokens, estimated cost
  - Open in a browser; compare the columns directly.
- **`results.json`** — the full raw capture (both models, all cases) for diffing or
  later scripting.

## Security

- API keys are **never** written to disk or committed; read from env at run time only.
- The 3.5 key shared in chat on 2026-06-20 is considered exposed — **rotate it** in
  Google AI Studio after testing.

## Open items to confirm during implementation

1. Exact REST field name/shape for Gemini 3.x thinking control under
   `generationConfig` (`thinkingConfig.thinkingLevel` vs `thinking_level`).
2. `gemini-3.5-flash` input/output price per Mtok for the cost estimate.
3. Whether 3.5's thinking consumes enough output budget to need `maxOutputTokens`
   raised above the current 2900 (the harness surfaces truncation via empty/invalid
   JSON, so this is observable, not blocking).
```
