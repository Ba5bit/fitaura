# Solo Scan Dual-Model Comparison Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Node/`tsx` harness that runs the same test photos through `gemini-2.5-flash` and `gemini-3.5-flash` using the exact production prompt/schema, and emits a side-by-side HTML report (Face Card, Outfit Card, banks table) plus a raw JSON dump.

**Architecture:** New files under `supabase/functions/solo-scan/eval/`. The harness reuses the production call path by importing `callGemini` from `../gemini.ts` and validating with `soloScanSchema` from `shared/solo-scan/schema.ts` — so the only variable between columns is the model id and its thinking knob. The one production edit is an additive thinking/token override on `gemini.ts`. Pure functions (case discovery, cost, HTML render) are unit-tested with vitest; the live API call is covered by a mocked orchestration test plus a manual smoke run.

**Tech Stack:** Node 24, TypeScript via `tsx`, vitest, zod (existing), Gemini REST (existing `gemini.ts`).

---

## File Structure

**New (committed):**
- `supabase/functions/solo-scan/eval/types.ts` — shared interfaces (`ModelConfig`, `ScanInput`, `ModelOutcome`, `CaseResult`, `RunResult`)
- `supabase/functions/solo-scan/eval/models.ts` — `MODELS` config, `resolveKey`, `estimateCost`
- `supabase/functions/solo-scan/eval/cases.ts` — `discoverCases` (folder → base64 inputs)
- `supabase/functions/solo-scan/eval/report.ts` — `renderReport(run, inputs)` → HTML
- `supabase/functions/solo-scan/eval/compare.ts` — `runCompare(...)` orchestration + CLI entry
- `supabase/functions/solo-scan/eval/fixtures.ts` — `sampleAIOutput()` valid output, shared by tests
- `supabase/functions/solo-scan/eval/tsconfig.json` — `shared/*` path alias for tsx
- `supabase/functions/solo-scan/eval/vitest.config.ts` — eval test config + `shared/` alias
- `supabase/functions/solo-scan/eval/README.md` — how to add cases + run
- `supabase/functions/solo-scan/eval/cases/.gitkeep` — keeps the (gitignored) cases dir

**New (tests):**
- `eval/models.test.ts`, `eval/cases.test.ts`, `eval/report.test.ts`, `eval/compare.test.ts`, `eval/gemini-body.test.ts`

**Modified:**
- `supabase/functions/solo-scan/gemini.ts` — export `buildBody` + `GeminiOpts`; add `thinkingConfig`/`maxOutputTokens` overrides
- `package.json` (root) — add `tsx` + `vitest` dev deps and `scan:compare` / `scan:compare:test` scripts
- `.gitignore` — ignore `eval/cases/*` (except `.gitkeep`) and `eval/out/`

---

## Task 1: Tooling, config, and scaffolding

**Files:**
- Modify: `package.json` (root)
- Modify: `.gitignore`
- Create: `supabase/functions/solo-scan/eval/tsconfig.json`
- Create: `supabase/functions/solo-scan/eval/vitest.config.ts`
- Create: `supabase/functions/solo-scan/eval/cases/.gitkeep`
- Create: `supabase/functions/solo-scan/eval/README.md`

- [ ] **Step 1: Add dev deps + scripts to root `package.json`**

In the root `package.json`, add two scripts and a `devDependencies` block (the file currently has no `devDependencies`):

```json
  "scripts": {
    "dev": "npm run dev --workspace @fitaura/web",
    "build": "npm run build --workspace @fitaura/web",
    "preview": "npm run preview --workspace @fitaura/web",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "scan:compare": "tsx --tsconfig supabase/functions/solo-scan/eval/tsconfig.json supabase/functions/solo-scan/eval/compare.ts",
    "scan:compare:test": "vitest run -c supabase/functions/solo-scan/eval/vitest.config.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "vitest": "^4.1.8"
  },
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes, `node_modules/.bin/tsx` and `node_modules/.bin/vitest` exist.

Verify: `npx tsx --version`
Expected: prints a version (e.g. `tsx v4.x`).

- [ ] **Step 3: Append harness ignores to `.gitignore`**

Append to the end of `.gitignore`:

```gitignore

