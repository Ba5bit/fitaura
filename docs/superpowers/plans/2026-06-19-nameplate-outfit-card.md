# Nameplate Outfit Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new 3rd **outfit** skin, "Nameplate", in the Aura-Scan look that Gemini *names and reads* (not a roast) with a per-image legibility-clamped accent, and make the in-app outfit analysis metrics human-readable.

**Architecture:** Gemini returns a new `outfitNameplate` block (name / eyebrow / tagline / lane / accentHex / dossier rows). `assembleResult` clamps the accent (pure `clampAccent`) and attaches an `OutfitNameplate` to the outfit card; it also carries each main metric's existing AI `evidence` onto `ScoreItem.note`. A new `NameplateOutfit` React skin renders the card off `--accent`; it replaces `BufferingOutfit` in the outfit registry. The analysis block renders the per-metric notes.

**Tech Stack:** TypeScript, Zod (shared schema), React (Vite), Vitest, Deno edge function (Gemini structured output), CSS design tokens.

**Spec:** `docs/superpowers/specs/2026-06-19-nameplate-outfit-card-design.md`

---

## File Structure

**Shared (`packages/shared/src/`)**
- `result.ts` — add `OutfitDossierRow`, `OutfitNameplate`, `OutfitCardContent.nameplate?`, `ScoreItem.note?`.
- `solo-scan/constants.ts` — bump `SOLO_SCAN_SCHEMA_VERSION` → `solo_scan_v3_5`.
- `solo-scan/schema.ts` — add required `outfitNameplate` Zod object.
- `solo-scan/accent.ts` (new) + `accent.test.ts` (new) — pure `clampAccent` + `hexToHsl`.
- `solo-scan/assemble.ts` — build `nameplate`, clamp accent, attach metric `note`s.
- `solo-scan/__fixtures__.ts` — add `outfitNameplate` to `sampleAIOutput()`.

**Edge function (`supabase/functions/solo-scan/`)** — *manual deploy*
- `gemini.ts` — add `outfitNameplate` to the response schema, the NAMEPLATE prompt block, bump `maxOutputTokens`, set `schemaVersion` to v3_5.

**Web (`apps/web/src/`)**
- `components/cards/skins/NameplateOutfit.tsx` (new) — the skin.
- `design/nameplate-skin.css` (new) — the styles.
- `components/cards/skins/registry.ts` (+ `registry.test.ts`) — swap `buffering` → `nameplate` for outfit.
- `components/cards/skins/BufferingOutfit.tsx` — delete (BufferingFace + `buffering-skin.css` stay).
- `features/result/Result.tsx` — import `nameplate-skin.css`.
- `components/analysis/OutfitAnalysisBlock.tsx` — render `stat.note`.
- `design/result-shell.css` — `.gc-note` style.
- `data/mockGenerations.ts` — add `nameplate` to outfit mocks.
- `solo-scan/schema.test.ts` — update version assertion to v3_5.

**Dependency order for parallel agents:** Task 1 (contract) is sequential and first. Then Task 2 (clampAccent), Task 3 (assemble — needs 1+2), Task 4 (prompt — needs 1), Task 5 (skin — needs 1), Task 6 (analysis — needs 1+3 for real data but codeable after 1), Task 7 (mocks — needs 1) fan out. Task 8 (verify) is last. See "Parallelization" at the end.

---

## Task 1: Shared contract — types, version, schema, fixture

**Files:**
- Modify: `packages/shared/src/result.ts`
- Modify: `packages/shared/src/solo-scan/constants.ts`
- Modify: `packages/shared/src/solo-scan/schema.ts`
- Modify: `packages/shared/src/solo-scan/__fixtures__.ts`
- Modify: `apps/web/src/solo-scan/schema.test.ts`

- [ ] **Step 1: Add the new types to `result.ts`**

Add `note?` to `ScoreItem` (after `noBar`):

```ts
  /** Hide the fill bar (for non-0–100 stats like an age estimate). */
  noBar?: boolean;
  /** Plain-language one-liner shown under the metric in the analysis block. */
  note?: string;
```

Add these two interfaces immediately above `export interface OutfitCardContent {`:

