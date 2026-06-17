# Landing + Result UX Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the landing (character-face hero, tappable card fan + 2×2 breakdown, no full-breakdown wall) and the result page (two-column compact breakdown, roast on the cards), and bring all copy in line with partial scans.

**Architecture:** Frontend + copy only — no scoring/schema/edge changes. The roast is a render-time prop on the existing card components sourced from existing `analysis.*` data (so existing saved verdicts and the export get it with no redeploy). A new `CardFan` component owns the tap-to-cycle logic; a shared compact breakdown block is reused by the result page and the landing.

**Tech Stack:** React + TypeScript, Vite, plain CSS, Vitest. App lives in `apps/web`; shared types in `packages/shared`.

**Conventions:**
- Commit messages end with the trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Run `tsc`/`vitest`/`vite build` from `apps/web` (its `.env.local` feeds env; repo root throws "Missing VITE_SUPABASE_URL").
- This is visual work: most tasks verify with `npx tsc -p tsconfig.json --noEmit` (zero errors) + `npx vite build` (succeeds) + **visual QA** (run the app / screenshot). Unit tests are used where there's logic.
- Spec: `docs/superpowers/specs/2026-06-17-landing-result-ux-refresh-design.md`.
- Branch: do this on a feature branch `feat/ux-refresh` (the executor creates it); do not commit half-states to `main`.

---

## File Structure

