# AI-grounded captions, verdict lines & roasts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the solo-scan card line, outfit caption, punchline and roasts read as unique, grounded-in-the-actual-photo text instead of recycled banked phrases or a hardcoded celebrity stamp.

**Architecture:** Hybrid. The model keeps *selecting* a category id (which still drives the sticker art, score-band sanity and a deterministic fallback) and additionally *writes* three short display lines. A pure `copyFilter` decides whether each written line is used (passes length + cliché + icon-name checks) or replaced by the banked fallback. Sticker and score never depend on generated text. The hardcoded `Giving <name> energy.` summary stamp is removed; recognized icons are referenced only by allusion (prompt), and the literal name is scrubbed from all copy (backend).

**Tech stack:** TypeScript, Zod (`packages/shared`), Vitest (tests run from `apps/web`), a Deno edge function (`supabase/functions/solo-scan`) that imports the shared schema and is deployed manually.

**Design source:** `docs/superpowers/specs/2026-06-18-ai-grounded-captions-design.md`

**Conventions:**
- Run the full suite with: `npm test --workspace @fitaura/web`
- Run one file with: `npm test --workspace @fitaura/web -- <path-fragment>`
- Typecheck with: `npm run typecheck`
- Schema caps in Zod are **generous** (catch garbage only); the **tight** display caps live in `assemble.ts` so an over-long model line falls back gracefully instead of failing the whole scan (`schema_invalid`).

---

### Task 1: `copyFilter` module (cliché filter + name scrub + accept/fallback)

**Files:**
- Create: `packages/shared/src/solo-scan/copyFilter.ts`
- Modify: `packages/shared/src/solo-scan/index.ts`
- Test: `apps/web/src/solo-scan/copyFilter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/solo-scan/copyFilter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isCliche, scrubName, acceptWritten } from '@fitaura/shared';

describe('isCliche', () => {
  it('flags the banned patterns', () => {
    for (const t of ['Giving CEO', "it's giving lawyer", 'main villain vibes', 'rizz energy', 'the fit has lore', 'certified menace', 'a true cultural reset', 'beauty in human form', 'serving looks', 'old-money-coded']) {
      expect(isCliche(t)).toBe(true);
    }
  });
  it('passes grounded lines', () => {
    for (const t of ['JAW DID THE TALKING', 'KING OF POP', 'SUUUIII', 'STRUCTURE OVER FLASH']) {
      expect(isCliche(t)).toBe(false);
    }
  });
});

describe('scrubName', () => {
  it('removes the literal name, case-insensitive, collapsing space', () => {
    expect(scrubName('Michael Jackson moonwalks in', 'Michael Jackson')).toBe('moonwalks in');
    expect(scrubName('pure MCLOVIN energy', 'McLovin')).toBe('pure energy');
  });
  it('is a no-op when name is null or absent', () => {
    expect(scrubName('clean fit', null)).toBe('clean fit');
    expect(scrubName('clean fit', 'Ronaldo')).toBe('clean fit');
  });
});

describe('acceptWritten', () => {
  const cap = 18;
  it('returns the trimmed line when valid', () => {
    expect(acceptWritten('  JAW DID  ', cap, null)).toBe('JAW DID');
  });
  it('returns null for empty, too-long, or cliché', () => {
    expect(acceptWritten('', cap, null)).toBeNull();
    expect(acceptWritten('   ', cap, null)).toBeNull();
    expect(acceptWritten('THIS LINE IS WAY TOO LONG TO FIT', cap, null)).toBeNull();
    expect(acceptWritten('GIVING BANKER', cap, null)).toBeNull();
  });
  it('returns null when scrubbing the icon name empties it', () => {
    expect(acceptWritten('McLovin', cap, 'McLovin')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @fitaura/web -- copyFilter`
Expected: FAIL — `isCliche`/`scrubName`/`acceptWritten` are not exported.

- [ ] **Step 3: Create the module**

Create `packages/shared/src/solo-scan/copyFilter.ts`:

```ts
// packages/shared/src/solo-scan/copyFilter.ts
// Shared cliché/length/name filter for model-written copy. Keep CLICHE_PATTERNS in
// sync with the BANNED list in supabase/functions/solo-scan/gemini.ts.

const CLICHE_PATTERNS: RegExp[] = [
  /\bgiving\b/i,
  /it'?s giving/i,
  /\bvibes?\b/i,
  /\benergy\b/i,
  /\blore\b/i,
  /\bcertified\b/i,
  /cultural reset/i,
  /in human form/i,
  /\bserving\b/i,
  /\ba true\b/i,
  /-coded\b/i,
];

/** True when `text` contains a banned cliché. */
export function isCliche(text: string): boolean {
  return CLICHE_PATTERNS.some((re) => re.test(text));
}

/** Remove the literal icon name (whole-word, case-insensitive) and collapse spaces. */
export function scrubName(text: string, name: string | null): string {
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Accept a model-written display line, or null to signal "use the banked fallback".
 * Scrubs the icon name first, then rejects empty / too-long / cliché output.
 */
export function acceptWritten(
  written: string | null | undefined,
  maxLen: number,
  iconName: string | null,
): string | null {
  if (!written) return null;
  const cleaned = scrubName(written.trim(), iconName);
  if (!cleaned) return null;
  if (cleaned.length > maxLen) return null;
  if (isCliche(cleaned)) return null;
  return cleaned;
}
```

- [ ] **Step 4: Export from the barrel**

Edit `packages/shared/src/solo-scan/index.ts` — add the new export line after `export * from './content-bank';`:

```ts
export * from './copyFilter';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test --workspace @fitaura/web -- copyFilter`
Expected: PASS (all three describe blocks green).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/solo-scan/copyFilter.ts packages/shared/src/solo-scan/index.ts apps/web/src/solo-scan/copyFilter.test.ts
git commit -m "feat(solo-scan): add copyFilter (cliché/length/name guard for written copy)"
```

---

### Task 2: Schema fields + version bump + fixture

**Files:**
- Modify: `packages/shared/src/solo-scan/schema.ts:68-87`
- Modify: `packages/shared/src/solo-scan/constants.ts:3,8`
- Modify: `packages/shared/src/solo-scan/__fixtures__.ts:30-49`
- Test: `apps/web/src/solo-scan/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/solo-scan/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { soloScanSchema, sampleAIOutput, SOLO_SCAN_SCHEMA_VERSION } from '@fitaura/shared';