```ts
/** One AI-authored dossier row on the Nameplate outfit card. */
export interface OutfitDossierRow {
  /** Short AI-chosen label, e.g. "Signature". */
  label: string;
  /** Short AI-chosen value, ≤ ~3 words, e.g. "Trucker jacket". */
  value: string;
}

/** Gemini-authored "nameplate" block powering the Nameplate outfit skin. */
export interface OutfitNameplate {
  /** Big Anton title — the FIT's name, e.g. "DENIM ARMORY". */
  name: string;
  /** Small descriptor over the name, e.g. "All-black streetwear". */
  eyebrow: string;
  /** One-line read (descriptive, not a roast). */
  tagline: string;
  /** Category pill, e.g. "Streetwear" / "Minimalist". */
  lane: string;
  /** Legibility-clamped accent hex (safe to render directly). */
  accent: string;
  /** AI-chosen dossier rows (labels + values); up to 4. */
  dossier: OutfitDossierRow[];
}
```

Add the field inside `OutfitCardContent` (after `sticker: StickerData;`):

```ts
  /** Present only for results assembled with the Nameplate fields. */
  nameplate?: OutfitNameplate;
```

- [ ] **Step 2: Bump the schema version in `constants.ts`**

```ts
export const SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v3_5' as const;
```

Leave `SOLO_SCAN_PROMPT_VERSION` as `'v3_6'` — the nameplate copy does not change scoring, and bumping it would reshuffle the seeded display jitter mid-calibration.

- [ ] **Step 3: Add the `outfitNameplate` Zod object in `schema.ts`**

Insert this block in `soloScanSchema`'s object, immediately after the `outfitCopy: z.object({ … }),` block (before `contentSelection`):

```ts
    outfitNameplate: z.object({
      name: z.string().max(40),
      eyebrow: z.string().max(60),
      tagline: z.string().max(80),
      lane: z.string().max(24),
      accentHex: z.string().max(9),
      dossier: z
        .array(z.object({ label: z.string().max(20), value: z.string().max(28) }))
        .max(4),
    }),
```

(Required, mirroring `outfitCopy`. For a face-only scan the model returns empty strings + `[]` dossier — `assemble` only reads it under `parts.outfit`. No `.min` so `[]` passes.)

- [ ] **Step 4: Add `outfitNameplate` to the fixture `sampleAIOutput()`**

In `__fixtures__.ts`, insert after the `outfitCopy: { … },` block:

```ts
    outfitNameplate: {
      name: 'DENIM ARMORY',
      eyebrow: 'Double-denim, wash on wash',
      tagline: 'Built like a fortress',
      lane: 'Streetwear',
      accentHex: '#3f7fd0',
      dossier: [
        { label: 'Signature', value: 'Trucker jacket' },
        { label: 'Rule', value: 'Tonal layering' },
        { label: 'Palette', value: 'Stonewashed blue' },
        { label: 'Finish', value: 'Clean white tee' },
      ],
    },
```

- [ ] **Step 5: Update the version assertion in `schema.test.ts`**

Change the `describe('soloScanSchema v3_4', …)` block's assertion line:

```ts
    expect(SOLO_SCAN_SCHEMA_VERSION).toBe('solo_scan_v3_5');
```

(Rename the `describe` label to `'soloScanSchema v3_5'` for clarity.)

- [ ] **Step 6: Run the shared + schema tests and typecheck**

Run: `npm test` (from repo root)
Expected: PASS — `soloScanSchema` accepts the fixture (now with `outfitNameplate`); the v3_5 version assertion passes; no existing test regresses.

Run: `npm run typecheck`
Expected: PASS — the new fields compile.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/result.ts packages/shared/src/solo-scan/constants.ts packages/shared/src/solo-scan/schema.ts packages/shared/src/solo-scan/__fixtures__.ts apps/web/src/solo-scan/schema.test.ts
git commit -m "feat(shared): nameplate contract — types, v3_5 schema, fixture

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `clampAccent` — pure, legibility-clamped accent (TDD)