- `apps/web/src/features/vault/modes.ts` — Solo blurb copy.
- `apps/web/src/features/vault/SoloMode.tsx` — empty-state + tile copy.
- `apps/web/src/features/scan/Scan.tsx` — reveal copy.
- `apps/web/src/features/landing/Landing.tsx` (+ `apps/web/src/design/landing.css`) — copy, remove Analysis, hero, distinct-cards section, rail/footer.
- `apps/web/src/features/landing/CardFan.tsx` *(new)* — tappable cycling fan.
- `apps/web/src/features/landing/cardFan.ts` *(new)* — pure cycle helper (unit-tested).
- `apps/web/src/data/mockGenerations.ts` — `HERO_CHARACTERS` (3 face cards) + helper for landing breakdown data.
- `apps/web/src/assets/` — `hero-mclovin.jpg`, `hero-bateman.jpg` (copied from the user's Downloads).
- `apps/web/src/components/cards/FaceCard.tsx`, `OutfitCard.tsx` (+ card CSS) — optional `roast` prop.
- `apps/web/src/components/analysis/FaceAnalysisBlock.tsx`, `OutfitAnalysisBlock.tsx`, `GymCard.tsx` (+ `result-shell.css`) — drop roast block, two-column compact breakdown.
- `apps/web/src/features/result/Result.tsx` — pass roast props.

---

## Task 1: Copy trims — scan / vault

**Files:** Modify `apps/web/src/features/vault/modes.ts`, `apps/web/src/features/vault/SoloMode.tsx`, `apps/web/src/features/scan/Scan.tsx`

- [ ] **Step 1: Solo mode blurb** — in `modes.ts`, replace the solo `blurb`:
```ts
    blurb: 'Scan a face, a fit, or both — get the cards that fit.',
```
(Leave the `friend` and `glowup` blurbs unchanged.)

- [ ] **Step 2: Vault empty state + tile** — in `SoloMode.tsx`:
  - The empty-state copy `Drop a face photo and an outfit photo. FitAura returns your full three-part verdict. First scan is free.` → `Drop a photo and get your verdict. First scan's free.`
  - `CreateTile` sublabel `1 CREDIT · FACE · OUTFIT · RECEIPT` → `1 CREDIT · ONE VERDICT`.

- [ ] **Step 3: Scan reveal copy** — in `Scan.tsx`, the reveal `<p className="sub">` ternary:
  - signed-in branch `'Three cards and one dating receipt, fresh off the press.'` → `"Your verdict's printed — fresh off the press."`
  - guest branch `'Create your free account to reveal all three cards and your dating receipt.'` → `'Create your free account to reveal your verdict.'`

- [ ] **Step 4: Verify** — from `apps/web`: `npx tsc -p tsconfig.json --noEmit` (zero errors) and `npx vitest run` (still 113 pass).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/vault/modes.ts apps/web/src/features/vault/SoloMode.tsx apps/web/src/features/scan/Scan.tsx
git commit -m "copy: trim scan/vault wording for partial scans

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Landing copy trims + partial-scan fixes

**Files:** Modify `apps/web/src/features/landing/Landing.tsx`

> Pure string edits, exactly per the spec §4 table. Make each replacement; do not touch structure yet.

- [ ] **Step 1: Apply the replacements** (find each string, replace):
  - Hero sub → `Scan yourself, a friend, or your glow-up. Get a verdict built to post.`
  - How `h2` → `From photo to <span className="hl">posted</span> in under a minute`
  - How step 01: `h: 'Upload your photos'`, `p: "A selfie, an outfit, or both — crop till it's right."`
  - How step 03: `p: 'Your cards land ready to screenshot and post.'`
  - Credits lead → `Your first verdict is free. After that, top up whenever. Friends, exes, celebrities — all fair game.`
  - Credits foot → `Credits never expire. One credit = one verdict.`
  - Privacy `<p>` → `We use your photos to build your verdict, then drop them — never stored on our servers. Your cards and history live on your device.` (drop the `<b>` inline emphasis or keep one `<b>never stored on our servers</b>`; keep the 3 `ln-privacy-points` chips.)
  - Final CTA `<p>` → `One scan, one credit, cards your group chat won't let go of. First one's free.`
  - (The Artifacts eyebrow + note are changed in Task 6 when that section is rebuilt — skip here.)

- [ ] **Step 2: Verify** — `npx tsc -p tsconfig.json --noEmit` (zero errors); `npx vite build` succeeds.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/features/landing/Landing.tsx
git commit -m "copy: trim landing wording + fix partial-scan contradictions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Roast prop on the cards (Result + export)

**Files:** Modify `apps/web/src/components/cards/FaceCard.tsx`, `apps/web/src/components/cards/OutfitCard.tsx`, `apps/web/src/components/analysis/FaceAnalysisBlock.tsx`, `apps/web/src/features/result/Result.tsx`, card CSS (`apps/web/src/design/result-shell.css` or the card stylesheet that defines `.facecard`).

- [ ] **Step 1: FaceCard roast prop** — add an optional `roast?: string` to `FaceCardProps` and render a borderless quote line inside `.fc-verdict`, after the `<h2 className="fc-line">`:
```tsx
interface FaceCardProps {
  content: FaceCardContent;
  stickerOn?: boolean;
  run?: boolean;
  roast?: string;
}
```
```tsx
      <div className="fc-verdict">
        <div className="fc-eyebrow">{content.eyebrow}</div>
        <h2 className="fc-line">
          {content.verdict[0]} <span className="hl">{content.verdict[1]}</span>
        </h2>
        {roast && <p className="fc-roast"><span className="q">&ldquo;</span>{roast}</p>}
      </div>
```

- [ ] **Step 2: OutfitCard roast prop** — read `OutfitCard.tsx`; add the same optional `roast?: string` prop and render `<p className="fc-roast">…</p>` in the card's verdict/caption area (after the caption/title line, before the stats). Reuse the `fc-roast` class.

- [ ] **Step 3: Card CSS** — add a borderless roast style (in the stylesheet that defines `.facecard`/`.fc-line`):
```css
.fc-roast { margin:8px 0 0; font:500 12px/1.4 "Hanken Grotesk",system-ui; color:var(--ink-dim);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.fc-roast .q { color:var(--accent); font-weight:800; margin-right:2px; }
```
(2-line clamp guards the fixed card height. Adjust font-size to fit your card scale during visual QA.)

- [ ] **Step 4: Pass roast on the result page** — in `Result.tsx`:
  - The visible asset: `kind === 'face'` → `<FaceCard content={faceContent!} stickerOn={false} run roast={result.face!.analysis.roast} />`; `kind === 'outfit'` → `<OutfitCard content={outfitContent!} stickerOn={false} run roast={result.outfit!.analysis.verdict} />`.
  - The offscreen export hosts (the `{exporting && …}` block): add the same `roast={…}` to the `<FaceCard>` and `<OutfitCard>` there so the export includes it.

- [ ] **Step 5: Drop the separate roast block** — in `FaceAnalysisBlock.tsx`, delete the `<div className="rs-roast">…</div>` block (the roast now lives on the card).

- [ ] **Step 6: Verify** — `npx tsc -p tsconfig.json --noEmit` (zero); `npx vitest run` (113 pass); `npx vite build` succeeds. **Visual QA:** open a result, confirm the roast shows under the verdict on the face + outfit cards, the old roast block is gone, and a card export PNG still renders the card with the roast (no overflow).

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/cards/FaceCard.tsx apps/web/src/components/cards/OutfitCard.tsx apps/web/src/components/analysis/FaceAnalysisBlock.tsx apps/web/src/features/result/Result.tsx apps/web/src/design
git commit -m "feat(result): roast as a borderless line on the face/outfit cards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Two-column compact breakdown (Result)

**Files:** Modify `apps/web/src/design/result-shell.css`, `apps/web/src/components/analysis/OutfitAnalysisBlock.tsx`, `apps/web/src/components/analysis/GymCard.tsx` (compact variant if needed).

- [ ] **Step 1: Compact the face breakdown grid** — the face `Score breakdown` already renders GymCards in `.rs-breakgrid`. In `result-shell.css`, make `.rs-breakgrid` an explicit 2-column grid and tighten `.gym-card` padding + score size for a denser look:
```css
.rs-breakgrid { display:grid; grid-template-columns:1fr 1fr; gap:11px; }
.gym-card { padding:13px 14px; }
.gym-card .gc-score .num { font-size:30px; }     /* was larger */
.gym-card .gc-bar { margin-top:9px; height:4px; }
```
(Match the compact mock; tune during visual QA. Keep the existing colors/tier behaviour.)

- [ ] **Step 2: Outfit metrics → 2-column compact blocks** — in `OutfitAnalysisBlock.tsx`, replace the `.rs-traits` list of `TraitRow`s (the main `outfit.card.scores`) with a 2-column grid of compact blocks matching the face GymCard style but blue-accented and icon-less. Add a small presentational block inline (or a shared component `StatBlock`) rendering: label, value, a tier cap via the existing `capFor`, and a bar. Example:
```tsx
        <div className="rs-breakgrid outfit">
          {outfit.card.scores.map((stat) => (
            <div className="gym-card" data-accent="blue" key={stat.id}>
              <div className="gc-top">
                <div className="gc-score"><span className="num">{stat.value}</span><span className="tier">{capFor(stat.value)}</span></div>
              </div>
              <div className="gc-name">{stat.label}</div>
              <div className="gc-bar"><i style={{ width: `${stat.value}%` }} /></div>
            </div>
          ))}
        </div>
```
Export `capFor` from `TraitRow.tsx` (or move it to a shared helper) so it can be reused. The "Supporting read" 2×2 sub-grid below is unchanged.

- [ ] **Step 3: Blue accent variant CSS** — in `result-shell.css`:
```css
.gym-card[data-accent="blue"] .gc-bar i { background:var(--accent); }
.gym-card[data-accent="blue"] .gc-score .tier { color:var(--accent); }
```

- [ ] **Step 4: Verify** — `npx tsc` (zero); `npx vitest run` (113); `npx vite build`. **Visual QA:** face + outfit breakdowns are compact 2-column grids; receipt untouched.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/design/result-shell.css apps/web/src/components/analysis/OutfitAnalysisBlock.tsx apps/web/src/components/analysis/TraitRow.tsx apps/web/src/components/analysis/GymCard.tsx
git commit -m "feat(result): two-column compact score breakdown for face + outfit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Remove the landing "Full breakdown" section

**Files:** Modify `apps/web/src/features/landing/Landing.tsx`

- [ ] **Step 1: Delete the section** — remove the entire `Analysis` function component and its `ANALYSIS_TABS` / `AnalysisTabId` definitions, and remove `<Analysis />` from the `Landing()` render tree.

- [ ] **Step 2: Rail + footer** — remove the `{ id: 'analysis', n: 2, label: 'Full analysis' }` entry from `RAIL` and renumber the remaining entries `n` sequentially; remove the `<a href="#analysis">Full analysis</a>` link from the footer Product column.

- [ ] **Step 3: Prune imports** — remove now-unused imports (`FaceAnalysisBlock`, `OutfitAnalysisBlock`, and `VERDICT_LABEL` if only the analysis used it — check usages first). Run tsc to surface unused symbols (`noUnusedLocals` is on).

- [ ] **Step 4: Verify** — `npx tsc -p tsconfig.json --noEmit` (zero errors); `npx vite build` succeeds.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/landing/Landing.tsx
git commit -m "feat(landing): remove the full-breakdown section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Hero — three character face cards

**Files:** Add `apps/web/src/assets/hero-mclovin.jpg`, `apps/web/src/assets/hero-bateman.jpg`; modify `apps/web/src/data/mockGenerations.ts`, `apps/web/src/features/landing/Landing.tsx` (+ `landing.css`).

- [ ] **Step 1: Copy the images into assets** (from the user's Downloads):
```bash
cp "/c/Users/progr/Downloads/images (1).jpg" "apps/web/src/assets/hero-mclovin.jpg"
cp "/c/Users/progr/Downloads/bab1b52fee55efe0eb9646e6d0283c8f.jpg" "apps/web/src/assets/hero-bateman.jpg"
```
(GigaChad reuses the existing `apps/web/src/assets/example-face.jpg`.)

- [ ] **Step 2: HERO_CHARACTERS mock** — in `mockGenerations.ts`, import the three images and export an array of 3 `FaceCardContent` (reuse the existing `score()` helper and `FACE_STICKER`). Example:
```ts
import gigachad from '../assets/example-face.jpg';
import mclovin from '../assets/hero-mclovin.jpg';
import bateman from '../assets/hero-bateman.jpg';
import type { FaceCardContent } from '@fitaura/shared';

export const HERO_CHARACTERS: { content: FaceCardContent; roast: string }[] = [
  { content: { imageUrl: gigachad, eyebrow: 'FACE VERDICT', verdict: ['CERTIFIED', 'GIGACHAD'], index: 'AURA INDEX 99',
      scores: [score('Aura',99), score('Haircut Match',96), score('Masculinity',98), score('Main Character',97, true)], sticker: FACE_STICKER.green_flag },
    roast: 'Built different. The jaw alone files taxes.' },
  { content: { imageUrl: bateman, eyebrow: 'FACE VERDICT', verdict: ['CERTIFIED', 'SIGMA'], index: 'AURA INDEX 93',
      scores: [score('Aura',93), score('Haircut Match',95), score('Masculinity',94), score('Main Character',90, true)], sticker: FACE_STICKER.green_flag },
    roast: 'Morning routine: 1000 crunches, then your funeral. Flawless.' },
  { content: { imageUrl: mclovin, eyebrow: 'FACE VERDICT', verdict: ['HONORABLE', 'MENTION'], index: 'AURA INDEX 84',
      scores: [score('Aura',84), score('Haircut Match',72), score('Masculinity',70), score('Main Character',95, true)], sticker: FACE_STICKER.normie },
    roast: 'One fake ID and a whole identity. Respect the hustle.' },
];
```
(Final character copy/scores are tunable; keep GigaChad first/highest.)

- [ ] **Step 3: Hero markup** — in `Landing.tsx` `Hero()`, replace the `.ln-fan-stage` children (the OutfitCard/Receipt/FaceCard fan) with three `FaceCard`s from `HERO_CHARACTERS`, fanned (GigaChad center/front, the other two tilted behind):
```tsx
        <div className="ln-fan">
          <div className="ln-fan-stage ln-faces">
            <div className="ln-fan-card left"><FaceCard content={HERO_CHARACTERS[2].content} roast={HERO_CHARACTERS[2].roast} run /></div>
            <div className="ln-fan-card right"><FaceCard content={HERO_CHARACTERS[1].content} roast={HERO_CHARACTERS[1].roast} run /></div>
            <div className="ln-fan-card mid"><FaceCard content={HERO_CHARACTERS[0].content} roast={HERO_CHARACTERS[0].roast} run /></div>
          </div>
        </div>
```
Keep the existing `.ln-fan-card left/right/mid` tilt CSS (it already fans three cards); add a `.ln-faces` qualifier only if you need face-specific sizing. Import `FaceCard` and `HERO_CHARACTERS`; drop the now-unused `OutfitCard`/`Receipt`/`HERO` imports in `Hero` if no other landing section uses them (Task 8's fan will re-introduce them — sequence accordingly, or keep the imports).

- [ ] **Step 4: Verify** — `npx tsc` (zero); `npx vite build` (confirm the 2 new images are bundled). **Visual QA:** hero shows the three character faces fanned, GigaChad front.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/assets/hero-mclovin.jpg apps/web/src/assets/hero-bateman.jpg apps/web/src/data/mockGenerations.ts apps/web/src/features/landing/Landing.tsx
git commit -m "feat(landing): character face-card hero (gigachad/mclovin/bateman)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: CardFan component + cycle logic (unit-tested)

**Files:** Create `apps/web/src/features/landing/cardFan.ts`, `apps/web/src/features/landing/cardFan.test.ts`, `apps/web/src/features/landing/CardFan.tsx`.

- [ ] **Step 1: Failing test for the cycle helper** — `cardFan.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cycleOrder } from './cardFan';

describe('cycleOrder', () => {
  it('moves the front item to the back', () => {
    expect(cycleOrder([0, 1, 2])).toEqual([1, 2, 0]);
  });
  it('is a no-op shape for a single item', () => {
    expect(cycleOrder([5])).toEqual([5]);
  });
  it('cycles fully back to start after length steps', () => {
    let o = [0, 1, 2];
    o = cycleOrder(o); o = cycleOrder(o); o = cycleOrder(o);
    expect(o).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run it to confirm failure** — `npx vitest run src/features/landing/cardFan.test.ts` → FAIL (`cycleOrder` not defined).

- [ ] **Step 3: Implement the helper** — `cardFan.ts`:
```ts
/** Move the front item to the back (the tapped card slides behind the stack). */
export function cycleOrder<T>(order: T[]): T[] {
  if (order.length <= 1) return order.slice();
  return [...order.slice(1), order[0]];
}
```

- [ ] **Step 4: Run to confirm pass** — `npx vitest run src/features/landing/cardFan.test.ts` → PASS.

- [ ] **Step 5: CardFan component** — `CardFan.tsx`: renders an array of children in a stack; front card tappable; on tap advances order via `cycleOrder` and calls `onFrontChange(index)`. Positions for up to 3:
```tsx
import { useState } from 'react';
import { cycleOrder } from './cardFan';

interface CardFanProps {
  items: React.ReactNode[];
  onFrontChange?: (frontIndex: number) => void;
}
const POSE = ['front', 'backRight', 'backLeft'];

export function CardFan({ items, onFrontChange }: CardFanProps) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const advance = () => {
    const next = cycleOrder(order);
    setOrder(next);
    onFrontChange?.(next[0]);
  };
  return (
    <div className="cardfan">
      {order.map((itemIdx, stackPos) => (
        <div
          key={itemIdx}
          className={'cardfan-item ' + (POSE[stackPos] || 'backLeft')}
          style={{ zIndex: items.length - stackPos }}
          role="button"
          tabIndex={stackPos === 0 ? 0 : -1}
          aria-hidden={stackPos !== 0}
          onClick={stackPos === 0 ? advance : undefined}
          onKeyDown={stackPos === 0 ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } } : undefined}
        >
          {items[itemIdx]}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Fan CSS** — in `landing.css`, position `.cardfan` (relative) and the `.cardfan-item` poses (`.front`/`.backRight`/`.backLeft`) with transforms (translate + rotate + scale + opacity) and a `transition` on transform/opacity; disable the transition under `@media (prefers-reduced-motion: reduce)`. Mirror the fan offsets from the approved mockup (front: rotate ~-2°, scale 1; backRight: translateX ~+30px rotate ~8° scale .86 opacity .6; backLeft: translateX ~-8px rotate ~-9° scale .82 opacity .45).

- [ ] **Step 7: Verify** — `npx vitest run` (116 pass: 113 + 3); `npx tsc` (zero); `npx vite build`.

- [ ] **Step 8: Commit**
```bash
git add apps/web/src/features/landing/cardFan.ts apps/web/src/features/landing/cardFan.test.ts apps/web/src/features/landing/CardFan.tsx apps/web/src/design/landing.css
git commit -m "feat(landing): tappable CardFan (cycle on tap) + cycle helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Distinct-cards section — fan + 2×2 synced breakdown

**Files:** Modify `apps/web/src/features/landing/Landing.tsx` (rebuild `Artifacts`), `apps/web/src/data/mockGenerations.ts` (breakdown-data helper), `apps/web/src/design/landing.css`.

- [ ] **Step 1: Breakdown data helper** — in `mockGenerations.ts`, export a function mapping the HERO mock's three cards to four `{ label, value, tag }` blocks each, for the right column:
```ts
export type FanKind = 'face' | 'outfit' | 'receipt';
export interface FanBlock { label: string; value: string; tag: string; pct: number; }
export function fanBreakdown(kind: FanKind): { eyebrow: string; title: string; blocks: FanBlock[]; cap: string } { /* return the 4 blocks per kind from HERO data, per spec §3 */ }
```
Populate from `MOCK_GENERATIONS[DEFAULT_VERDICT]` (Aura/Haircut/Masculinity/Main-char for face; Fit/Silhouette/Proportions/Physique for outfit; Dating/Lover-boy/Main-char/Ghosting for receipt). Keep it pure/data-only.

- [ ] **Step 2: Rebuild the Artifacts section** — replace the `Artifacts` component body with a two-column layout:
  - Heading: eyebrow `ONE SCAN, DISTINCT CARDS`, h2 `Distinct cards / One verdict`, note `Scan a face, a fit, or both — get the cards that fit.`
  - Left column: `<CardFan items={[<FaceCard…/>, <OutfitCard…/>, <Receipt…/>]} onFrontChange={(i) => setFront(KIND_BY_INDEX[i])} />` using the HERO mock cards.
  - Right column: render `fanBreakdown(front)` as a 2×2 grid of the compact block style (reuse the `.gym-card` markup/classes from Task 4 so landing + result match), plus the caption.
  - Hold `front` in `useState<FanKind>('face')`; `KIND_BY_INDEX = ['face','outfit','receipt']` (matches the item order passed to CardFan).

- [ ] **Step 3: Section CSS** — in `landing.css`, add a two-column grid for the section (`.ln-distinct { display:grid; grid-template-columns:.9fr 1.1fr; gap:24px; align-items:center; }`) collapsing to one column under ~640px; style the right-column 2×2 grid reusing `.rs-breakgrid`/`.gym-card` or a landing-scoped equivalent.

- [ ] **Step 4: Verify** — `npx tsc` (zero); `npx vitest run` (116); `npx vite build`. **Visual QA:** tapping the front card cycles Face→Outfit→Receipt and the right 2×2 blocks + caption update to match; section reads with the new copy; mobile stacks.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/landing/Landing.tsx apps/web/src/data/mockGenerations.ts apps/web/src/design/landing.css
git commit -m "feat(landing): distinct-cards fan + synced 2x2 breakdown

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Full verification + finish

- [ ] **Step 1: Full gate** — from `apps/web`: `npx tsc -p tsconfig.json --noEmit` (zero), `npx vitest run` (all pass), `npx vite build` (succeeds).
- [ ] **Step 2: Visual QA pass** — landing (hero faces, distinct-cards fan+breakdown, trimmed copy, no full-breakdown section, section rail correct), result (two-col breakdown, roast on cards, export PNG), vault/scan copy.
- [ ] **Step 3: Dev-log** — write `docs/dev-log/0XX-landing-result-ux-refresh.md` summarising the change, then commit.
- [ ] **Step 4: Finish** — open a PR (or merge to `main` per the user's preference) via `superpowers:finishing-a-development-branch`.

---

## Self-Review Notes

- **Spec coverage:** §1 hero (Task 6) · §2 remove breakdown (Task 5) · §3 distinct-cards fan+blocks (Tasks 7–8) · §4 landing copy (Task 2) · §5 result two-col breakdown (Task 4) · §6 roast on cards (Task 3) · §7 scan/vault copy (Task 1). ✓
- **No edge/schema change:** roast sourced from `analysis.roast`/`analysis.verdict` props (Task 3) — no `packages/shared`/edge edits. ✓
- **Type consistency:** `roast?: string` prop on FaceCard/OutfitCard; `cycleOrder`/`CardFan`/`fanBreakdown`/`FanKind` consistent across Tasks 7–8; `capFor` exported for reuse (Task 4). ✓
- **Visual tasks** verify via tsc + build + visual QA (logic unit-tested in Task 7); pixel values tuned against the approved mockups during execution.