describe('soloScanSchema v3_4', () => {
  it('the fixture parses and carries the new written fields', () => {
    const parsed = soloScanSchema.parse(sampleAIOutput());
    expect(SOLO_SCAN_SCHEMA_VERSION).toBe('solo_scan_v3_4');
    expect(parsed.faceCopy.verdictLine).toEqual({ lead: 'JAW DID', punch: 'THE TALKING' });
    expect(parsed.outfitCopy.captionLine).toBe('STRUCTURE OVER FLASH');
    expect(parsed.receiptContent.punchlineText).toBe('QUIET CONFIDENCE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @fitaura/web -- schema.test`
Expected: FAIL — version is still `solo_scan_v3_3` and the new fields don't exist.

- [ ] **Step 3: Bump the versions**

Edit `packages/shared/src/solo-scan/constants.ts`:

```ts
export const SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v3_4' as const;
```
```ts
export const SOLO_SCAN_PROMPT_VERSION = 'v3_4' as const;
```

- [ ] **Step 4: Add the schema fields**

In `packages/shared/src/solo-scan/schema.ts`, replace the `faceCopy` object (currently L68-72):

```ts
    faceCopy: z.object({
      strongestPoint: z.string().max(200),
      improvement: z.string().max(200),
      summary: z.string().max(200),
      verdictLine: z.object({ lead: z.string().max(40), punch: z.string().max(40) }),
    }),
```

Replace the `outfitCopy` object (currently L73-77):

```ts
    outfitCopy: z.object({
      works: z.string().max(200),
      hurts: z.string().max(200),
      verdict: z.string().max(200),
      captionLine: z.string().max(80),
    }),
```

Replace the `receiptContent` object (currently L84-87):

```ts
    receiptContent: z.object({
      metricCandidates: candidates,
      punchlineCandidates: candidates,
      punchlineText: z.string().max(80),
    }),
```

- [ ] **Step 5: Add the fields to the test fixture**

In `packages/shared/src/solo-scan/__fixtures__.ts`, replace `faceCopy` (L30-34):

```ts
    faceCopy: {
      strongestPoint: 'The haircut frames the face cleanly.',
      improvement: 'A more direct angle would add presence.',
      summary: 'Strong base presentation with room for a sharper angle.',
      verdictLine: { lead: 'JAW DID', punch: 'THE TALKING' },
    },
```

Replace `outfitCopy` (L35-39):

```ts
    outfitCopy: {
      works: 'The jacket adds structure through the shoulders.',
      hurts: 'The trouser break shortens the silhouette.',
      verdict: 'Good base, but the proportions can be sharper.',
      captionLine: 'STRUCTURE OVER FLASH',
    },
```

Replace `receiptContent` (L46-49):

```ts
    receiptContent: {
      metricCandidates: ['metric.lover_boy_probability'],
      punchlineCandidates: ['punchline.certified_lover_boy'],
      punchlineText: 'QUIET CONFIDENCE',
    },
```

- [ ] **Step 6: Run test + typecheck to verify it passes**

Run: `npm test --workspace @fitaura/web -- schema.test`
Expected: PASS.
Run: `npm run typecheck`
Expected: no errors (the fixture now satisfies the stricter type).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/solo-scan/schema.ts packages/shared/src/solo-scan/constants.ts packages/shared/src/solo-scan/__fixtures__.ts apps/web/src/solo-scan/schema.test.ts
git commit -m "feat(solo-scan): add written verdictLine/captionLine/punchlineText fields (schema v3_4)"
```

---

### Task 3: Content-bank prune + rename + new mid fallbacks

**Files:**
- Modify: `packages/shared/src/solo-scan/content-bank.ts` (FACE_BANK ~L78-112, OUTFIT_BANK ~L124-148, PUNCHLINE_BANK ~L159-189)
- Test: `apps/web/src/solo-scan/content-bank.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/solo-scan/content-bank.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickFaceArchetype, pickOutfitCaption, pickPunchline } from '@fitaura/shared';

const NEW_MID_OUTFIT = [
  'PLAYS IT SAFE', 'DRESSED, NOT DRIPPING', "SHOWS UP, DOESN'T SHOW OFF",
  'DECENT, NOT DANGEROUS', 'RESPECTABLE, NOT REMARKABLE', 'ROOM TO GROW',
];

describe('content-bank edits', () => {
  it('renames milf hunter to POTENTIAL MILF HUNTER', () => {
    expect(pickFaceArchetype(['face_archetype.milf_hunter'], 'mid', 's', 'masc').line)
      .toEqual(['POTENTIAL', 'MILF HUNTER']);
  });
  it('renames the locked-in outfit caption to LOCKED IN', () => {
    expect(pickOutfitCaption(['outfit_caption.locked_in'], 'elite', 's', 'masc').caption)
      .toBe('LOCKED IN');
  });
  it('renames the npc punchline to PROSPECTIVE NPC', () => {
    expect(pickPunchline(['punchline.clean_npc_potential'], 'mid', 's', 'masc'))
      .toBe('PROSPECTIVE NPC');
  });
  it('mid-band neutral outfit fallback is one of the new captions', () => {
    // performative + clean_npc_potential removed → mid neutral pool is exactly the 6 new lines.
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(NEW_MID_OUTFIT).toContain(pickOutfitCaption([], 'mid', seed, 'masc').caption);
    }
  });
  it('an invalid (removed) candidate falls back to a band pick, never the removed text', () => {
    const got = pickFaceArchetype(['face_archetype.plot_relevant'], 'mid', 's', 'masc').line.join(' ');
    expect(got).not.toBe('CLEAN NPC PLOT RELEVANT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @fitaura/web -- content-bank.test`
Expected: FAIL — renames not applied, new captions absent.

- [ ] **Step 3a: Remove the 4 face archetypes**

In `FACE_BANK`, delete these four entries:

```ts
  'face_archetype.plot_relevant': { line: ['CLEAN NPC', 'PLOT RELEVANT'], stickerId: 'plot-relevant', band: 'mid' },
```
```ts
  'face_archetype.red_flag_good_angles': { line: ['RED FLAG', 'WITH GOOD ANGLES'], stickerId: 'hear-me-out', band: 'low' },
```
```ts
  'face_archetype.delusional': { line: ['DELUSIONAL', 'BUT CONFIDENT'], stickerId: 'delusional', band: 'low' },
```
```ts
  'face_archetype.femme_fatale': { line: ['FEMME', 'FATALE'], stickerId: 'femme-fatale', band: 'elite', gender: 'femme' },
```

- [ ] **Step 3b: Rename the milf-hunter face line**

Replace:
```ts
  'face_archetype.milf_hunter': { line: ['DEFINITELY A', 'MILF HUNTER'], stickerId: 'milf-hunter', band: 'mid', gender: 'masc' },
```
with:
```ts
  'face_archetype.milf_hunter': { line: ['POTENTIAL', 'MILF HUNTER'], stickerId: 'milf-hunter', band: 'mid', gender: 'masc' },
```

- [ ] **Step 3c: Edit OUTFIT_BANK — rename locked_in, remove 2, add 6 mid fallbacks**

Replace:
```ts
  'outfit_caption.locked_in': { caption: 'THE FIT IS LOCKED IN', stickerId: 'locked-in', band: 'elite' },
```
with:
```ts
  'outfit_caption.locked_in': { caption: 'LOCKED IN', stickerId: 'locked-in', band: 'elite' },
```

Delete these two entries:
```ts
  'outfit_caption.clean_npc_potential': { caption: 'CLEAN NPC WITH POTENTIAL', stickerId: 'buffering', band: 'mid' },
```
```ts
  'outfit_caption.performative': { caption: 'PERFORMATIVE EDITORIAL', stickerId: 'performative', band: 'mid' },
```

Add these six entries (place them in the neutral group, e.g. right after the `rizz` entry):
```ts
  'outfit_caption.plays_it_safe': { caption: 'PLAYS IT SAFE', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.not_dripping': { caption: 'DRESSED, NOT DRIPPING', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.shows_up': { caption: "SHOWS UP, DOESN'T SHOW OFF", stickerId: 'buffering', band: 'mid' },
  'outfit_caption.not_dangerous': { caption: 'DECENT, NOT DANGEROUS', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.not_remarkable': { caption: 'RESPECTABLE, NOT REMARKABLE', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.room_to_grow': { caption: 'ROOM TO GROW', stickerId: 'buffering', band: 'mid' },
```

- [ ] **Step 3d: Edit PUNCHLINE_BANK — rename npc, remove 2**

Replace:
```ts
  'punchline.clean_npc_potential': { text: 'NPC WITH POTENTIAL', band: 'mid' },
```
with:
```ts
  'punchline.clean_npc_potential': { text: 'PROSPECTIVE NPC', band: 'mid' },
```

Delete these two entries:
```ts
  'punchline.mother_mothered': { text: 'MOTHER HAS MOTHERED', band: 'elite', gender: 'femme' },
```
```ts
  'punchline.girlboss_trio': { text: 'GASLIGHT GATEKEEP GIRLBOSS', band: 'high', gender: 'femme' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace @fitaura/web -- content-bank.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/content-bank.ts apps/web/src/solo-scan/content-bank.test.ts
git commit -m "feat(solo-scan): prune/rename banked phrases, add mid-band outfit fallbacks"
```

---

### Task 4: Assembly — use written lines with fallback, drop the celeb stamp, scrub the name

**Files:**
- Modify: `packages/shared/src/solo-scan/assemble.ts` (imports L8-13, face line ~L84-104, outfit caption ~L119-131, punchline ~L75, summary ~L171-176)
- Test: `apps/web/src/solo-scan/assemble.test.ts` (replace the icon test L82-89, add new tests)

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/solo-scan/assemble.test.ts`, **replace** the test `surfaces a recognized icon name only above the confidence gate` (L82-89) with:

```ts
  it('never writes a recognized icon name into the summary (scrubbed)', () => {
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, recognizedIcon: 'McLovin', recognizedConfidence: 0.95 };
    ai.faceCopy = { ...ai.faceCopy, summary: 'Pure McLovin presence on the brow.' };
    const r = assembleResult(ai, 'scan-icon', 'v3', { face: true, outfit: true });
    expect(r.receipt.summary).not.toContain('McLovin');
    expect(r.receipt.summary).not.toContain('Giving');
  });
```

Then add a new describe block at the end of the file:

```ts
describe('assembleResult v3.4 — written copy with fallback', () => {
  it('uses the written line, caption and punchline when valid', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-w', 'v3_4', { face: true, outfit: true });
    expect(r.face!.card.verdict).toEqual(['JAW DID', 'THE TALKING']);
    expect(r.outfit!.card.caption).toBe('STRUCTURE OVER FLASH');
    expect(r.receipt.finalPunchline).toBe('QUIET CONFIDENCE');
  });

  it('falls back to the banked phrase when the written line is cliché/empty', () => {
    const ai = sampleAIOutput();
    ai.faceCopy.verdictLine = { lead: 'GIVING', punch: 'ENERGY' }; // cliché
    ai.outfitCopy.captionLine = '';                               // empty
    ai.receiptContent.punchlineText = 'this written punchline is far too long to ever fit'; // too long
    const r = assembleResult(ai, 'scan-w', 'v3_4', { face: true, outfit: true });
    expect(r.face!.card.verdict).not.toEqual(['GIVING', 'ENERGY']);
    expect(r.face!.card.verdict).toHaveLength(2);
    expect(r.outfit!.card.caption.length).toBeGreaterThan(0);
    expect(r.receipt.finalPunchline.length).toBeGreaterThan(0);
    // sticker + scores untouched by the fallback
    expect(r.face!.card.sticker.label.length).toBeGreaterThan(0);
    expect(r.face!.card.scores).toHaveLength(4);
  });

  it('falls back when the written line is only the icon name', () => {
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, recognizedIcon: 'McLovin', recognizedConfidence: 0.9 };
    ai.faceCopy.verdictLine = { lead: 'MC', punch: 'LOVIN' }; // combines to the name
    const r = assembleResult(ai, 'scan-w', 'v3_4', { face: true, outfit: true });
    expect(r.face!.card.verdict.join(' ')).not.toContain('LOVIN');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @fitaura/web -- assemble.test`
Expected: FAIL — assembly still uses banked lines and the `Giving …` stamp.

- [ ] **Step 3: Update imports**

In `packages/shared/src/solo-scan/assemble.ts`, replace the scoring import block (L9-12) — drop `ICON_NAME_CONFIDENCE_MIN`:

```ts
import {
  scoreFromRating, faceScore, outfitScore, auraIndex, displayScore, percent, pickVerdict,
  biasFactor, applyScoreBias, isMemeGlory, applyGloryFloor,
} from './scoring.ts';
```

Add this import directly below the `content-bank` import (after L13):

```ts
import { acceptWritten, scrubName } from './copyFilter.ts';
```

- [ ] **Step 4: Add the icon-name handle near the top of `assembleResult`**

Immediately after the `const band = scoreBand(aura);` line (~L72), add:

```ts
  const iconName = ai.presentation.recognizedIcon;
```

- [ ] **Step 5: Wire the written punchline**

Replace the `punchline` line (~L75):

```ts
  const bankedPunchline = pickPunchline(glory ? undefined : ai.receiptContent.punchlineCandidates, band, scanId, contentGender);
  const punchline = acceptWritten(ai.receiptContent.punchlineText, 26, iconName) ?? bankedPunchline;
```

- [ ] **Step 6: Wire the written face verdict line**

Inside `if (parts.face) {`, replace the `verdict: archetype.line,` property in `faceCard` with `verdict: verdictLine,`, and add the resolution just above `const faceCard = {` (after the `const archetype = …` line, ~L84):

```ts
    const lead = acceptWritten(ai.faceCopy.verdictLine.lead, 18, iconName);
    const punch = acceptWritten(ai.faceCopy.verdictLine.punch, 18, iconName);
    const nameInLine = iconName ? new RegExp(iconName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      .test(`${ai.faceCopy.verdictLine.lead} ${ai.faceCopy.verdictLine.punch}`) : false;
    const verdictLine: [string, string] = lead && punch && !nameInLine ? [lead, punch] : archetype.line;
```

- [ ] **Step 7: Wire the written outfit caption**

Inside `if (parts.outfit) {`, replace `caption: caption.caption,` in `outfitCard` with `caption: captionText,`, and add just above `const outfitCard = {` (after the `const caption = …` line, ~L119):

```ts
    const captionText = acceptWritten(ai.outfitCopy.captionLine, 30, iconName) ?? caption.caption;
```

- [ ] **Step 8: Remove the celeb stamp + scrub the summary**

Replace the summary block (~L171-176):

```ts
  const faceSummary = parts.face ? ai.faceCopy.summary : '';
  const outfitSummary = parts.outfit ? ai.outfitCopy.verdict : '';
  const baseSummary = [faceSummary, outfitSummary].filter(Boolean).join(' ');
  const summary = ai.presentation.recognizedIcon && ai.presentation.recognizedConfidence >= ICON_NAME_CONFIDENCE_MIN
    ? `Giving ${ai.presentation.recognizedIcon} energy. ${baseSummary}`.trim()
    : baseSummary;
```

with:

```ts
  const faceSummary = parts.face ? scrubName(ai.faceCopy.summary, iconName) : '';
  const outfitSummary = parts.outfit ? scrubName(ai.outfitCopy.verdict, iconName) : '';
  const summary = [faceSummary, outfitSummary].filter(Boolean).join(' ').trim();
```

- [ ] **Step 9: Run tests + typecheck to verify they pass**

Run: `npm test --workspace @fitaura/web -- assemble.test`
Expected: PASS (including the rewritten icon test and the new v3.4 block).
Run: `npm run typecheck`
Expected: no errors (note: `ICON_NAME_CONFIDENCE_MIN` is now unused in assemble — confirm it was removed from the import, and that it is still exported from `scoring.ts` for any other consumer).

- [ ] **Step 10: Run the full suite**

Run: `npm test --workspace @fitaura/web`
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/solo-scan/assemble.ts apps/web/src/solo-scan/assemble.test.ts
git commit -m "feat(solo-scan): use written line/caption/punchline with banked fallback; drop hardcoded celeb stamp; scrub icon name"
```

---

### Task 5: Edge function — prompt rewrite + RESPONSE_SCHEMA mirror

**Files:**
- Modify: `supabase/functions/solo-scan/gemini.ts` (RESPONSE_SCHEMA `faceCopy`/`outfitCopy`/`receiptContent`; SYSTEM_INSTRUCTION)

> No unit test — this Deno file isn't in the Vitest/tsc graph. Verification is by careful diff + the manual deploy in Task 6. The Zod schema (Task 2) is the contract of record; this step mirrors it for Gemini's structured output and updates the instructions.

- [ ] **Step 1: Mirror the three new fields in `RESPONSE_SCHEMA`**

Replace the `faceCopy` line:
```ts
    faceCopy: { type: 'OBJECT', properties: { strongestPoint: { type: 'STRING' }, improvement: { type: 'STRING' }, summary: { type: 'STRING' } }, required: ['strongestPoint', 'improvement', 'summary'] },
```
with:
```ts
    faceCopy: { type: 'OBJECT', properties: { strongestPoint: { type: 'STRING' }, improvement: { type: 'STRING' }, summary: { type: 'STRING' }, verdictLine: { type: 'OBJECT', properties: { lead: { type: 'STRING' }, punch: { type: 'STRING' } }, required: ['lead', 'punch'] } }, required: ['strongestPoint', 'improvement', 'summary', 'verdictLine'] },
```

Replace the `outfitCopy` line:
```ts
    outfitCopy: { type: 'OBJECT', properties: { works: { type: 'STRING' }, hurts: { type: 'STRING' }, verdict: { type: 'STRING' } }, required: ['works', 'hurts', 'verdict'] },
```
with:
```ts
    outfitCopy: { type: 'OBJECT', properties: { works: { type: 'STRING' }, hurts: { type: 'STRING' }, verdict: { type: 'STRING' }, captionLine: { type: 'STRING' } }, required: ['works', 'hurts', 'verdict', 'captionLine'] },
```

Replace the `receiptContent` line:
```ts
    receiptContent: { type: 'OBJECT', properties: { metricCandidates: STR_LIST, punchlineCandidates: STR_LIST }, required: ['metricCandidates', 'punchlineCandidates'] },
```
with:
```ts
    receiptContent: { type: 'OBJECT', properties: { metricCandidates: STR_LIST, punchlineCandidates: STR_LIST, punchlineText: { type: 'STRING' } }, required: ['metricCandidates', 'punchlineCandidates', 'punchlineText'] },
```

- [ ] **Step 2: Add the GROUNDED rule**

In `SYSTEM_INSTRUCTION`, immediately after the `VOICE:` line, insert a new line:

```
GROUNDED: Every copy field and display line must reference a SPECIFIC visible detail you actually observed (name the feature). Never write a generic, swappable line that could apply to any other photo.
```

- [ ] **Step 3: Add the DISPLAY LINES instructions**

After the `VARIETY:` line, insert:

```
DISPLAY LINES: Also write three SHORT, grounded display lines, each DIFFERENT from the copy fields and from each other:
- faceCopy.verdictLine: a two-part face title { lead, punch } (each ~16 chars max; punch is the highlighted half), e.g. lead "JAW DID" / punch "THE TALKING".
- outfitCopy.captionLine: one short fit line (~28 chars max).
- receiptContent.punchlineText: one short final line (~24 chars max).
Lead with the specific observed detail. These may be uppercase.
```

- [ ] **Step 4: Replace the BANNED line (expanded)**

Replace the existing `BANNED (…)` line with:

```
BANNED (never write these — they make every result identical): "Giving …", "it's giving", "… vibes", "… energy" (as a suffix), "lore", "certified", "cultural reset", "in human form", "serving", "a true …", "<X>-coded" as filler, "elevate", "in today's world", "let's dive in", "it's not just X it's Y", "a testament to", "when it comes to", "gives the vibe of", em-dash sermons, hedging, polite filler. Be sharp, plain, human and funny.
```

- [ ] **Step 5: Replace the icon instruction with the allusion rule**

Replace the sentence `Do not write the recognized icon's name into the copy; the backend decides whether to surface it.` (in the line that begins `Do not calculate the final Aura Score…`) with:

```
If you recognize the subject as a known public figure or meme character, you MAY nod to their SIGNATURE association — an epithet, catchphrase, or what they are known for (e.g. a King-of-Pop reference, or a "SUUUIII") — and vary it. NEVER write their actual name in any field; reference the persona, not the person.
```

- [ ] **Step 6: Edit the allowlists**

Replace the `faceArchetypeCandidates` NEUTRAL line with (removes plot_relevant, red_flag_good_angles, delusional):
```
  NEUTRAL: face_archetype.goat, face_archetype.mafia_boss, face_archetype.main_character, face_archetype.aura_farmer, face_archetype.locked_in, face_archetype.honorable_mention, face_archetype.chopped, face_archetype.canon_event, face_archetype.ai_slop, face_archetype.negative_aura, face_archetype.unc.
```

Replace the `faceArchetypeCandidates` FEMME line with (removes femme_fatale):
```
  FEMME: face_archetype.mother, face_archetype.it_girl, face_archetype.girlboss, face_archetype.material_girl, face_archetype.vip, face_archetype.clean_girl, face_archetype.brat, face_archetype.drama_queen.
```

Replace the `outfitCaptionCandidates` NEUTRAL line with (removes clean_npc_potential + performative, adds the 6 new):
```
  NEUTRAL: outfit_caption.locked_in, outfit_caption.let_him_cook, outfit_caption.fit_has_lore, outfit_caption.rizz, outfit_caption.plays_it_safe, outfit_caption.not_dripping, outfit_caption.shows_up, outfit_caption.not_dangerous, outfit_caption.not_remarkable, outfit_caption.room_to_grow, outfit_caption.delulu, outfit_caption.ai_slop, outfit_caption.chopped, outfit_caption.never_cook_again, outfit_caption.aura_debt.
```

Replace the `punchlineCandidates` FEMME line with (removes mother_mothered, girlboss_trio):
```
  FEMME: punchline.slay, punchline.it_girl, punchline.drama_queen_crowned.
```

- [ ] **Step 7: Bump the schemaVersion literal**

Replace `Set schemaVersion to "solo_scan_v3_3".` with:
```
Set schemaVersion to "solo_scan_v3_4".
```

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/solo-scan/gemini.ts
git commit -m "feat(solo-scan): prompt grounding + display lines + icon-allusion + v3_4 schema mirror"
```

---

### Task 6: Full verification + manual deploy

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + full test suite**

Run: `npm run typecheck`
Expected: no errors.
Run: `npm test --workspace @fitaura/web`
Expected: all suites green (copyFilter, schema, content-bank, assemble, plus the pre-existing suites unchanged).

- [ ] **Step 2: Sanity-grep for the removed stamp**

Run: `git grep -n "Giving \${" -- packages/shared`
Expected: no matches (the hardcoded celeb stamp is gone).

- [ ] **Step 3: Deploy the edge function (manual)**

The edge function does NOT deploy via git/Vercel. Deploy it with the project's documented manual command (see `docs/dev-log/` solo-scan deploy notes / the saved memory) — Supabase CLI deploy of `solo-scan` with the `.ts` import map, no Docker. After deploy, confirm the active version incremented (e.g. via the Supabase dashboard or `list_edge_functions`).

- [ ] **Step 4: Live smoke**

Run one real face scan and one face+outfit scan. Confirm:
- the schema version error rate is normal (no spike in `schema_invalid` from the new required fields),
- the card line / caption / punchline read as written-and-grounded (not banked) on a clean photo,
- a recognized celebrity/meme shows an allusion and **never** the literal name, with no `Giving … energy` line.

---

## Self-review

**Spec coverage:**
- Schema (A) → Task 2. Prompt (B) → Task 5 steps 2-7. Assembly delete-stamp + name-scrub (C) → Task 4 steps 4-8. Content bank (D) → Task 3. copyFilter (E) → Task 1. Tests (F) → Tasks 1-4. Rollout (G) → Tasks 5-6. ✔ All sections mapped.
- Icon-by-allusion-never-name: prompt rule (Task 5 step 5) + deterministic scrub/fallback (Task 1, Task 4 steps 6/8). ✔

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✔

**Type consistency:** `acceptWritten(written, maxLen, iconName)`, `scrubName(text, name)`, `isCliche(text)` are defined in Task 1 and used with the same signatures in Task 4. New schema field names (`faceCopy.verdictLine{lead,punch}`, `outfitCopy.captionLine`, `receiptContent.punchlineText`) are identical across Tasks 2, 4, 5 and the fixture. Content-bank ids added in Task 3 (`outfit_caption.plays_it_safe` … `room_to_grow`) match the allowlist additions in Task 5. ✔

**Notes for the implementer:**
- Display caps (Task 4: 18/18 line, 30 caption, 26 punchline) are intentionally tighter than the Zod caps (Task 2: 40/40/80/80) — a too-long model line falls back instead of failing the scan.
- `fit_has_lore` and `certified_lover_boy` are intentionally **kept** (not in the removal list) — they remain only as fallbacks; the AI no longer writes "lore"/"certified" because of the BANNED list + cliché filter.