**Files:**
- Create: `packages/shared/src/solo-scan/accent.ts`
- Test: `packages/shared/src/solo-scan/accent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/solo-scan/accent.test.ts
import { describe, expect, it } from 'vitest';
import { clampAccent, hexToHsl } from './accent.ts';

const MASC = '#83b4ff';
const FEMME = '#ff52a6';

describe('clampAccent', () => {
  it('keeps a usable hue and pulls saturation/lightness into the legible band', () => {
    const out = clampAccent('#2a64b8', 'masc'); // deep but saturated blue
    const hsl = hexToHsl(out)!;
    expect(hsl[1]).toBeGreaterThanOrEqual(0.499);
    expect(hsl[1]).toBeLessThanOrEqual(0.951);
    expect(hsl[2]).toBeGreaterThanOrEqual(0.579);
    expect(hsl[2]).toBeLessThanOrEqual(0.741);
    // hue preserved (within rounding tolerance) — vibe-matched
    const inHue = hexToHsl('#2a64b8')![0];
    expect(Math.abs(hsl[0] - inHue)).toBeLessThan(0.02);
  });

  it('lightens a too-dark color into the band (keeps hue)', () => {
    const out = clampAccent('#0a0f1e', 'masc');
    expect(out).not.toBe('#0a0f1e');
    expect(hexToHsl(out)![2]).toBeGreaterThanOrEqual(0.579);
  });

  it('darkens a too-light color into the band', () => {
    const out = clampAccent('#eef3ff', 'masc');
    expect(hexToHsl(out)![2]).toBeLessThanOrEqual(0.741);
  });

  it('falls back to the gender accent for a near-gray (no usable hue)', () => {
    expect(clampAccent('#222222', 'masc')).toBe(MASC);
    expect(clampAccent('#cccccc', 'femme')).toBe(FEMME);
  });

  it('falls back for invalid/empty input', () => {
    expect(clampAccent('nope', 'masc')).toBe(MASC);
    expect(clampAccent('', 'femme')).toBe(FEMME);
    expect(clampAccent('#12', 'masc')).toBe(MASC);
  });

  it('accepts 3-digit hex and a missing leading #', () => {
    expect(clampAccent('f00', 'masc')).toMatch(/^#[0-9a-f]{6}$/);
    expect(hexToHsl('#f00')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module './accent.ts'` / `clampAccent is not a function`.

- [ ] **Step 3: Implement `accent.ts`**

```ts
// packages/shared/src/solo-scan/accent.ts
// Legibility-clamped accent for the Nameplate outfit card. Gemini returns a hex
// matched to the fit's palette; we KEEP its hue (vibe-matched) but pull
// saturation/lightness into a band that reads on the dark card and bars. A
// near-gray (no usable hue) or unparseable value falls back to the gender accent.

type Gender = 'femme' | 'masc';

const FALLBACK: Record<Gender, string> = { masc: '#83b4ff', femme: '#ff52a6' };

const S_MIN = 0.5;
const S_MAX = 0.95;
const L_MIN = 0.58;
const L_MAX = 0.74;
const GRAY_S = 0.12; // below this there is no usable hue

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function parseRgb(raw: string): [number, number, number] | null {
  if (typeof raw !== 'string') return null;
  let h = raw.trim().replace(/^#/, '').toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Parse a hex color to HSL (each channel 0–1), or null if unparseable. */
export function hexToHsl(raw: string): [number, number, number] | null {
  const rgb = parseRgb(raw);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  let h = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  const seg = Math.floor(h * 6) % 6;
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

/** Clamp a raw accent hex into the legible band, keeping hue; fall back per gender. */
export function clampAccent(raw: string, gender: Gender): string {
  const fallback = FALLBACK[gender];
  const hsl = hexToHsl(raw);
  if (!hsl) return fallback;
  const [h, s, l] = hsl;
  if (s < GRAY_S) return fallback;
  return hslToHex(h, clamp(s, S_MIN, S_MAX), clamp(l, L_MIN, L_MAX));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `clampAccent` cases green.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/accent.ts packages/shared/src/solo-scan/accent.test.ts
git commit -m "feat(shared): clampAccent — vibe-matched, legibility-clamped accent

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: assemble — attach nameplate + metric notes (TDD)

**Files:**
- Modify: `packages/shared/src/solo-scan/assemble.ts`
- Test: `apps/web/src/solo-scan/assemble.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `assemble.test.ts` (before the final closing — add a new `describe`):

```ts
describe('assembleResult — nameplate + metric notes', () => {
  it('attaches a clamped nameplate to the outfit card', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-np', 'v3_5', { face: true, outfit: true });
    const np = r.outfit!.card.nameplate!;
    expect(np.name).toBe('DENIM ARMORY');
    expect(np.lane).toBe('Streetwear');
    expect(np.dossier).toHaveLength(4);
    // accent is clamped to a 6-digit hex, not the raw fixture value passthrough check:
    expect(np.accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('carries each main outfit metric AI evidence onto note', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-np', 'v3_5', { face: true, outfit: true });
    const silhouette = r.outfit!.card.scores.find((s) => s.id === 'silhouette')!;
    expect(silhouette.note).toBe('Visible in the image.'); // fixture evidence
  });

  it('does not attach a nameplate when the outfit is absent', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-np', 'v3_5', { face: true, outfit: false });
    expect(r.outfit).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `np` is `undefined` (nameplate not built); `silhouette.note` is `undefined`.

- [ ] **Step 3: Implement in `assemble.ts`**

Add `clampAccent` + the `OutfitNameplate` type to imports:

```ts
import { clampAccent } from './accent.ts';
```

and add `OutfitNameplate` to the existing `import type { … } from '../result.ts';` list.

Replace the outfit `scores` array (the four `score(...)` lines) with explicit objects carrying `note`:

```ts
      scores: [
        { id: 'silhouette', label: 'Silhouette', value: sc(oa.silhouette, 'silhouette'), note: oa.silhouette.evidence },
        { id: 'proportions', label: 'Proportions', value: sc(oa.proportions, 'proportions'), note: oa.proportions.evidence },
        { id: 'fit', label: 'Fit', value: sc(oa.fit, 'fit'), note: oa.fit.evidence },
        { id: 'physique-match', label: 'Physique Match', value: sc(oa.physiqueMatch, 'physique'), note: oa.physiqueMatch.evidence },
      ],
