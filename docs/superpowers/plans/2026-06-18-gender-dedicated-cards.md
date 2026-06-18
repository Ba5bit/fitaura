# Gender-Dedicated Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the AI's already-computed gender into the result and use it to give female submissions a femme-dedicated card identity (magenta + gold) and a gender-filtered sticker picker, while male/unsure stays the current icy/cyan.

**Architecture:** The Gemini pipeline already resolves a fixed gender (`confidentlyFemme` in `assemble.ts`) and already forks all *copy* (archetypes/captions/punchlines/labels) on it. This plan exposes that single gender on `FullGenerationResult`, themes the existing card subtree via a `data-gender` attribute that remaps the `--accent` CSS variable (no new colors — `--magenta`/`--gold` already exist), and filters the manual sticker picker so femme stickers never show for masc and vice-versa. Gender is fixed per result; there is no toggle.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, CSS custom properties. Monorepo: `packages/shared` (model + logic) + `apps/web` (UI). Tests run via `npm run test --workspace @fitaura/web` (vitest `include` covers both `apps/web/src/**` and `packages/shared/src/**`).

**Scope note:** This is Phase A part 1 of the spec `docs/superpowers/specs/2026-06-18-gender-skins-card-stack-design.md`. The Premium QR receipt (Phase A part 2) and the skin switcher (Phase B) are separate plans.

**Important — edge redeploy:** `assembleResult` runs inside the Supabase edge function (`supabase/functions/solo-scan/index.ts:75`). After Task 1, the live result won't carry `gender` until the function is redeployed (manual step — Task 6). Local verification uses mock data (Task 5).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/src/result.ts` | Add `gender` to `FullGenerationResult` + `genderOf()` helper | Modify |
| `packages/shared/src/solo-scan/assemble.ts` | Emit `gender` on the assembled result | Modify |
| `packages/shared/src/sticker-bank.ts` | Per-preset `gender`/`femmeLabel` tags + `stickersFor()` selector | Modify |
| `apps/web/src/solo-scan/assembleGender.test.ts` | Tests for `gender` + `genderOf` | Create |
| `apps/web/src/stickerBank.test.ts` | Tests for `stickersFor` filtering + femme labels | Create |
| `apps/web/src/features/result/Result.tsx` | Consume gender: theme card + filter sticker picker | Modify |
| `apps/web/src/design/gender-theme.css` | Femme magenta+gold card theme (scoped) | Create |
| `apps/web/src/data/mockGenerations.ts` | Add `gender` to mocks so the type compiles + local test | Modify |

---

## Task 1: Add `gender` to the result model + assemble

**Files:**
- Modify: `packages/shared/src/result.ts` (interface `FullGenerationResult` + new `genderOf`)
- Modify: `packages/shared/src/solo-scan/assemble.ts:188-205` (return object)
- Test: `apps/web/src/solo-scan/assembleGender.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/solo-scan/assembleGender.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assembleResult, sampleAIOutput, genderOf } from '@fitaura/shared';

const both = { face: true, outfit: true };

describe('assembleResult — fixed gender', () => {
  it('resolves masc for the masc fixture', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-g', 'v3', both);
    expect(r.gender).toBe('masc');
  });

  it('resolves femme for a confident femme read', () => {
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, gender: 'femme', genderConfidence: 0.9 };
    expect(assembleResult(ai, 'scan-g', 'v3', both).gender).toBe('femme');
  });

  it('resolves unsure / low-confidence femme to masc', () => {
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, gender: 'femme', genderConfidence: 0.4 };
    expect(assembleResult(ai, 'scan-g', 'v3', both).gender).toBe('masc');
  });
});

describe('genderOf', () => {
  it('returns the result gender when present', () => {
    expect(genderOf({ gender: 'femme' })).toBe('femme');
  });
  it('defaults legacy rows (no gender) to masc', () => {
    expect(genderOf({})).toBe('masc');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @fitaura/web -- assembleGender`
Expected: FAIL — `genderOf` is not exported and `r.gender` is `undefined`.

- [ ] **Step 3: Add `gender` + `genderOf` to the model**

In `packages/shared/src/result.ts`, inside `interface FullGenerationResult`, add the field right after `verdict`/`chip` (before `parts`):

