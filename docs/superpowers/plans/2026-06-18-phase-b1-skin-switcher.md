# Phase B1 — Skin Registry + Card-Stack Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a per-kind **skin registry** and a landing-style **card-stack switcher** on the Result page — with the current card as the only skin (`dossier`), so the plumbing (switching, persistence, per-skin export) lands with **zero visual change**, ready for Clean/Lore skins in B2/B3.

**Architecture:** A skin is `{ id, name, Comp }` where `Comp` renders one kind's card for one skin and accepts a uniform `SkinProps`. `CardSwitcher` renders the kind's skins as a stack: the **front** skin is the live, full-size, editable, exportable card (it hosts the sticker overlay); **peeking** skins sit behind, dimmed/offset, non-interactive (previews). Selection persists per `{generationId, kind}` via the existing `usePerCardState`. With a single skin the switcher renders only the front (no peeking cards, no dots) — pixel-identical to today.

**Tech Stack:** TypeScript, React 18, CSS transforms (stack poses), Vitest. Reuses `usePerCardState` for persistence; stack ordering is computed inline (active skin first).

**Scope note:** Phase B step 1 of `docs/superpowers/specs/2026-06-18-gender-skins-card-stack-design.md` (§5.3, §5.5). Frontend-only, no edge redeploy. B2 (Clean) + B3 (Lore) are separate plans that add entries to the registry built here.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/components/cards/skins/types.ts` | `SkinProps`, `CardSkin`, `SkinId` | Create |
| `apps/web/src/components/cards/skins/DossierFace.tsx` | Dossier face skin (wraps `FaceCard`) | Create |
| `apps/web/src/components/cards/skins/DossierOutfit.tsx` | Dossier outfit skin (wraps `OutfitCard`) | Create |
| `apps/web/src/components/cards/skins/registry.ts` | `CARD_SKINS` per-kind registry + `skinsFor`/`skinIndex` helpers | Create |
| `apps/web/src/components/cards/skins/registry.test.ts` | Registry helper tests | Create |
| `apps/web/src/components/cards/CardSwitcher.tsx` | Stack layout + switch + persist | Create |
| `apps/web/src/design/card-switcher.css` | Stack poses + dots | Create |
| `apps/web/src/features/result/Result.tsx` | Render `CardSwitcher` in the mount; export selected skin | Modify |

---

## Task 1: Skin contract + registry (Dossier only)

**Files:**
- Create: `apps/web/src/components/cards/skins/types.ts`
- Create: `apps/web/src/components/cards/skins/DossierFace.tsx`, `DossierOutfit.tsx`
- Create: `apps/web/src/components/cards/skins/registry.ts`
- Test: `apps/web/src/components/cards/skins/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/cards/skins/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CARD_SKINS, skinsFor, skinIndex } from './registry';