```

Build the nameplate and attach it. Immediately before `const outfitCard = {`, add:

```ts
    const npAI = ai.outfitNameplate;
    const nameplate: OutfitNameplate = {
      name: npAI.name,
      eyebrow: npAI.eyebrow,
      tagline: npAI.tagline,
      lane: npAI.lane,
      accent: clampAccent(npAI.accentHex, contentGender),
      dossier: npAI.dossier.slice(0, 4).map((row) => ({ label: row.label, value: row.value })),
    };
```

Add `nameplate,` to the `outfitCard` object literal (after `sticker: outfitStickerById(caption.stickerId),`).

- [ ] **Step 4: Run to verify passes**

Run: `npm test`
Expected: PASS — nameplate + notes present; outfit-absent case still null.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/assemble.ts apps/web/src/solo-scan/assemble.test.ts
git commit -m "feat(shared): assemble nameplate + surface metric evidence as notes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Gemini prompt + response schema (manual deploy)

**Files:**
- Modify: `supabase/functions/solo-scan/gemini.ts`

> No automated test (Deno edge function). Verify by reading; the user deploys
> manually per `fitaura-solo-scan-deploy`.

- [ ] **Step 1: Add `outfitNameplate` to `RESPONSE_SCHEMA`**

In `RESPONSE_SCHEMA.properties`, after the `outfitCopy: { … },` entry, add:

```js
    outfitNameplate: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        eyebrow: { type: 'STRING' },
        tagline: { type: 'STRING' },
        lane: { type: 'STRING' },
        accentHex: { type: 'STRING' },
        dossier: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { label: { type: 'STRING' }, value: { type: 'STRING' } },
            required: ['label', 'value'],
          },
        },
      },
      required: ['name', 'eyebrow', 'tagline', 'lane', 'accentHex', 'dossier'],
    },
```

Add `'outfitNameplate'` to the top-level `required: [...]` array.

- [ ] **Step 2: Add the NAMEPLATE prompt block to `SYSTEM_INSTRUCTION`**

Insert this paragraph just before the final `Set schemaVersion to …` line:

```text
NAMEPLATE (outfit): Also produce outfitNameplate that NAMES and flatters the FIT itself — never the wearer, never a recognized icon's real name. This block is NOT a roast (it overrides the roast VOICE above for these fields only):
- name: a punchy 1–3 word TITLE for the outfit's aesthetic, e.g. "DENIM ARMORY", "DESERT QUIET".
- eyebrow: a short style descriptor, ≤ 6 words, e.g. "All-black streetwear".
- tagline: one characterful, descriptive read of the fit, ≤ 9 words — flattering, not a roast.
- lane: a 1–2 word category, e.g. "Streetwear", "Minimalist", "Y2K", "Formal".
- accentHex: a "#rrggbb" sampled from the dominant CLOTHING palette (NOT the background) that best represents the fit's vibe; prefer a vivid, saturated read (the backend adjusts it for legibility).
- dossier: exactly 4 short rows describing the fit. YOU choose each row's label (one word, e.g. Signature / Rule / Palette / Finish / Layering / Era) and a value ≤ 3 words (e.g. "Trucker jacket"). Descriptive, never numeric.
For a FACE-ONLY scan (no outfit photo), return name "", eyebrow "", tagline "", lane "", accentHex "#83b4ff", dossier [].
```

- [ ] **Step 3: Change the final line of `SYSTEM_INSTRUCTION`**

```text
Set schemaVersion to "solo_scan_v3_5".
```

- [ ] **Step 4: Raise the output token budget**

In `buildBody`'s `generationConfig`, change:

```js
      maxOutputTokens: 2900,