```ts
export interface FullGenerationResult {
  /** The single categorical verdict for the whole generation. */
  verdict: DatingVerdict;
  /** Verdict chip text, e.g. "VERDICT · RED FLAG". */
  chip: string;
  /** Fixed presentation gender the AI resolved at scan time; drives card theme,
   * the Femininity/Masculinity label, and the eligible sticker set. */
  gender: 'femme' | 'masc';
  /** Which modalities this scan contains. */
  parts: ScanParts;
  face: FaceResult | null;
  outfit: OutfitResult | null;
  receipt: DatingReceiptResult;
}
```

Then add this helper at the end of `packages/shared/src/result.ts` (mirrors `partsOf`, tolerates legacy rows saved before this field):

```ts
/** Resolve a result's fixed gender, defaulting legacy rows to masc. */
export function genderOf(r: { gender?: 'femme' | 'masc' }): 'femme' | 'masc' {
  return r.gender ?? 'masc';
}
```

- [ ] **Step 4: Emit `gender` from assemble**

In `packages/shared/src/solo-scan/assemble.ts`, the return object begins at line 188. Add `gender` using the already-computed `contentGender` (defined at line 63). Change:

```ts
  return {
    verdict,
    chip: `VERDICT · ${VERDICT_LABEL[verdict]}`,
    parts,
```

to:

```ts
  return {
    verdict,
    chip: `VERDICT · ${VERDICT_LABEL[verdict]}`,
    gender: contentGender,
    parts,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace @fitaura/web -- assembleGender`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck shared (catches any other constructors of the result type)**