describe('card skin registry', () => {
  it('exposes a dossier skin for face and outfit', () => {
    expect(skinsFor('face').map((s) => s.id)).toEqual(['dossier']);
    expect(skinsFor('outfit').map((s) => s.id)).toEqual(['dossier']);
    expect(CARD_SKINS.face[0].Comp).toBeTypeOf('function');
  });

  it('skinIndex finds a skin by id and clamps unknown ids to 0', () => {
    expect(skinIndex('face', 'dossier')).toBe(0);
    expect(skinIndex('face', 'nope')).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace @fitaura/web -- skins/registry`
Expected: FAIL — module not found.

- [ ] **Step 3: Define the skin contract**

Create `apps/web/src/components/cards/skins/types.ts`:

```tsx
import type { FaceCardContent, OutfitCardContent, StickerData } from '@fitaura/shared';

export type SkinKind = 'face' | 'outfit';

/** Uniform props every card skin accepts, so skins are interchangeable. */
export interface SkinProps {
  content: FaceCardContent | OutfitCardContent;
  gender: 'femme' | 'masc';
  /** Built-in sticker visibility (the editable overlay renders the real one). */
  stickerOn: boolean;
  /** Entrance animation on the active (front) card only. */
  run: boolean;
  /** One-line roast shown under the verdict. */
  roast?: string;
  /** Dimmed, non-interactive peeking card in the stack. */
  preview?: boolean;
  /** The currently selected sticker preset (skins may render a default badge;
   * the Dossier skin ignores it — the Result page overlays the editable one). */
  sticker?: StickerData;
}

export interface CardSkin {
  id: string;
  name: string;
  Comp: React.FC<SkinProps>;
}
```

- [ ] **Step 4: Dossier skins (wrap the current cards)**

Create `apps/web/src/components/cards/skins/DossierFace.tsx`:

```tsx
import type { FaceCardContent } from '@fitaura/shared';
import { FaceCard } from '../FaceCard';
import type { SkinProps } from './types';

/** The current framed "dossier" face card, adapted to the skin contract. */
export function DossierFace({ content, stickerOn, run, roast }: SkinProps) {
  return <FaceCard content={content as FaceCardContent} stickerOn={stickerOn} run={run} roast={roast} />;
}
```

Create `apps/web/src/components/cards/skins/DossierOutfit.tsx`:

```tsx
import type { OutfitCardContent } from '@fitaura/shared';
import { OutfitCard } from '../OutfitCard';
import type { SkinProps } from './types';

/** The current framed "dossier" outfit card, adapted to the skin contract. */
export function DossierOutfit({ content, stickerOn, run, roast }: SkinProps) {
  return <OutfitCard content={content as OutfitCardContent} stickerOn={stickerOn} run={run} roast={roast} />;
}
```

- [ ] **Step 5: The registry + helpers**

Create `apps/web/src/components/cards/skins/registry.ts`:

```tsx
import type { CardSkin, SkinKind } from './types';
import { DossierFace } from './DossierFace';
import { DossierOutfit } from './DossierOutfit';

export const CARD_SKINS: Record<SkinKind, CardSkin[]> = {
  face: [{ id: 'dossier', name: 'Dossier', Comp: DossierFace }],
  outfit: [{ id: 'dossier', name: 'Dossier', Comp: DossierOutfit }],
};

export function skinsFor(kind: SkinKind): CardSkin[] {
  return CARD_SKINS[kind];
}

/** Index of `skinId` in the kind's list, or 0 (the default) if not found. */
export function skinIndex(kind: SkinKind, skinId: string): number {
  const i = CARD_SKINS[kind].findIndex((s) => s.id === skinId);
  return i < 0 ? 0 : i;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test --workspace @fitaura/web -- skins/registry`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/cards/skins/
git commit -m "feat(skins): skin contract + registry with the dossier skin"
```

---

## Task 2: CardSwitcher component + stack CSS

**Files:**
- Create: `apps/web/src/components/cards/CardSwitcher.tsx`
- Create: `apps/web/src/design/card-switcher.css`

The switcher renders the kind's skins as a stack. The **front** skin is rendered live (it receives the real overlay via `children`); peeking skins render with `preview`. With one skin it renders just the front and no dots.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/cards/CardSwitcher.tsx`:

```tsx
import { skinsFor, skinIndex } from './skins/registry';
import type { SkinKind, SkinProps } from './skins/types';

const POSE = ['front', 'backRight', 'backLeft'];

interface CardSwitcherProps {
  kind: SkinKind;
  /** Selected skin id (persisted by the parent). */
  skinId: string;
  setSkinId: (id: string) => void;
  /** Props passed to every skin (front gets run=true; peeks get preview=true). */
  skinProps: Omit<SkinProps, 'preview' | 'run'>;
  /** Overlay (sticker editor) rendered on top of the FRONT skin only. */
  overlay?: React.ReactNode;
  /** Disable switching (e.g. while editing a sticker). */
  locked?: boolean;
}

/**
 * Card-stack skin switcher. The front skin is the live, full-size, editable card
 * (the parent's overlay rides on it); peeking skins are dimmed previews. Tapping a
 * peeking card or a dot brings that skin to the front. With one skin it renders
 * only the front and no dots — visually identical to a plain card.
 */
export function CardSwitcher({ kind, skinId, setSkinId, skinProps, overlay, locked }: CardSwitcherProps) {
  const skins = skinsFor(kind);
  const active = skinIndex(kind, skinId);
  // Order the skins so the active one is first (front), preserving relative order.
  const order = [active, ...skins.map((_, i) => i).filter((i) => i !== active)];
  const n = skins.length;

  const select = (i: number) => { if (!locked) setSkinId(skins[i].id); };

  return (
    <div className="cs-switch">
      <div className="cs-deck">
        {order.map((skinIdx, stackPos) => {
          const skin = skins[skinIdx];
          const Comp = skin.Comp;
          const isFront = stackPos === 0;
          return (
            <div
              key={skin.id}
              className={'cs-card ' + (POSE[stackPos] || 'backLeft') + (isFront ? ' front-live' : '')}
              style={{ zIndex: n - stackPos }}
              aria-hidden={!isFront}
              role={isFront ? undefined : 'button'}
              aria-label={isFront ? undefined : `Switch to ${skin.name}`}
              onClick={isFront ? undefined : () => select(skinIdx)}
            >
              <Comp {...skinProps} run={isFront} preview={!isFront} />
              {isFront && overlay}
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="cs-dots" role="tablist" aria-label="Card skin">
          {skins.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={s.name}
              className={'cs-dot' + (i === active ? ' on' : '')}
              onClick={() => select(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

> Note: keep `next` only if a swipe/arrow control is added later; for B1 dots + tap are enough. If `next` is unused, delete it to satisfy `noUnusedLocals` (the verify step will flag it).

- [ ] **Step 2: Create the stack CSS**

Create `apps/web/src/design/card-switcher.css`:

```css
/* ============================================================
   CARD-STACK SKIN SWITCHER. The front card is full-size + live
   (no scale-down — it carries the sticker editor + export);
   peeking skins sit behind, scaled + offset + dimmed. With one
   skin only `.front` renders, so this is a no-op visually.
   ============================================================ */
.cs-switch { position: relative; width: 360px; }
.cs-deck { position: relative; width: 360px; height: 640px; }
.cs-card {
  position: absolute; inset: 0; width: 360px; height: 640px;
  transition: transform .42s cubic-bezier(.22,1,.36,1), opacity .3s ease;
  transform-origin: 50% 60%;
}
.cs-card.front-live { transform: none; z-index: 5; }
.cs-card.backRight { transform: translateX(34px) translateY(10px) rotate(5deg) scale(.9); opacity: .5; filter: saturate(.7); cursor: pointer; }
.cs-card.backLeft  { transform: translateX(-34px) translateY(10px) rotate(-5deg) scale(.9); opacity: .42; filter: saturate(.7); cursor: pointer; }
/* peeking cards must not capture sticker drags meant for the front card */
.cs-card:not(.front-live) :is(image-slot, .sticker, button) { pointer-events: none; }

.cs-dots { display: flex; justify-content: center; gap: 9px; margin-top: 14px; }
.cs-dot {
  width: 9px; height: 9px; padding: 0; border: 0; border-radius: 50%; cursor: pointer;
  background: var(--ink-ghost); transition: background .2s, transform .2s;
}
.cs-dot:hover { background: var(--ink-faint); }
.cs-dot.on { background: var(--accent); box-shadow: 0 0 10px -2px var(--accent); transform: scale(1.2); }

@media (prefers-reduced-motion: reduce) { .cs-card { transition: none; } }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: PASS (or a `noUnusedLocals` error on `next` — if so, delete the `next` function and re-run).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/cards/CardSwitcher.tsx apps/web/src/design/card-switcher.css
git commit -m "feat(cards): CardSwitcher stack component + poses (front-live, peeking previews)"
```

---

## Task 3: Integrate the switcher into the Result page

**Files:**
- Modify: `apps/web/src/features/result/Result.tsx`

Replace the single front card in the mount with `CardSwitcher` for `face`/`outfit` (receipt keeps its current render). Persist the selected skin per generation+kind; export the selected skin (B1 has one skin, so this is plumbing).

- [ ] **Step 1: Imports + persisted skin state**

Add imports near the other card imports:

```ts
import { CardSwitcher } from '../../components/cards/CardSwitcher';
import '../../design/card-switcher.css';
```

After the existing `pos`/`stk` `usePerCardState` hooks, add per-kind skin selection (keyed by the same `fxKey`):

```ts
  const [faceSkin, setFaceSkin] = usePerCardState<string>(fxKey ? `${fxKey}.skin.face` : null, 'dossier');
  const [outfitSkin, setOutfitSkin] = usePerCardState<string>(fxKey ? `${fxKey}.skin.outfit` : null, 'dossier');
```

- [ ] **Step 2: Render CardSwitcher for face/outfit in the mount**

The mount currently renders `{assetEl}{overlayEl}`. For face/outfit, wrap the live card in `CardSwitcher` (front-live = the skin, overlay = the sticker editor). Keep receipt as-is. Replace the `{assetEl}{overlayEl}` lines (inside `.rs-card-mount`) with:

```tsx
                {kind === 'receipt' ? (
                  <>
                    {assetEl}
                    {overlayEl}
                  </>
                ) : (
                  <CardSwitcher
                    kind={kind}
                    skinId={kind === 'face' ? faceSkin : outfitSkin}
                    setSkinId={kind === 'face' ? setFaceSkin : setOutfitSkin}
                    locked={editing}
                    skinProps={{
                      content: (kind === 'face' ? faceContent : outfitContent)!,
                      gender,
                      stickerOn: false,
                      roast: kind === 'face' ? result.face!.analysis.roast : result.outfit!.analysis.verdict,
                    }}
                    overlay={overlayEl}
                  />
                )}
```

> `assetEl`/`overlayEl` are still defined above; for face/outfit `assetEl` is now unused directly (the switcher renders the skin) but `overlayEl` is passed in. To avoid an unused-var error, keep using `assetEl` only in the receipt branch (above) — it is still referenced there, so no error.

- [ ] **Step 3: Export the selected skin**

The offscreen export host renders the full card per kind. For B1 the only skin is Dossier (= the current `FaceCard`/`OutfitCard`), so the existing export host already renders the right thing — **no change needed** for B1. (B2 will make the export host pick the active skin's component.) Add a code comment in the export host noting this so B2 knows where to branch:

```tsx
        {/* B1: only the dossier skin exists, so the export host renders it directly.
            B2+ will select the active skin's component here (faceSkin/outfitSkin). */}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck`
Expected: PASS.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/result/Result.tsx
git commit -m "feat(result): render face/outfit through CardSwitcher (dossier-only)"
```

---

## Task 4: Verify the switcher works (temporary 2nd skin)

**Files:** none committed — a temporary local check.

- [ ] **Step 1: Temporarily add a second face skin** to `registry.ts` to prove switching:

```tsx
  face: [
    { id: 'dossier', name: 'Dossier', Comp: DossierFace },
    { id: 'dossier2', name: 'Dossier 2', Comp: DossierFace },
  ],
```

- [ ] **Step 2: `npm run dev`**, open a face result. Confirm: two dots appear, a dimmed peeking card sits behind, tapping the peek or a dot **switches the front**, the front card is full-size and the sticker editor still works on it, and switching is disabled while editing. Switch tab to receipt and back — selection persists; reopen from the vault — selection persists.

- [ ] **Step 3: Revert the temporary skin** (restore `registry.ts` to dossier-only). Run `npm run test --workspace @fitaura/web` (all green) and `npm run build`.

- [ ] **Step 4: Push (frontend-only; no edge redeploy)**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage (B1 infra):**
- Skin registry per kind (§5.3) — Task 1. ✓
- Card-stack switcher, front-live + peeking previews, dots, switch disabled while editing (§5.5) — Task 2-3. ✓
- Selected skin persists per generation+kind (reuses `usePerCardState`) — Task 3. ✓
- Zero visual change with one skin; export unaffected (Dossier = current card) — Task 3-4. ✓
- (Deferred to B2/B3: Clean + Lore skins, per-skin sticker geometry, export host skin selection.)

**Placeholder scan:** No TBD/TODO. The temporary 2nd skin (Task 4) is an explicit, reverted verification step, not a code gap.

**Type consistency:** `SkinKind` = `'face' | 'outfit'`, `SkinProps`, `CardSkin` defined in Task 1 and consumed by `CardSwitcher` (Task 2) + Result (Task 3). `skinsFor`/`skinIndex` signatures match their tests. `usePerCardState<string>` mirrors the existing `stk`/`pos` usage.

**Risk note:** This refactors the most-edited part of `Result.tsx` (the card mount), intertwined with the `--rs-scale` auto-fit, the sticker overlay, the swipe-to-change-tab gesture, and the export host. Recommend subagent-driven execution with the spec/quality review gates, and the Task 4 manual check before pushing.