```

- [ ] **Step 5: Verify it reads correctly**

Re-read the modified `gemini.ts`: the `outfitNameplate` schema object is present and listed in top-level `required`; the prompt has the NAMEPLATE block and emits `solo_scan_v3_5`; `maxOutputTokens` is 2900.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/solo-scan/gemini.ts
git commit -m "feat(solo-scan): Gemini outfitNameplate block + v3_5 (manual deploy)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> **After merge:** deploy the edge function manually (see `fitaura-solo-scan-deploy`).

---

## Task 5: NameplateOutfit skin + CSS + registry swap

**Files:**
- Create: `apps/web/src/components/cards/skins/NameplateOutfit.tsx`
- Create: `apps/web/src/design/nameplate-skin.css`
- Modify: `apps/web/src/components/cards/skins/registry.ts`
- Modify: `apps/web/src/components/cards/skins/registry.test.ts`
- Modify: `apps/web/src/features/result/Result.tsx`
- Delete: `apps/web/src/components/cards/skins/BufferingOutfit.tsx`

- [ ] **Step 1: Update the registry test (failing first)**

In `registry.test.ts`, change the outfit expectations:

```ts
  it('exposes the dossier + clean + buffering (face) / nameplate (outfit) skins', () => {
    expect(skinsFor('face').map((s) => s.id)).toEqual(['dossier', 'clean', 'buffering']);
    expect(skinsFor('outfit').map((s) => s.id)).toEqual(['dossier', 'clean', 'nameplate']);
    expect(CARD_SKINS.face.every((s) => typeof s.Comp === 'function')).toBe(true);
  });

  it('skinIndex finds a skin by id and clamps unknown ids to 0', () => {
    expect(skinIndex('face', 'dossier')).toBe(0);
    expect(skinIndex('face', 'clean')).toBe(1);
    expect(skinIndex('face', 'buffering')).toBe(2);
    expect(skinIndex('outfit', 'nameplate')).toBe(2);
    expect(skinIndex('outfit', 'buffering')).toBe(0); // legacy id → default
    expect(skinIndex('face', 'nope')).toBe(0);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — outfit list still contains `buffering`; `skinIndex('outfit','nameplate')` is 0.

- [ ] **Step 3: Create the skin component**

```tsx
// apps/web/src/components/cards/skins/NameplateOutfit.tsx
import type { CSSProperties } from 'react';
import type { OutfitCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import { Bars } from '../Bars';
import type { SkinProps } from './types';

const FALLBACK_ACCENT = { masc: '#83b4ff', femme: '#ff52a6' } as const;

/**
 * Nameplate skin (outfit) — the Aura-Scan "forensic dossier" card. Gemini names
 * and reads the FIT (not a roast); a per-image legibility-clamped accent flows
 * through ticks / brand / lane / dotted leaders while the stars stay gold. When
 * no nameplate is present (legacy / vault rows) it falls back to the caption +
 * verdict read + gender accent and drops the dossier block. Dark for both
 * genders — the accent carries identity.
 */
export function NameplateOutfit({ content, gender, roast }: SkinProps) {
  const c = content as OutfitCardContent;
  const np = c.nameplate;
  const accent = np?.accent || FALLBACK_ACCENT[gender];
  const name = np?.name || c.caption;
  const eyebrow = np?.eyebrow;
  const tagline = np?.tagline || roast;
  const lane = np?.lane;
  const dossier = np?.dossier ?? [];
  const rating = Math.max(0, Math.min(5, c.overallScore / 20));
  const style = { '--accent': accent } as CSSProperties;
  const starStyle = { '--r': rating } as CSSProperties;
  return (
    <div className="asset nameplate-card" data-kind="outfit" style={style}>
      <CardImage src={c.imageUrl} shape="rect" placeholder="drop outfit photo" alt="Your outfit" />
      <div className="np-grain" />
      <div className="np-scrim" />
      <div className="np-ticks"><span className="tl" /><span className="tr" /><span className="bl" /><span className="br" /></div>
      <div className="np-top">
        <span className="np-brand"><span className="dot" />FITAURA</span>
        {lane && <span className="np-lane"><span className="pip" />{lane}</span>}
      </div>
      <div className="np-body">
        {eyebrow && <div className="np-eyebrow">{eyebrow}</div>}
        <h2 className="np-name">{name}</h2>
        <div className="np-rate">
          <span className="np-stars" style={starStyle}>
            <span className="base">★★★★★</span><span className="fill">★★★★★</span>
          </span>
          <span className="np-score">{rating.toFixed(1)}<span className="u">/5</span></span>
        </div>
        {tagline && <p className="np-tagline">{tagline}</p>}
        {dossier.length > 0 && (
          <div className="np-specs">
            {dossier.map((row, i) => (
              <div className="np-spec" key={row.label + i}>
                <span className="k">{row.label}</span>
                <span className="lead" />
                <span className="v">{row.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="np-foot">
          <span className="np-handle"><span className="dot" />Fit read&nbsp; <b>@tryfitaura</b></span>
          <div className="np-barcode"><Bars seed={42} count={10} /></div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

```css
/* apps/web/src/design/nameplate-skin.css
   NAMEPLATE SKIN — Aura-Scan outfit card. Full-bleed photo + static grain +
   bottom scrim; one per-card --accent (image-matched, clamped) flows through
   ticks / brand / lane / dotted leaders. Stars stay gold. Dark for both genders.
   Frame mirrors .clean-card so it drops into the deck + export identically. */
.nameplate-card {
  position: absolute; inset: 0; width: 360px; height: 640px;
  border-radius: 26px; overflow: hidden; box-shadow: var(--shadow-card);
  background: var(--bg-1); isolation: isolate;
}
.nameplate-card .card-image { position: absolute; inset: 0; }
.nameplate-card .card-image img { width: 100%; height: 100%; object-fit: cover; object-position: center 28%; display: block; }
.nameplate-card .card-image-placeholder {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: linear-gradient(160deg, var(--bg-2), var(--bg-0));
  color: var(--ink-faint); font-family: "Space Mono", monospace; font-size: 11px;
  letter-spacing: .2em; text-transform: uppercase;
}

/* static film grain (export-safe — no animation, no opacity-from-0) */
.np-grain {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  opacity: .14; mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 150px 150px;
}
.np-scrim {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: linear-gradient(180deg, rgba(6,7,10,.55) 0%, rgba(6,7,10,.12) 16%,
    transparent 34%, transparent 44%, rgba(6,7,10,.66) 68%, rgba(6,7,10,.97) 100%);
}

/* corner reticle */
.np-ticks span { position: absolute; width: 20px; height: 20px; border: 2.5px solid var(--accent); opacity: .9; z-index: 6; }
.np-ticks .tl { top: 16px; left: 16px; border-right: 0; border-bottom: 0; }
.np-ticks .tr { top: 16px; right: 16px; border-left: 0; border-bottom: 0; }
.np-ticks .bl { bottom: 16px; left: 16px; border-right: 0; border-top: 0; }
.np-ticks .br { bottom: 16px; right: 16px; border-left: 0; border-top: 0; }

/* top chrome */
.np-top { position: absolute; z-index: 7; top: 22px; left: 22px; right: 22px;
  display: flex; justify-content: space-between; align-items: flex-start; }
.np-brand { display: inline-flex; align-items: center; gap: 8px;
  font-family: "Space Mono", monospace; font-weight: 700; letter-spacing: .3em; font-size: 12px; color: #fff; }
.np-brand .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px var(--accent); }
.np-lane { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px;
  background: rgba(6,7,10,.55); backdrop-filter: blur(8px);
  border: 1.5px solid color-mix(in oklab, var(--accent) 55%, var(--hair));
  font-family: "Space Mono", monospace; font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: color-mix(in oklab, var(--accent) 72%, #fff); white-space: nowrap; }
.np-lane .pip { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }

/* bottom content */
.np-body { position: absolute; z-index: 7; left: 22px; right: 22px; bottom: 22px; }
.np-eyebrow { font-family: "Space Mono", monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase;
  color: rgba(255,255,255,.82); text-shadow: 0 2px 10px rgba(0,0,0,.7); margin-bottom: 6px; }
.np-name { margin: 0; font-family: "Anton", sans-serif; font-weight: 400; text-transform: uppercase;
  letter-spacing: .01em; font-size: 46px; line-height: .9; color: #fff; text-wrap: balance; text-shadow: 0 2px 18px rgba(0,0,0,.5); }
.np-rate { display: flex; align-items: baseline; gap: 10px; margin: 10px 0 8px; }
.np-stars { position: relative; display: inline-block; font-size: 22px; letter-spacing: 2px; line-height: 1; }
.np-stars .base { color: rgba(255,255,255,.22); }
.np-stars .fill { position: absolute; inset: 0; overflow: hidden; white-space: nowrap; color: var(--gold);
  width: calc(var(--r) / 5 * 100%); text-shadow: 0 0 12px color-mix(in oklab, var(--gold) 60%, transparent); }
.np-score { font-family: "Anton", sans-serif; font-size: 26px; line-height: 1; color: #fff; }
.np-score .u { font-size: 14px; color: var(--ink-dim); }
.np-tagline { margin: 0 0 14px; font-family: "Anton", sans-serif; text-transform: uppercase;
  font-size: 18px; line-height: 1; letter-spacing: .01em; color: color-mix(in oklab, var(--accent) 78%, #fff); }
.np-specs { display: flex; flex-direction: column; gap: 9px; }
.np-spec { display: flex; align-items: baseline; gap: 10px; }
.np-spec .k { font-family: "Space Mono", monospace; font-weight: 700; font-size: 11px; letter-spacing: .1em;
  text-transform: uppercase; color: var(--accent); white-space: nowrap; }
.np-spec .lead { flex: 1; align-self: center; height: 0; min-width: 14px; transform: translateY(-2px);
  border-bottom: 2px dotted color-mix(in oklab, var(--accent) 62%, transparent); }
.np-spec .v { font-family: "Hanken Grotesk", sans-serif; font-weight: 800; font-size: 15px; color: #fff;
  white-space: nowrap; text-align: right; }
.np-foot { margin-top: 15px; padding-top: 11px; border-top: 1px solid var(--hair);
  display: flex; justify-content: space-between; align-items: center; }
.np-handle { display: inline-flex; align-items: center; gap: 7px;
  font-family: "Space Mono", monospace; font-size: 11px; color: var(--ink-dim); }
.np-handle .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.np-handle b { color: #fff; }
.np-barcode { height: 18px; opacity: .75; }
```

- [ ] **Step 5: Swap the skin in `registry.ts`**

Replace the `BufferingOutfit` import/usage. Change the import line `import { BufferingOutfit } from './BufferingOutfit';` to:

```ts
import { NameplateOutfit } from './NameplateOutfit';
```

And the outfit list's third entry from `{ id: 'buffering', name: 'Buffering', Comp: BufferingOutfit }` to:

```ts
    { id: 'nameplate', name: 'Nameplate', Comp: NameplateOutfit },
```

(Keep the `BufferingFace` import + the face list unchanged.)

- [ ] **Step 6: Import the stylesheet in `Result.tsx`**

After `import '../../design/buffering-skin.css';` add:

```ts
import '../../design/nameplate-skin.css';
```

- [ ] **Step 7: Delete `BufferingOutfit.tsx`**

```bash
git rm apps/web/src/components/cards/skins/BufferingOutfit.tsx
```

(Leave `buffering-skin.css` and `BufferingFace.tsx` — the face deck still uses them.)

- [ ] **Step 8: Run tests, typecheck, build**

Run: `npm test`
Expected: PASS — registry test green; no dangling `BufferingOutfit` import.

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/cards/skins/NameplateOutfit.tsx apps/web/src/design/nameplate-skin.css apps/web/src/components/cards/skins/registry.ts apps/web/src/components/cards/skins/registry.test.ts apps/web/src/features/result/Result.tsx
git commit -m "feat(cards): Nameplate outfit skin replaces Buffering in the outfit deck

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Analysis block readability — per-metric notes

**Files:**
- Modify: `apps/web/src/components/analysis/OutfitAnalysisBlock.tsx`
- Modify: `apps/web/src/design/result-shell.css`

- [ ] **Step 1: Render `stat.note` in each gym-card**

In `OutfitAnalysisBlock.tsx`, inside the `.gym-card` map, add a note line after the `.gc-bar` div:

```tsx
              <div className="gc-bar"><i style={{ width: `${stat.value}%` }} /></div>
              {stat.note && <p className="gc-note">{stat.note}</p>}
```

- [ ] **Step 2: Add the note style**

Append to `result-shell.css` (near the existing `.gym-card` rules):

```css
.gc-note {
  margin: 9px 0 0; font-family: "Hanken Grotesk", sans-serif; font-weight: 500;
  font-size: 12px; line-height: 1.35; color: var(--ink-dim); text-wrap: pretty;
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS — `note` is an optional `ScoreItem` field from Task 1.

(Visual confirmation happens in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/analysis/OutfitAnalysisBlock.tsx apps/web/src/design/result-shell.css
git commit -m "feat(analysis): show plain-language note under each outfit metric

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Mock data — nameplate on the sample generations

**Files:**
- Modify: `apps/web/src/data/mockGenerations.ts`

- [ ] **Step 1: Add a nameplate to the `green_flag` outfit card**

In the `green_flag.outfit.card` object (the one with `caption: 'LET HIM COOK'`, `imageUrl: EXAMPLE_FIT`), add after `sticker: OUTFIT_STICKER.green_flag,`:

```ts
        nameplate: {
          name: 'LET HIM COOK',
          eyebrow: 'Tailored streetwear, all intent',
          tagline: 'Quiet flex, loud silhouette',
          lane: 'Streetwear',
          accent: '#5b9dff',
          dossier: [
            { label: 'Signature', value: 'Boxy overshirt' },
            { label: 'Rule', value: 'Fit over flash' },
            { label: 'Palette', value: 'Ink & bone' },
            { label: 'Finish', value: 'Crisp white sole' },
          ],
        },
```

(`accent` here is already legibility-clamped — mocks bypass `clampAccent`. Other outfit mocks may stay nameplate-less to exercise the skin's fallback path.)

- [ ] **Step 2: Verify typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS — `nameplate` matches `OutfitNameplate`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/mockGenerations.ts
git commit -m "test(mocks): nameplate on the green_flag outfit sample

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Integration verification + dev-log

**Files:**
- Create: `docs/dev-log/060-nameplate-outfit-card.md`

- [ ] **Step 1: Full test suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all PASS (162 prior tests + the new accent/assemble/registry cases).

- [ ] **Step 2: In-browser check (Playwright MCP)**

Start the dev server (`npm run dev` in `apps/web`), then with the Playwright tools:
- Seed `MOCK_GENERATIONS.green_flag` via the app's `putResult` / `putSession` (the pattern from dev-log 059), navigate to the Result page.
- Switch to the **OUTFIT** kind; rotate the skin deck to **Nameplate** (3rd skin — via the dots or middle-tap).
- Confirm: the photo is full-bleed; the name ("LET HIM COOK"), eyebrow, gold stars + score, tagline, and 4 dossier rows render; the **accent** (`#5b9dff`) flows through ticks / brand dot / lane pill / dotted leaders while stars are gold; the footer barcode renders.
- Confirm the **export host** renders the Nameplate skin full-size (offscreen `.rs-export-card`).
- Scroll to the **outfit analysis block**: each of the 4 metrics now shows a plain-language note under its bar.
- Console: **0 errors**.

- [ ] **Step 3: Write the dev-log**

Create `docs/dev-log/060-nameplate-outfit-card.md` (study-oriented, per `fitaura-dev-log-convention`): what changed across the stack, the `clampAccent` design (hue-keep + S/L band + gray fallback), the schema v3_5 bump, the manual-deploy reminder, and verification results.

- [ ] **Step 4: Commit**

```bash
git add docs/dev-log/060-nameplate-outfit-card.md
git commit -m "docs(dev-log): 060 — nameplate outfit card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Parallelization (Opus 4.8 subagents)

Per the user's instruction, run independent tasks as parallel Opus 4.8 subagents:

- **Wave 0 (sequential):** Task 1 — the shared contract. Everything imports these names.
- **Wave 1 (parallel after Task 1):**
  - Agent A: Task 2 (`clampAccent`) → then Task 3 (assemble) — these chain (3 needs 2).
  - Agent B: Task 4 (Gemini prompt).
  - Agent C: Task 5 (skin + CSS + registry).
  - Agent D: Task 6 (analysis block).
  - Agent E: Task 7 (mocks).
  - Each agent works only on its listed files (no overlap → no merge conflicts). Note Task 5 and Task 1 both touch separate concerns; only Task 1 edits shared types.
- **Wave 2 (sequential, single agent):** Task 8 — integration verification + dev-log, after all of Wave 1 lands.

**Push:** hold per `fitaura-push-to-main` (iterative session) until the user says it's enough; the edge function still needs its manual deploy.

---

## Self-review notes

- **Spec coverage:** Nameplate skin (T5) · Gemini name/color/dossier (T1,T4) · `clampAccent` vibe-matched + clamped + fallback (T2) · assemble wiring (T3) · analysis readability via evidence→note (T1,T3,T6) · registry swap + Buffering removal (T5) · mocks (T7) · export (works via registry, verified T8) · dev-log (T8). No gaps.
- **Type consistency:** `OutfitNameplate`/`OutfitDossierRow`/`ScoreItem.note` defined in T1 are used identically in T3 (assemble), T5 (skin), T7 (mocks). AI field `accentHex` (schema) → clamped to `accent` (card) is consistent across T1/T3/T4. `clampAccent(raw, gender)` signature matches its call in T3.
- **No placeholders:** every code/CSS/prompt step shows full content; commands have expected output.