# Solo Scan model-comparison harness (local test photos + run output)
supabase/functions/solo-scan/eval/cases/*
!supabase/functions/solo-scan/eval/cases/.gitkeep
supabase/functions/solo-scan/eval/out/
```

- [ ] **Step 4: Create `eval/tsconfig.json` (path alias so tsx resolves `shared/*`)**

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "baseUrl": ".",
    "paths": {
      "shared/*": ["../../../../packages/shared/src/*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 5: Create `eval/vitest.config.ts` (isolated test config + `shared/` alias)**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^shared\//,
        replacement: fileURLToPath(new URL('../../../../packages/shared/src/', import.meta.url)),
      },
    ],
  },
});
```

- [ ] **Step 6: Create `eval/cases/.gitkeep`**

Empty file (keeps the otherwise-gitignored cases dir present after clone).

- [ ] **Step 7: Create `eval/README.md`**

````markdown
# Solo Scan dual-model comparison harness

Runs the same photos through `gemini-2.5-flash` and `gemini-3.5-flash` with the exact
production prompt/schema and emits a side-by-side HTML report.

## Add test cases

Create one folder per case under `eval/cases/`:

```
eval/cases/alice/face.jpg
eval/cases/bob/face.png
eval/cases/bob/outfit.webp
eval/cases/coat/outfit.jpg      # outfit-only is fine
```

`face.*` and/or `outfit.*` (`.jpg` `.jpeg` `.png` `.webp`). Either or both. The
`cases/` and `out/` folders are gitignored — test photos never get committed.

## Run

bash:

```bash
GEMINI_API_KEY=<2.5 key> GEMINI_API_KEY_35=<3.5 key> npm run scan:compare
```

PowerShell:

```powershell
$env:GEMINI_API_KEY="<2.5 key>"; $env:GEMINI_API_KEY_35="<3.5 key>"; npm run scan:compare
```

`GEMINI_API_KEY_35` falls back to `GEMINI_API_KEY` if unset. Output lands in
`eval/out/<timestamp>/report.html` (open in a browser) and `results.json`.

## Test the harness

```bash
npm run scan:compare:test
```
````

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore supabase/functions/solo-scan/eval/tsconfig.json supabase/functions/solo-scan/eval/vitest.config.ts supabase/functions/solo-scan/eval/cases/.gitkeep supabase/functions/solo-scan/eval/README.md
git commit -m "chore(eval): scaffold Solo Scan dual-model compare harness tooling"
```

---

## Task 2: Types + model config

**Files:**
- Create: `supabase/functions/solo-scan/eval/types.ts`
- Create: `supabase/functions/solo-scan/eval/models.ts`
- Test: `supabase/functions/solo-scan/eval/models.test.ts`

- [ ] **Step 1: Create `eval/types.ts`**

```ts
import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';

/** A base64 image part, matching gemini.ts InlineImage. */
export interface InlineImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface ModelConfig {
  id: string;
  keyEnv: string; // env var holding this model's API key
  thinkingConfig: Record<string, unknown>; // generationConfig.thinkingConfig payload
  maxOutputTokens?: number;
  priceIn: number; // USD per 1M input tokens
  priceOut: number; // USD per 1M output tokens
}

export interface ScanInput {
  name: string; // case folder name
  face?: InlineImage;
  outfit?: InlineImage;
}

export interface ModelOutcome {
  modelId: string;
  ok: boolean; // the API call returned without throwing
  raw: unknown; // parsed JSON from Gemini (null on hard failure)
  parsed: SoloScanAIOutput | null; // present iff schema valid
  schemaValid: boolean;
  schemaErrors?: string[]; // zod issue paths when invalid
  error?: string; // GeminiError code on call failure
  latencyMs: number;
  usage: { input: number; output: number; total: number };
  costUsd: number;
}

export interface CaseResult {
  name: string;
  hasFace: boolean;
  hasOutfit: boolean;
  outcomes: ModelOutcome[]; // one per model, in MODELS order
}

export interface RunResult {
  startedAt: string; // ISO timestamp
  models: string[]; // model ids in column order
  cases: CaseResult[];
}
```

- [ ] **Step 2: Write the failing test `eval/models.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { MODELS, resolveKey, estimateCost } from './models.ts';
import type { ModelConfig } from './types.ts';

describe('resolveKey', () => {
  it('prefers the model-specific env var', () => {
    const cfg = MODELS.find((m) => m.id === 'gemini-3.5-flash')!;
    expect(resolveKey(cfg, { GEMINI_API_KEY_35: 'k35', GEMINI_API_KEY: 'base' })).toBe('k35');
  });

  it('falls back to GEMINI_API_KEY when the specific var is unset', () => {
    const cfg = MODELS.find((m) => m.id === 'gemini-3.5-flash')!;
    expect(resolveKey(cfg, { GEMINI_API_KEY: 'base' })).toBe('base');
  });

  it('returns undefined when neither is set', () => {
    const cfg = MODELS.find((m) => m.id === 'gemini-3.5-flash')!;
    expect(resolveKey(cfg, {})).toBeUndefined();
  });
});

describe('estimateCost', () => {
  it('computes cost from per-Mtok prices', () => {
    const cfg: ModelConfig = { id: 'x', keyEnv: 'X', thinkingConfig: {}, priceIn: 0.3, priceOut: 2.5 };
    // 1e6 in * 0.3/1e6 = 0.3 ; 1e6 out * 2.5/1e6 = 2.5 ; total 2.8
    expect(estimateCost({ input: 1_000_000, output: 1_000_000 }, cfg)).toBe(2.8);
  });
});

describe('MODELS', () => {
  it('compares 2.5 and 3.5 flash with distinct key env vars', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['gemini-2.5-flash', 'gemini-3.5-flash']);
    expect(MODELS[0].keyEnv).toBe('GEMINI_API_KEY');
    expect(MODELS[1].keyEnv).toBe('GEMINI_API_KEY_35');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run scan:compare:test`
Expected: FAIL — `Failed to resolve import "./models.ts"` (file not created yet).

- [ ] **Step 4: Create `eval/models.ts`**

```ts
import type { ModelConfig } from './types.ts';

export const MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-flash',
    keyEnv: 'GEMINI_API_KEY',
    thinkingConfig: { thinkingBudget: 0 },
    priceIn: 0.3,
    priceOut: 2.5,
  },
  {
    id: 'gemini-3.5-flash',
    keyEnv: 'GEMINI_API_KEY_35',
    // Gemini 3.x replaces thinkingBudget with thinking_level (minimal|low|medium|high).
    // If the API 400s on this value, adjust per the model's current docs.
    thinkingConfig: { thinkingLevel: 'low' },
    // Thinking can consume output budget; give 3.5 a little more headroom than 2.5's 2900.
    maxOutputTokens: 4096,
    // TODO: confirm gemini-3.5-flash pricing; using 2.5 rates as a placeholder estimate.
    priceIn: 0.3,
    priceOut: 2.5,
  },
];

