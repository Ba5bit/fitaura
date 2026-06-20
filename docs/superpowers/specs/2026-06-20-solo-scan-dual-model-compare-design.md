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

Deno is not installed; the environment has **Node 24 + npm workspaces**. The harness
runs under **Node via `tsx`**.

- Harness lives under `supabase/functions/solo-scan/eval/` (entry `compare.ts`), beside
  the edge function so it imports the production call path with `import '../gemini.ts'`.
- `gemini.ts` uses only web-standard APIs (`fetch`, `AbortSignal.timeout`, `setTimeout`),
  no `Deno.*`, so it runs unmodified under Node 24.
- The `shared/...` bare specifier (which only `deno.json` knows) is resolved for Node by
  a tsconfig `paths` alias: `"shared/*": ["<repo>/packages/shared/src/*"]`, in a dedicated
  `eval/tsconfig.json`. `zod` resolves from the workspace `node_modules`. `tsx`/esbuild
  resolves the `.ts` import extensions at runtime (no `tsc` step).
- **New dev dependency:** add `tsx` (root devDependency). Provide an npm script, e.g.
  `"scan:compare": "tsx --tsconfig supabase/functions/solo-scan/eval/tsconfig.json supabase/functions/solo-scan/eval/compare.ts"`.
- **Run:** `GEMINI_API_KEY=... GEMINI_API_KEY_35=... npm run scan:compare`

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

Each run writes to `eval/out/<timestamp>/`. The report is organized **by card**, with
the two models side-by-side (`gemini-2.5-flash` | `gemini-3.5-flash`), built from raw
Gemini fields (these are card-shaped HTML panels, NOT the production React card
components and NOT `assembleResult`).

- **`report.html`** — one section per case:
  - Input image(s) rendered at the top of the section.
  - **Face Card** — a 2-column panel (2.5 | 3.5):
    - `faceCopy.verdictLine` (lead / punch) as the title, then `strongestPoint`,
      `improvement`, `summary`
    - `faceAnalysis` category scores (the 7 face ratings)
    - `presentation`: gender / genderConfidence / ageEstimate / recognizedIcon / kind
  - **Outfit Card** — a 2-column panel (2.5 | 3.5):
    - `outfitCopy` (works / hurts / verdict / captionLine)
    - `outfitNameplate` (name / eyebrow / tagline / lane / `accentHex` shown as a colour
      swatch / dossier rows)
    - `outfitAnalysis` category scores (the 9 outfit ratings)
  - **Banks table** — a 2-column table comparing the candidate banks each model returned,
    so you can see which IDs each picked: `faceArchetypeCandidates`,
    `outfitCaptionCandidates`, `stickerCandidates`, `contentTags`, `metricCandidates`,
    `punchlineCandidates`, and `punchlineText`.
  - **Meta footer** per model: ✓/✗ schema valid, latency, tokens, estimated cost.
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