Run: `npm run typecheck --workspace @fitaura/shared`
Expected: PASS. (The web app's mock data is fixed in Task 5; shared has no other literal.)

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/result.ts packages/shared/src/solo-scan/assemble.ts apps/web/src/solo-scan/assembleGender.test.ts
git commit -m "feat(result): expose fixed gender on the result model + genderOf helper"
```

---

## Task 2: Gender-tag the sticker bank + `stickersFor` selector

**Files:**
- Modify: `packages/shared/src/sticker-bank.ts` (interface + per-preset tags + selector)
- Test: `apps/web/src/stickerBank.test.ts`

Gender classification is derived from the gender marks already in
`packages/shared/src/solo-scan/content-bank.ts` (archetype/caption → `stickerId`
maps). Untagged presets are neutral (shown to both). Two neutral presets carry a
femme label override (`unc` → "AUNTIE STATUS", `let-him-cook` → "LET HER COOK").

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/stickerBank.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stickersFor } from '@fitaura/shared';

describe('stickersFor', () => {
  it('hides masc-only stickers from femme and femme-only from masc', () => {
    const femmeFace = stickersFor('face', 'femme').map((s) => s.id);
    const mascFace = stickersFor('face', 'masc').map((s) => s.id);
    // femme-only
    expect(femmeFace).toContain('girlboss');
    expect(mascFace).not.toContain('girlboss');
    // masc-only
    expect(mascFace).toContain('alpha');
    expect(femmeFace).not.toContain('alpha');
  });

  it('keeps neutral stickers for both genders', () => {
    expect(stickersFor('face', 'femme').map((s) => s.id)).toContain('hear-me-out');
    expect(stickersFor('face', 'masc').map((s) => s.id)).toContain('hear-me-out');
  });

  it('filters delulu (femme) out of the masc outfit bank', () => {
    expect(stickersFor('outfit', 'masc').map((s) => s.id)).not.toContain('delulu');
    expect(stickersFor('outfit', 'femme').map((s) => s.id)).toContain('delulu');
  });

  it('applies femme label overrides on neutral stickers', () => {
    const femmeOutfit = stickersFor('outfit', 'femme');
    expect(femmeOutfit.find((s) => s.id === 'let-him-cook')!.label).toBe('LET HER COOK');
    const mascOutfit = stickersFor('outfit', 'masc');
    expect(mascOutfit.find((s) => s.id === 'let-him-cook')!.label).toBe('LET HIM COOK');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @fitaura/web -- stickerBank`
Expected: FAIL — `stickersFor` is not exported.

- [ ] **Step 3: Extend `StickerPreset` and tag every preset**

In `packages/shared/src/sticker-bank.ts`, change the `StickerPreset` interface:

```ts
export interface StickerPreset {
  id: string;
  label: string;
  tone: StickerTone;
  rotation: number;
  /** Gender eligibility — omitted = neutral (shown to both). */
  gender?: 'masc' | 'femme';
  /** Label shown when the bank is filtered for femme (neutral presets only). */
  femmeLabel?: string;
}
```

Then add the gender tags to the presets. Replace the **face** array entries that are gendered (leave untagged entries exactly as they are):

```ts
    { id: 'chad', label: 'CHAD', tone: 'chrome', rotation: -6, gender: 'masc' },
```
```ts
    { id: 'unc', label: 'UNC STATUS', tone: 'warn', rotation: -8, femmeLabel: 'AUNTIE STATUS' },
```
```ts
    { id: 'alpha', label: 'ALPHA MALE', tone: 'chrome', rotation: -7, gender: 'masc' },
    { id: 'sigma', label: 'SIGMA MALE', tone: 'chrome', rotation: -6, gender: 'masc' },
    { id: 'beta', label: 'BETA MALE', tone: 'warn', rotation: -8, gender: 'masc' },
    { id: 'tate', label: 'TATE DROPOUT', tone: 'warn', rotation: -6, gender: 'masc' },
    { id: 'milf-hunter', label: 'MILF HUNTER', tone: 'chrome', rotation: -7, gender: 'masc' },
    { id: 'simp', label: 'SIMP', tone: 'warn', rotation: -8, gender: 'masc' },
    { id: 'performative-male', label: 'PERFORMATIVE MALE', tone: 'chrome', rotation: -6, gender: 'masc' },
    { id: 'mother', label: 'MOTHER', tone: 'chrome', rotation: -7, gender: 'femme' },
    { id: 'femme-fatale', label: 'FEMME FATALE', tone: 'chrome', rotation: -6, gender: 'femme' },
    { id: 'it-girl', label: 'IT GIRL', tone: 'chrome', rotation: -8, gender: 'femme' },
    { id: 'girlboss', label: 'GIRLBOSS', tone: 'chrome', rotation: -7, gender: 'femme' },
    { id: 'material-girl', label: 'MATERIAL GIRL', tone: 'chrome', rotation: -6, gender: 'femme' },
    { id: 'vip', label: 'VIP', tone: 'chrome', rotation: -8, gender: 'femme' },
    { id: 'clean-girl', label: 'CLEAN GIRL', tone: 'chrome', rotation: -7, gender: 'femme' },
    { id: 'brat', label: 'BRAT', tone: 'chrome', rotation: -6, gender: 'femme' },
    { id: 'drama-queen', label: 'DRAMA QUEEN', tone: 'warn', rotation: -7, gender: 'femme' },
```

Replace the gendered **outfit** array entries:

```ts
    { id: 'let-him-cook', label: 'LET HIM COOK', tone: 'chrome', rotation: 7, femmeLabel: 'LET HER COOK' },
```
```ts
    { id: 'delulu', label: 'DELULU', tone: 'chrome', rotation: 7, gender: 'femme' },
```
```ts
    { id: 'sigma-fit', label: 'SIGMA GRINDSET', tone: 'chrome', rotation: 7, gender: 'masc' },
    { id: 'millennial', label: 'MILLENNIAL CODED', tone: 'chrome', rotation: 6, gender: 'masc' },
    { id: 'unc-fit', label: 'UNC FIT', tone: 'warn', rotation: 7, gender: 'masc' },
    { id: 'old-money-temu', label: 'OLD MONEY (TEMU)', tone: 'warn', rotation: 6, gender: 'masc' },
    { id: 'boomer', label: 'BOOMER-CODED', tone: 'warn', rotation: 7, gender: 'masc' },
    { id: 'fashion-girl', label: 'FASHION GIRL', tone: 'chrome', rotation: 7, gender: 'femme' },
    { id: 'vip-fit', label: 'VIP LIST', tone: 'chrome', rotation: 6, gender: 'femme' },
    { id: 'material-girl-fit', label: 'MATERIAL GIRL', tone: 'chrome', rotation: 7, gender: 'femme' },
    { id: 'brat-fit', label: 'BRAT SUMMER', tone: 'chrome', rotation: 6, gender: 'femme' },
    { id: 'clean-girl-fit', label: 'CLEAN GIRL', tone: 'chrome', rotation: 7, gender: 'femme' },
```

(All other presets — `hear-me-out`, `plot-relevant`, `aura-farmer`, `main-character`, `goat`, `mafia-boss`, `locked-in`, `honorable-mention`, `delusional`, `chopped`, `canon-event`, `negative-aura`, `ai-slop`, and outfit `never-cook-again`, `buffering`, `performative`, `rizz`, `aura-debt` — stay untagged = neutral.)

- [ ] **Step 4: Add the `stickersFor` selector**

At the end of `packages/shared/src/sticker-bank.ts`, add:

```ts
/** The sticker presets eligible for a gender: neutral always, plus that gender's
 * own. Applies femme label overrides so a femme bank reads correctly. */
export function stickersFor(kind: StickerKind, gender: 'masc' | 'femme'): StickerPreset[] {
  return STICKER_BANK[kind]
    .filter((s) => !s.gender || s.gender === gender)
    .map((s) => (gender === 'femme' && s.femmeLabel ? { ...s, label: s.femmeLabel } : s));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace @fitaura/web -- stickerBank`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/sticker-bank.ts apps/web/src/stickerBank.test.ts
git commit -m "feat(stickers): gender-tag the bank + stickersFor selector"
```

---

## Task 3: Result page — theme the card + filter the sticker picker

**Files:**
- Modify: `apps/web/src/features/result/Result.tsx`

- [ ] **Step 1: Swap the shared import**

Replace the import block at `Result.tsx:3-9`:

```ts
import {
  STICKER_BANK,
  stickerFromPreset,
  VERDICT_COLOR_VAR,
  type ReceiptPaper,
  type StickerData,
} from '@fitaura/shared';
```

with:

```ts
import {
  stickersFor,
  stickerFromPreset,
  genderOf,
  VERDICT_COLOR_VAR,
  type ReceiptPaper,
  type StickerData,
} from '@fitaura/shared';
```

- [ ] **Step 2: Derive gender + filtered banks**

Replace the block at `Result.tsx:196-199`:

```ts
  const facePreset = STICKER_BANK.face[stk.face];
  const outfitPreset = STICKER_BANK.outfit[stk.outfit];
  const faceSticker: StickerData = stickerFromPreset(facePreset, !stickerOn);
  const outfitSticker: StickerData = stickerFromPreset(outfitPreset, !stickerOn);
```

with:

```ts
  const gender = genderOf(result);
  const faceStickers = stickersFor('face', gender);
  const outfitStickers = stickersFor('outfit', gender);
  // `stk` indexes into the (gender-filtered) bank; clamp in case a stored index
  // is out of range for this gender's shorter list.
  const facePreset = faceStickers[Math.min(stk.face, faceStickers.length - 1)];
  const outfitPreset = outfitStickers[Math.min(stk.outfit, outfitStickers.length - 1)];
  const kindStickers = kind === 'face' ? faceStickers : kind === 'outfit' ? outfitStickers : [];
  const faceSticker: StickerData = stickerFromPreset(facePreset, !stickerOn);
  const outfitSticker: StickerData = stickerFromPreset(outfitPreset, !stickerOn);
```

- [ ] **Step 3: Point swap at the filtered bank**

Replace `Result.tsx:201-204`:

```ts
  const swapSticker = () => {
    if (kind === 'receipt') return;
    setStk((s) => ({ ...s, [kind]: (s[kind] + 1) % STICKER_BANK[kind].length }));
  };
```

with:

```ts
  const swapSticker = () => {
    if (kind === 'receipt' || kindStickers.length === 0) return;
    setStk((s) => ({ ...s, [kind]: (s[kind] + 1) % kindStickers.length }));
  };
```

- [ ] **Step 4: Point the edit-panel sticker grid at the filtered bank**

Replace `Result.tsx:523` (inside the image-card edit panel):

```tsx
                {STICKER_BANK[kind].map((s, i) => (
```

with:

```tsx
                {kindStickers.map((s, i) => (
```

- [ ] **Step 5: Add `data-gender` to the card mount**

Replace `Result.tsx:449`:

```tsx
              <div className="rs-card-mount" data-paper={paper} data-verdict={result.verdict}>
```

with:

```tsx
              <div className="rs-card-mount" data-paper={paper} data-verdict={result.verdict} data-gender={gender}>
```

- [ ] **Step 6: Add `data-gender` to the offscreen export cards**

In the export host (`Result.tsx` ~lines 642, 650, 662), add `data-gender={gender}` to each `rs-export-card` wrapper. Change:

```tsx
        <div className="rs-export-card" ref={exportRefs.face}>
```
to
```tsx
        <div className="rs-export-card" ref={exportRefs.face} data-gender={gender}>
```

Change:

```tsx
        <div className="rs-export-card" ref={exportRefs.outfit}>
```
to
```tsx
        <div className="rs-export-card" ref={exportRefs.outfit} data-gender={gender}>
```

Change:

```tsx
        <div
          className="rs-export-card is-receipt"
          ref={exportRefs.receipt}
          data-paper={paper}
          data-verdict={result.verdict}
        >
```
to
```tsx
        <div
          className="rs-export-card is-receipt"
          ref={exportRefs.receipt}
          data-paper={paper}
          data-verdict={result.verdict}
          data-gender={gender}
        >
```

- [ ] **Step 7: Import the femme theme stylesheet**

Add this import alongside the other CSS imports near the top of `Result.tsx` (after `import '../../design/sticker-studio.css';` at line 29):

```ts
import '../../design/gender-theme.css';
```

(The file is created in Task 4. Add the import now; it is harmless to import an empty file, and Task 4 runs before verification.)

- [ ] **Step 8: Typecheck the web app**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: it FAILS in `apps/web/src/data/mockGenerations.ts` because `gender` is now required on `FullGenerationResult`. That is fixed in Task 5 — proceed.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/result/Result.tsx
git commit -m "feat(result): theme card by gender + gender-filter the sticker picker"
```

---

## Task 4: Femme card theme (magenta + gold, system tokens only)

**Files:**
- Create: `apps/web/src/design/gender-theme.css`

- [ ] **Step 1: Create the stylesheet**

Create `apps/web/src/design/gender-theme.css`:

```css
/* ============================================================
   FEMME CARD IDENTITY — magenta accent + gold detailing.
   System tokens only (--magenta / --gold already in :root).
   Scoped to the card subtree (mount + export hosts) so the page
   chrome keeps the brand accent. Masc = default (no rules here).
   ============================================================ */

.rs-card-mount[data-gender="femme"],
.rs-export-card[data-gender="femme"] {
  /* The cards paint everything off --accent; remapping it here recolors the
     whole card (face + outfit) to magenta without touching page chrome. */
  --accent: var(--magenta);
}

/* Gold detailing — the wordmark + footer index read gold for femme.
   Selectors verified against FaceCard (.facecard .brand-tag, .fc-foot .kind-tag)
   and OutfitCard (.outfitcard .brand-tag, .oc-foot .kind-tag). */
.rs-card-mount[data-gender="femme"] .facecard .brand-tag,
.rs-export-card[data-gender="femme"] .facecard .brand-tag,
.rs-card-mount[data-gender="femme"] .facecard .fc-foot .kind-tag,
.rs-export-card[data-gender="femme"] .facecard .fc-foot .kind-tag,
.rs-card-mount[data-gender="femme"] .outfitcard .brand-tag,
.rs-export-card[data-gender="femme"] .outfitcard .brand-tag,
.rs-card-mount[data-gender="femme"] .outfitcard .oc-foot .kind-tag,
.rs-export-card[data-gender="femme"] .outfitcard .oc-foot .kind-tag {
  color: var(--gold);
}

/* Selfie ring gets a magenta→gold sheen instead of the icy conic. */
.rs-card-mount[data-gender="femme"] .facecard .selfie-ring,
.rs-export-card[data-gender="femme"] .facecard .selfie-ring {
  background: conic-gradient(
    from 0deg,
    var(--magenta),
    color-mix(in oklab, var(--gold) 70%, #fff),
    var(--magenta),
    color-mix(in oklab, var(--magenta) 25%, transparent),
    var(--magenta)
  );
}
```

- [ ] **Step 2: Typecheck still only fails on mock data**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: still only the `mockGenerations.ts` error from Task 3 (CSS doesn't affect tsc). Proceed to Task 5.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/design/gender-theme.css
git commit -m "feat(cards): femme magenta+gold card theme (scoped, system tokens)"
```

---

## Task 5: Make local data testable + green build

**Files:**
- Modify: `apps/web/src/data/mockGenerations.ts`

- [ ] **Step 1: Read the mock file and add the required `gender`**

Open `apps/web/src/data/mockGenerations.ts`. Each exported `FullGenerationResult` object literal now fails to compile because `gender` is required. Add `gender:` to every mock result object (next to its `verdict`/`parts`). Set **at least one** mock to `gender: 'femme'` so the femme theme is exercised locally; set the rest to `gender: 'masc'`. Example shape of the edit per mock:

```ts
  verdict: 'red_flag',
  chip: 'VERDICT · RED FLAG',
  gender: 'femme',   // <-- add this line (use 'masc' for the others)
  parts: { face: true, outfit: true },
```

- [ ] **Step 2: Typecheck the whole repo**

Run: `npm run typecheck`
Expected: PASS for both `@fitaura/shared` and `@fitaura/web` (no missing-`gender` errors).

- [ ] **Step 3: Run the full test suite**

Run: `npm run test --workspace @fitaura/web`
Expected: PASS — including the existing `assemble.test.ts` (unchanged behavior) plus the two new test files.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: `tsc --noEmit` passes and Vite builds with no errors.

- [ ] **Step 5: Manual smoke (local)**

Run: `npm run dev`. Open a result that uses the femme mock (or temporarily set the active mock's `gender` to `'femme'`). Verify:
- The face + outfit cards show a **magenta** accent (ring, stat bars, eyebrow highlight) and a **gold** FITAURA wordmark / footer index.
- A masc result still shows the icy/cyan accent.
- In sticker edit mode on a **femme** result, the picker shows femme + neutral stickers (GIRLBOSS, IT GIRL, BRAT, DELULU, HEAR ME OUT…) and **no** masc-only stickers (no ALPHA MALE / SIGMA / TATE). On a **masc** result it's the inverse.
- Export a femme card (Download) and confirm the saved PNG keeps the magenta+gold (snapdom captures the themed subtree).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/data/mockGenerations.ts
git commit -m "test(mock): set gender on mock generations for local femme verification"
```

---

## Task 6: Deploy the edge function (makes it live)

The web changes are inert on live scans until `assembleResult` is redeployed, because it runs server-side. The Gemini prompt/schema are unchanged — this only re-emits the already-computed `gender`.

- [ ] **Step 1: Deploy `solo-scan`**

Follow the project's documented manual deploy for the edge function (no Docker; `.ts` import extensions required). From the repo root:

Run: `npx supabase functions deploy solo-scan --project-ref <project-ref> --use-api`

(Use the same `--project-ref` and flags the repo already uses for solo-scan deploys — see the deploy memory/convention. If you prefer to run this yourself in the session, type `! npx supabase functions deploy solo-scan ...`.)

- [ ] **Step 2: Verify live**

Run a real scan in the deployed app; confirm a female-presenting submission renders the magenta+gold card and a gender-filtered sticker picker, and a male one stays icy/cyan.

---

## Self-Review

**Spec coverage (Phase A part 1):**
- Surface `gender` into result + `genderOf` legacy default — Task 1. ✓
- Gender fixed, no toggle — model carries a single value; no override code anywhere. ✓
- Femme = magenta + gold via existing tokens, masc = icy/cyan — Task 4 (scoped `--accent` remap + gold). ✓
- Gender-filtered sticker picker + swap, femme labels (UNC→AUNTIE, LET HIM→HER COOK) — Tasks 2-3. ✓
- Edge redeploy called out — Task 6. ✓
- Export keeps the theme (snapdom) — Task 3 Step 6 + Task 5 Step 5. ✓
- (Out of scope here, separate plans: Premium QR receipt; skins + switcher.)

**Placeholder scan:** No TBD/TODO. The only `<project-ref>` placeholder is an environment secret the executor supplies from the existing deploy convention, not a code gap.

**Type consistency:** `gender: 'femme' | 'masc'` is identical on the interface (Task 1), `genderOf` (Task 1), `contentGender` (already that union in assemble), `stickersFor(kind, gender)` (Task 2), and the `Result.tsx` `gender` const (Task 3). `StickerPreset.gender`/`femmeLabel` defined in Task 2 are consumed only by `stickersFor`. `kindStickers` defined in Task 3 Step 2 is used in Steps 3-4.