/** Resolve a model's API key: its own env var first, then GEMINI_API_KEY fallback. */
export function resolveKey(
  cfg: ModelConfig,
  env: Record<string, string | undefined>,
): string | undefined {
  return env[cfg.keyEnv] || env.GEMINI_API_KEY;
}

/** Estimate USD cost from token usage and the model's per-Mtok prices. */
export function estimateCost(
  usage: { input: number; output: number },
  cfg: ModelConfig,
): number {
  const cost = (usage.input / 1e6) * cfg.priceIn + (usage.output / 1e6) * cfg.priceOut;
  return Number(cost.toFixed(6));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run scan:compare:test`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/solo-scan/eval/types.ts supabase/functions/solo-scan/eval/models.ts supabase/functions/solo-scan/eval/models.test.ts
git commit -m "feat(eval): model config with per-model keys + cost estimate"
```

---

## Task 3: Case discovery

**Files:**
- Create: `supabase/functions/solo-scan/eval/cases.ts`
- Test: `supabase/functions/solo-scan/eval/cases.test.ts`

- [ ] **Step 1: Write the failing test `eval/cases.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverCases } from './cases.ts';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'cases-'));
  // "alice": face only (jpg)
  mkdirSync(join(root, 'alice'));
  writeFileSync(join(root, 'alice', 'face.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  // "bob": face (png) + outfit (webp)
  mkdirSync(join(root, 'bob'));
  writeFileSync(join(root, 'bob', 'face.png'), Buffer.from([0x89, 0x50, 0x4e]));
  writeFileSync(join(root, 'bob', 'outfit.webp'), Buffer.from([0x52, 0x49, 0x46]));
  // "empty": no images — must be skipped
  mkdirSync(join(root, 'empty'));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('discoverCases', () => {
  it('finds cases with face and/or outfit, skips empty folders, sorted', () => {
    const cases = discoverCases(root);
    expect(cases.map((c) => c.name)).toEqual(['alice', 'bob']);
  });

  it('detects modality + mime per image and loads base64', () => {
    const cases = discoverCases(root);
    const alice = cases.find((c) => c.name === 'alice')!;
    expect(alice.face?.mimeType).toBe('image/jpeg');
    expect(alice.outfit).toBeUndefined();
    expect(typeof alice.face?.data).toBe('string');
    const bob = cases.find((c) => c.name === 'bob')!;
    expect(bob.face?.mimeType).toBe('image/png');
    expect(bob.outfit?.mimeType).toBe('image/webp');
  });

  it('returns [] for a missing directory', () => {
    expect(discoverCases(join(root, 'nope'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run scan:compare:test`
Expected: FAIL — cannot resolve `./cases.ts`.

- [ ] **Step 3: Create `eval/cases.ts`**

```ts
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { InlineImage, ScanInput } from './types.ts';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** First matching `<base>.<ext>` in `dir`, loaded as a base64 InlineImage. */
function findImage(dir: string, base: string): InlineImage | undefined {
  for (const ext of Object.keys(MIME)) {
    const p = join(dir, base + ext);
    if (existsSync(p)) {
      return { mimeType: MIME[ext], data: readFileSync(p).toString('base64') };
    }
  }
  return undefined;
}

/** Discover every case subfolder under `casesDir`, loading face/outfit as base64. */
export function discoverCases(casesDir: string): ScanInput[] {
  if (!existsSync(casesDir)) return [];
  const out: ScanInput[] = [];
  for (const name of readdirSync(casesDir).sort()) {
    const dir = join(casesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const face = findImage(dir, 'face');
    const outfit = findImage(dir, 'outfit');
    if (!face && !outfit) continue; // skip folders with no usable image
    out.push({ name, face, outfit });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run scan:compare:test`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/solo-scan/eval/cases.ts supabase/functions/solo-scan/eval/cases.test.ts
git commit -m "feat(eval): discover case folders and load images as base64"
```

---

## Task 4: Additive thinking/token override on `gemini.ts`

**Files:**
- Modify: `supabase/functions/solo-scan/gemini.ts`
- Test: `supabase/functions/solo-scan/eval/gemini-body.test.ts`

- [ ] **Step 1: Write the failing test `eval/gemini-body.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildBody } from '../gemini.ts';

describe('buildBody', () => {
  it('defaults to thinkingBudget 0 and 2900 max tokens', () => {
    const body = buildBody({
      apiKey: 'x',
      model: 'gemini-2.5-flash',
      face: { mimeType: 'image/jpeg', data: 'AAAA' },
    });
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.generationConfig.maxOutputTokens).toBe(2900);
  });

  it('applies thinkingConfig + maxOutputTokens overrides', () => {
    const body = buildBody({
      apiKey: 'x',
      model: 'gemini-3.5-flash',
      outfit: { mimeType: 'image/png', data: 'BBBB' },
      thinkingConfig: { thinkingLevel: 'low' },
      maxOutputTokens: 4096,
    });
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
  });

  it('labels and inlines the provided image part', () => {
    const body = buildBody({
      apiKey: 'x',
      model: 'm',
      face: { mimeType: 'image/jpeg', data: 'AAAA' },
    });
    const s = JSON.stringify(body.contents);
    expect(s).toContain('IMAGE: FACE PHOTO');
    expect(s).toContain('AAAA');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run scan:compare:test`
Expected: FAIL — `buildBody` is not exported from `../gemini.ts`.

- [ ] **Step 3: Edit `gemini.ts` — export `GeminiOpts`, add overrides**

Change the `GeminiOpts` interface (currently around line 154) to export it and add two optional fields:

```ts
export interface GeminiOpts {
  apiKey: string;
  model: string;
  face?: InlineImage;
  outfit?: InlineImage;
  /** Overrides generationConfig.thinkingConfig (default { thinkingBudget: 0 }). */
  thinkingConfig?: Record<string, unknown>;
  /** Overrides generationConfig.maxOutputTokens (default 2900). */
  maxOutputTokens?: number;
}
```

- [ ] **Step 4: Edit `gemini.ts` — make `buildBody` take opts, export it, apply overrides**

Replace the existing `buildBody` function (currently `function buildBody(face?: InlineImage, outfit?: InlineImage) { ... }`, around lines 173-194) with:

```ts
export function buildBody(opts: GeminiOpts) {
  const parts: Array<Record<string, unknown>> = [];
  if (opts.face) {
    parts.push({ text: 'IMAGE: FACE PHOTO' });
    parts.push({ inlineData: { mimeType: opts.face.mimeType, data: opts.face.data } });
  }
  if (opts.outfit) {
    parts.push({ text: 'IMAGE: OUTFIT PHOTO' });
    parts.push({ inlineData: { mimeType: opts.outfit.mimeType, data: opts.outfit.data } });
  }
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 2900,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: opts.thinkingConfig ?? { thinkingBudget: 0 },
    },
  };
}
```

- [ ] **Step 5: Edit `gemini.ts` — update the call site in `once`**

In `once` (around line 203), change the body line from `body: JSON.stringify(buildBody(opts.face, opts.outfit)),` to:

```ts
    body: JSON.stringify(buildBody(opts)),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run scan:compare:test`
Expected: PASS (12 tests total).

- [ ] **Step 7: Verify production behavior unchanged (edge function still type-clean)**

Confirm `index.ts` still calls `callGemini({ apiKey, model, face, outfit })` with no new required args — it does (the new fields are optional). No edit needed.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/solo-scan/gemini.ts supabase/functions/solo-scan/eval/gemini-body.test.ts
git commit -m "feat(gemini): optional thinkingConfig + maxOutputTokens override (additive)"
```

---

## Task 5: Test fixture + HTML report renderer

**Files:**
- Create: `supabase/functions/solo-scan/eval/fixtures.ts`
- Create: `supabase/functions/solo-scan/eval/report.ts`
- Test: `supabase/functions/solo-scan/eval/report.test.ts`

- [ ] **Step 1: Create the shared fixture `eval/fixtures.ts`**

A schema-valid `SoloScanAIOutput` reused by report + compare tests (keeps tests DRY).

```ts
import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';

/** A fully schema-valid Gemini output for tests. Pass overrides to vary fields. */
export function sampleAIOutput(over: Partial<SoloScanAIOutput> = {}): SoloScanAIOutput {
  const r = (rating: number, evidence: string) => ({ rating, confidence: 1, evidence });
  return {
    schemaVersion: 'solo_scan_v3_5',
    inputQuality: {
      usable: true,
      faceUsable: true,
      outfitUsable: true,
      samePersonLikely: null,
      issues: [],
      retakeInstruction: null,
    },
    presentation: {
      gender: 'masc',
      genderConfidence: 0.9,
      expressionStrength: 50,
      ageEstimate: 27,
      recognizedIcon: null,
      recognizedConfidence: 0,
      recognizedKind: null,
    },
    faceAnalysis: {
      photoPresentation: r(70, 'sharp'),
      faceHarmony: r(60, 'balanced'),
      jawPresence: r(80, 'strong'),
      haircutMatch: r(55, 'meh'),
      groomingCoherence: r(65, 'clean'),
      visualPresence: r(72, 'loud'),
      mainCharacterEnergy: r(77, 'yes'),
    },
    outfitAnalysis: {
      fit: r(64, 'tuck it'),
      silhouette: r(60, 'okay'),
      proportions: r(58, 'off'),
      colorCoherence: r(70, 'tonal'),
      physiqueMatch: r(62, 'fine'),
      layering: r(50, 'flat'),
      accessories: r(40, 'none'),
      stylingIntent: r(66, 'there'),
      overallCohesion: r(68, 'cohesive'),
    },
    faceCopy: {
      strongestPoint: 'JAWLINE LOADED',
      improvement: 'eyes asleep',
      summary: 'mid boss energy',
      verdictLine: { lead: 'JAW DID', punch: 'THE TALKING' },
    },
    outfitCopy: {
      works: 'tonal armor',
      hurts: 'shoes betrayed you',
      verdict: 'eats, leaves no crumbs',
      captionLine: 'quiet luxury loud ego',
    },
    outfitNameplate: {
      name: 'DENIM ARMORY',
      eyebrow: 'All-black streetwear',
      tagline: 'controlled chaos in cotton',
      lane: 'Streetwear',
      accentHex: '#3344ff',
      dossier: [{ label: 'Signature', value: 'Trucker jacket' }],
    },
    contentSelection: {
      faceArchetypeCandidates: ['face_archetype.goat'],
      outfitCaptionCandidates: ['outfit_caption.rizz'],
      stickerCandidates: ['sticker.aura'],
      contentTags: ['streetwear'],
    },
    receiptContent: {
      metricCandidates: ['metric.rizz'],
      punchlineCandidates: ['punchline.no_cap'],
      punchlineText: 'NO CAP DETECTED',
    },
    ...over,
  };
}
```

- [ ] **Step 2: Write the failing test `eval/report.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { renderReport } from './report.ts';
import { sampleAIOutput } from './fixtures.ts';
import type { ModelOutcome, RunResult, ScanInput } from './types.ts';

function outcome(modelId: string, over: Partial<ModelOutcome> = {}): ModelOutcome {
  const parsed = sampleAIOutput();
  return {
    modelId,
    ok: true,
    raw: parsed,
    parsed,
    schemaValid: true,
    latencyMs: 1234,
    usage: { input: 1000, output: 500, total: 1500 },
    costUsd: 0.0015,
    ...over,
  };
}

const run: RunResult = {
  startedAt: '2026-06-20T00:00:00.000Z',
  models: ['gemini-2.5-flash', 'gemini-3.5-flash'],
  cases: [
    {
      name: 'bob',
      hasFace: true,
      hasOutfit: true,
      outcomes: [outcome('gemini-2.5-flash'), outcome('gemini-3.5-flash', { latencyMs: 800 })],
    },
  ],
};

const inputs: ScanInput[] = [
  { name: 'bob', face: { mimeType: 'image/jpeg', data: 'AAAA' }, outfit: { mimeType: 'image/png', data: 'BBBB' } },
];

describe('renderReport', () => {
  it('renders both model columns', () => {
    const html = renderReport(run, inputs);
    expect(html).toContain('gemini-2.5-flash');
    expect(html).toContain('gemini-3.5-flash');
  });

  it('renders face verdict, outfit nameplate, and the banks rows', () => {
    const html = renderReport(run, inputs);
    expect(html).toContain('THE TALKING'); // face verdictLine.punch
    expect(html).toContain('DENIM ARMORY'); // nameplate.name
    expect(html).toContain('faceArchetypeCandidates'); // banks label
    expect(html).toContain('face_archetype.goat'); // banks value
    expect(html).toContain('NO CAP DETECTED'); // receipt punchlineText
  });

  it('embeds input images as data URIs', () => {
    const html = renderReport(run, inputs);
    expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).toContain('data:image/png;base64,BBBB');
  });

  it('escapes HTML in copy fields', () => {
    const evil = outcome('gemini-2.5-flash', {
      parsed: sampleAIOutput({
        faceCopy: {
          strongestPoint: '<script>x</script>',
          improvement: 'a',
          summary: 'b',
          verdictLine: { lead: 'l', punch: 'p' },
        },
      }),
    });
    const html = renderReport({ ...run, cases: [{ name: 'x', hasFace: true, hasOutfit: false, outcomes: [evil] }] }, []);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows schema ✗ and the error for a failed outcome', () => {
    const failed = outcome('gemini-2.5-flash', { ok: false, raw: null, parsed: null, schemaValid: false, error: 'gemini_http_400' });
    const html = renderReport({ ...run, cases: [{ name: 'x', hasFace: true, hasOutfit: false, outcomes: [failed] }] }, []);
    expect(html).toContain('✗');
    expect(html).toContain('gemini_http_400');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run scan:compare:test`
Expected: FAIL — cannot resolve `./report.ts`.

- [ ] **Step 4: Create `eval/report.ts`**

```ts
import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';
import type { CaseResult, InlineImage, ModelOutcome, RunResult, ScanInput } from './types.ts';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Analysis = Record<string, { rating: number | null; confidence: number; evidence: string }>;

function scoreGrid(analysis: Analysis): string {
  const rows = Object.entries(analysis)
    .map(
      ([k, v]) =>
        `<tr><td class="k">${esc(k)}</td><td class="n">${v.rating ?? '—'}</td><td class="ev">${esc(v.evidence)}</td></tr>`,
    )
    .join('');
  return `<table class="scores">${rows}</table>`;
}

function colHead(o: ModelOutcome): string {
  return `<div class="model">${esc(o.modelId)}</div>`;
}

function faceCard(o: ModelOutcome): string {
  if (!o.parsed) return `<div class="card-col empty">${colHead(o)}${esc(o.error ?? 'schema invalid')}</div>`;
  const p = o.parsed;
  const v = p.faceCopy.verdictLine;
  const pr = p.presentation;
  return `<div class="card-col">${colHead(o)}
    <div class="title">${esc(v.lead)} <b>${esc(v.punch)}</b></div>
    <div class="row"><span>strongest</span>${esc(p.faceCopy.strongestPoint)}</div>
    <div class="row"><span>improvement</span>${esc(p.faceCopy.improvement)}</div>
    <div class="row"><span>summary</span>${esc(p.faceCopy.summary)}</div>
    <div class="present">gender ${esc(pr.gender)} (${esc(pr.genderConfidence)}) · age ${esc(pr.ageEstimate ?? '—')} · icon ${esc(pr.recognizedIcon ?? '—')}</div>
    ${scoreGrid(p.faceAnalysis)}
  </div>`;
}

function outfitCard(o: ModelOutcome): string {
  if (!o.parsed) return `<div class="card-col empty">${colHead(o)}${esc(o.error ?? 'schema invalid')}</div>`;
  const p = o.parsed;
  const n = p.outfitNameplate;
  const dossier = n.dossier.map((d) => `<li><b>${esc(d.label)}</b> ${esc(d.value)}</li>`).join('');
  return `<div class="card-col">${colHead(o)}
    <div class="nameplate" style="border-color:${esc(n.accentHex)}">
      <div class="eyebrow">${esc(n.eyebrow)}</div>
      <div class="name">${esc(n.name)} <span class="swatch" style="background:${esc(n.accentHex)}"></span></div>
      <div class="tagline">${esc(n.tagline)} · <i>${esc(n.lane)}</i></div>
      <ul class="dossier">${dossier}</ul>
    </div>
    <div class="row"><span>works</span>${esc(p.outfitCopy.works)}</div>
    <div class="row"><span>hurts</span>${esc(p.outfitCopy.hurts)}</div>
    <div class="row"><span>verdict</span>${esc(p.outfitCopy.verdict)}</div>
    <div class="row"><span>caption</span>${esc(p.outfitCopy.captionLine)}</div>
    ${scoreGrid(p.outfitAnalysis)}
  </div>`;
}

function banksTable(outcomes: ModelOutcome[]): string {
  const fields: Array<[string, (p: SoloScanAIOutput) => string[] | string]> = [
    ['faceArchetypeCandidates', (p) => p.contentSelection.faceArchetypeCandidates],
    ['outfitCaptionCandidates', (p) => p.contentSelection.outfitCaptionCandidates],
    ['stickerCandidates', (p) => p.contentSelection.stickerCandidates],
    ['contentTags', (p) => p.contentSelection.contentTags],
    ['metricCandidates', (p) => p.receiptContent.metricCandidates],
    ['punchlineCandidates', (p) => p.receiptContent.punchlineCandidates],
    ['punchlineText', (p) => p.receiptContent.punchlineText],
  ];
  const head = `<tr><th>bank</th>${outcomes.map((o) => `<th>${esc(o.modelId)}</th>`).join('')}</tr>`;
  const rows = fields
    .map(([label, get]) => {
      const cells = outcomes
        .map((o) => {
          if (!o.parsed) return '<td>—</td>';
          const val = get(o.parsed);
          return `<td>${Array.isArray(val) ? val.map(esc).join('<br>') : esc(val)}</td>`;
        })
        .join('');
      return `<tr><td class="k">${esc(label)}</td>${cells}</tr>`;
    })
    .join('');
  return `<table class="banks">${head}${rows}</table>`;
}

function metaFooter(o: ModelOutcome): string {
  const mark = o.schemaValid ? '✓' : '✗';
  const err = o.error ? ` · ${esc(o.error)}` : '';
  return `<span class="meta">${esc(o.modelId)} · schema ${mark} · ${o.latencyMs}ms · ${o.usage.total} tok · $${o.costUsd}${err}</span>`;
}

function imageStrip(input?: ScanInput): string {
  if (!input) return '';
  const fig = (i: InlineImage | undefined, label: string) =>
    i ? `<figure><img src="data:${esc(i.mimeType)};base64,${i.data}"><figcaption>${label}</figcaption></figure>` : '';
  return `<div class="imgs">${fig(input.face, 'face')}${fig(input.outfit, 'outfit')}</div>`;
}

function caseSection(c: CaseResult, input?: ScanInput): string {
  return `<section class="case">
    <h2>${esc(c.name)}</h2>
    ${imageStrip(input)}
    <h3>Face Card</h3>
    <div class="cards">${c.outcomes.map(faceCard).join('')}</div>
    <h3>Outfit Card</h3>
    <div class="cards">${c.outcomes.map(outfitCard).join('')}</div>
    <h3>Banks</h3>
    ${banksTable(c.outcomes)}
    <div class="metas">${c.outcomes.map(metaFooter).join('')}</div>
  </section>`;
}

const STYLE = `
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; margin: 24px; color: #111; background: #fafafa; }
  header h1 { margin: 0 0 4px; }
  header p { color: #666; margin: 0 0 24px; }
  .case { background: #fff; border: 1px solid #e3e3e3; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px; }
  .imgs { display: flex; gap: 12px; }
  .imgs img { height: 160px; border-radius: 8px; border: 1px solid #ddd; }
  figure { margin: 0; }
  figcaption { color: #888; font-size: 12px; text-align: center; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card-col { border: 1px solid #eee; border-radius: 10px; padding: 12px; background: #fcfcfc; }
  .card-col.empty { color: #b00; font-weight: 600; }
  .model { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
  .title { font-weight: 800; font-size: 18px; margin-bottom: 8px; }
  .title b { color: #c026d3; }
  .row { margin: 2px 0; } .row span { display: inline-block; min-width: 92px; color: #888; }
  .present { color: #555; font-size: 12px; margin: 8px 0; }
  .nameplate { border-left: 4px solid; padding: 4px 10px; margin-bottom: 8px; }
  .nameplate .name { font-weight: 800; font-size: 16px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; }
  .eyebrow, .tagline { color: #666; font-size: 12px; }
  .dossier { margin: 6px 0 0; padding-left: 16px; font-size: 12px; color: #555; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; }
  .scores td { border-top: 1px solid #f0f0f0; padding: 2px 6px; }
  .scores .n { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  .scores .ev { color: #777; }
  .banks th, .banks td { border: 1px solid #eee; padding: 4px 8px; vertical-align: top; }
  .banks .k { font-weight: 700; }
  .metas { margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap; }
  .meta { color: #555; font-size: 12px; }
`;

/** Render the full comparison report. `inputs` supplies the per-case images. */
export function renderReport(run: RunResult, inputs: ScanInput[]): string {
  const byName = new Map(inputs.map((i) => [i.name, i]));
  const sections = run.cases.map((c) => caseSection(c, byName.get(c.name))).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Solo Scan — 2.5 vs 3.5</title><style>${STYLE}</style></head>
<body><header><h1>Solo Scan — 2.5 vs 3.5</h1>
<p>${esc(run.startedAt)} · ${run.models.map(esc).join(' | ')}</p></header>
${sections}</body></html>`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run scan:compare:test`
Expected: PASS (17 tests total).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/solo-scan/eval/fixtures.ts supabase/functions/solo-scan/eval/report.ts supabase/functions/solo-scan/eval/report.test.ts
git commit -m "feat(eval): side-by-side HTML report (face card, outfit card, banks)"
```

---

## Task 6: Orchestration (`compare.ts`)

**Files:**
- Create: `supabase/functions/solo-scan/eval/compare.ts`
- Test: `supabase/functions/solo-scan/eval/compare.test.ts`

- [ ] **Step 1: Write the failing test `eval/compare.test.ts`**

Mocks `callGemini` so no real API call happens: model `gemini-2.5-flash` returns a valid output, `gemini-3.5-flash` throws (exercises the failure path). Uses temp dirs for cases + output.

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sampleAIOutput } from './fixtures.ts';

const { callGemini } = vi.hoisted(() => ({ callGemini: vi.fn() }));
vi.mock('../gemini.ts', () => ({ callGemini }));

import { runCompare } from './compare.ts';

beforeEach(() => {
  callGemini.mockReset();
  callGemini.mockImplementation(({ model }: { model: string }) => {
    if (model === 'gemini-3.5-flash') {
      return Promise.reject(new Error('gemini_http_400'));
    }
    return Promise.resolve({ raw: sampleAIOutput(), usage: { input: 1000, output: 500, total: 1500 } });
  });
});

function makeCases(): string {
  const root = mkdtempSync(join(tmpdir(), 'cmp-'));
  mkdirSync(join(root, 'bob'));
  writeFileSync(join(root, 'bob', 'face.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  return root;
}

describe('runCompare', () => {
  it('calls every model per case and writes report.html + results.json', async () => {
    const casesDir = makeCases();
    const outDir = mkdtempSync(join(tmpdir(), 'out-'));
    const env = { GEMINI_API_KEY: 'k', GEMINI_API_KEY_35: 'k35' };

    const { dir, run } = await runCompare({ casesDir, outDir, env });

    // both models attempted for the one case
    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(run.cases).toHaveLength(1);
    expect(run.cases[0].outcomes.map((o) => o.modelId)).toEqual(['gemini-2.5-flash', 'gemini-3.5-flash']);
    expect(run.cases[0].outcomes[0].schemaValid).toBe(true);
    expect(run.cases[0].outcomes[1].ok).toBe(false);
    expect(run.cases[0].outcomes[1].error).toBe('gemini_http_400');

    // files exist
    expect(existsSync(join(dir, 'report.html'))).toBe(true);
    expect(existsSync(join(dir, 'results.json'))).toBe(true);
    const html = readFileSync(join(dir, 'report.html'), 'utf8');
    expect(html).toContain('DENIM ARMORY'); // valid column rendered
    expect(html).toContain('gemini_http_400'); // failed column surfaced
  });

  it('throws when a model has no resolvable key', async () => {
    const casesDir = makeCases();
    const outDir = mkdtempSync(join(tmpdir(), 'out-'));
    await expect(runCompare({ casesDir, outDir, env: {} })).rejects.toThrow(/API key/);
  });

  it('throws when there are no cases', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'out-'));
    const emptyCases = mkdtempSync(join(tmpdir(), 'empty-'));
    await expect(runCompare({ casesDir: emptyCases, outDir, env: { GEMINI_API_KEY: 'k', GEMINI_API_KEY_35: 'k' } })).rejects.toThrow(/No cases/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run scan:compare:test`
Expected: FAIL — cannot resolve `./compare.ts`.

- [ ] **Step 3: Create `eval/compare.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { callGemini } from '../gemini.ts';
import { soloScanSchema } from 'shared/solo-scan/schema.ts';
import { MODELS, resolveKey, estimateCost } from './models.ts';
import { discoverCases } from './cases.ts';
import { renderReport } from './report.ts';
import type { CaseResult, ModelConfig, ModelOutcome, RunResult, ScanInput } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Run one model against one case input, capturing timing, schema validity, cost. */
async function runModel(cfg: ModelConfig, input: ScanInput, apiKey: string): Promise<ModelOutcome> {
  const started = Date.now();
  try {
    const { raw, usage } = await callGemini({
      apiKey,
      model: cfg.id,
      face: input.face,
      outfit: input.outfit,
      thinkingConfig: cfg.thinkingConfig,
      maxOutputTokens: cfg.maxOutputTokens,
    });
    const latencyMs = Date.now() - started;
    const parsed = soloScanSchema.safeParse(raw);
    return {
      modelId: cfg.id,
      ok: true,
      raw,
      parsed: parsed.success ? parsed.data : null,
      schemaValid: parsed.success,
      schemaErrors: parsed.success ? undefined : parsed.error.issues.map((i) => i.path.join('.')),
      latencyMs,
      usage,
      costUsd: estimateCost(usage, cfg),
    };
  } catch (e) {
    return {
      modelId: cfg.id,
      ok: false,
      raw: null,
      parsed: null,
      schemaValid: false,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - started,
      usage: { input: 0, output: 0, total: 0 },
      costUsd: 0,
    };
  }
}

export interface RunCompareOpts {
  casesDir: string;
  outDir: string;
  env: Record<string, string | undefined>;
}

/** Discover cases, run every model per case, write report.html + results.json. */
export async function runCompare(opts: RunCompareOpts): Promise<{ dir: string; run: RunResult }> {
  const inputs = discoverCases(opts.casesDir);
  if (inputs.length === 0) {
    throw new Error(`No cases found in ${opts.casesDir}. Add <case>/face.jpg and/or outfit.jpg.`);
  }
  for (const cfg of MODELS) {
    if (!resolveKey(cfg, opts.env)) {
      throw new Error(`Missing API key for ${cfg.id}: set ${cfg.keyEnv} (or GEMINI_API_KEY).`);
    }
  }

  const cases: CaseResult[] = [];
  for (const input of inputs) {
    const outcomes: ModelOutcome[] = [];
    for (const cfg of MODELS) {
      const apiKey = resolveKey(cfg, opts.env)!;
      const outcome = await runModel(cfg, input, apiKey);
      console.log(
        `· ${input.name} → ${cfg.id} : ${outcome.ok ? `${outcome.latencyMs}ms ${outcome.schemaValid ? 'valid' : 'INVALID'}` : `FAILED ${outcome.error}`}`,
      );
      outcomes.push(outcome);
    }
    cases.push({ name: input.name, hasFace: !!input.face, hasOutfit: !!input.outfit, outcomes });
  }

  const run: RunResult = { startedAt: new Date().toISOString(), models: MODELS.map((m) => m.id), cases };
  const dir = join(opts.outDir, run.startedAt.replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'results.json'), JSON.stringify(run, null, 2));
  writeFileSync(join(dir, 'report.html'), renderReport(run, inputs));
  return { dir, run };
}

// CLI entry — only runs when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCompare({ casesDir: join(HERE, 'cases'), outDir: join(HERE, 'out'), env: process.env })
    .then(({ dir }) => console.log(`\nReport: ${join(dir, 'report.html')}`))
    .catch((e) => {
      console.error(String(e instanceof Error ? e.message : e));
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run scan:compare:test`
Expected: PASS (20 tests total).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/solo-scan/eval/compare.ts supabase/functions/solo-scan/eval/compare.test.ts
git commit -m "feat(eval): orchestrate dual-model runs and write report + json"
```

---

## Task 7: Live smoke run (manual verification)

**Files:** none (uses a real case + real keys).

- [ ] **Step 1: Create one real test case**

Put a real face photo at `supabase/functions/solo-scan/eval/cases/smoke/face.jpg` (and optionally `outfit.jpg`). These are gitignored.

- [ ] **Step 2: Run against both models**

Run (PowerShell):

```powershell
$env:GEMINI_API_KEY="<2.5 key>"; $env:GEMINI_API_KEY_35="<3.5 key>"; npm run scan:compare
```

Or bash:

```bash
GEMINI_API_KEY="<2.5 key>" GEMINI_API_KEY_35="<3.5 key>" npm run scan:compare
```

Expected: console prints one `· smoke → gemini-2.5-flash : <ms> valid` line and one
`· smoke → gemini-3.5-flash : ...` line, then a `Report: ...report.html` path.

- [ ] **Step 3: Inspect the report**

Open the printed `report.html` in a browser. Confirm:
- Both model columns populate for the Face Card and Outfit Card.
- The banks table shows each model's selected IDs.
- Meta footer shows `schema ✓`, latency, tokens, cost for each.

- [ ] **Step 4: If `gemini-3.5-flash` shows `FAILED gemini_http_400` or `schema ✗`**

- A `gemini_http_400` on the thinking field → in `eval/models.ts`, change the 3.5
  `thinkingConfig` value (`{ thinkingLevel: 'low' }`) to a level the current docs list
  (`minimal` / `medium`), or remove the override to use the model default. Re-run.
- A `schema ✗` with `schemaErrors` pointing at truncation/`schemaVersion` → raise
  `maxOutputTokens` for 3.5 in `eval/models.ts` (e.g. 4096 → 6144) and re-run.
- Record the final working `thinkingConfig` + token value; commit only if `models.ts`
  changed:

```bash
git add supabase/functions/solo-scan/eval/models.ts
git commit -m "fix(eval): tune gemini-3.5-flash thinking/token config to working values"
```

- [ ] **Step 5: Rotate the exposed key**

The 3.5 key pasted in chat on 2026-06-20 is compromised — regenerate it in Google AI
Studio now that testing is done.

---

## Notes / decisions captured from the spec

- **Compares models, not prompts:** the harness imports the production `callGemini`,
  `SYSTEM_INSTRUCTION`, `RESPONSE_SCHEMA` (via `buildBody`) and `soloScanSchema` — only
  the model id + thinking knob vary.
- **No `assembleResult`:** raw Gemini fields are the model differentiator; assembly adds
  caption-bank randomness that would muddy the comparison.
- **Per-model keys:** `GEMINI_API_KEY` (2.5) / `GEMINI_API_KEY_35` (3.5, falls back to
  the former) — supports the two models living in separate Google projects.
- **Runtime:** Node 24 + `tsx` (no Deno installed); `shared/*` resolved via tsconfig
  path alias (tsx) and a vitest alias (tests).
```
