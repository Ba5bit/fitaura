# nFactorial Edition Skin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-result **Edition switch** that re-skins the current Solo cards (Face/Outfit/Receipt) and the FvsF share cards into the white+red **nFactorial Edition**, shown only to accounts that own `theme:company-nfactorial`.

**Architecture:** An "edition" layer above the existing per-card skin system. Solo cards are re-tinted by a scoped `[data-edition="nfactorial"]` stylesheet over the *current* `FaceCard`/`OutfitCard`/`Receipt` (no clone components) plus a small ¡n! lockup overlay. The FvsF `VerdictShareCard` is inline-styled, so it takes an `edition` prop that swaps its palette to red/charcoal and renders the lockup. A gated `<EditionSwitch>` flips a per-result `edition` state (persisted with `usePerCardState`).

**Tech Stack:** React + TypeScript, scoped CSS, Vitest. Depends on `2026-06-29-promo-entitlements-gate.md` (uses `hasEntitlement('theme:company-nfactorial')`).

This plan **refines the spec** in two places, based on reading the code:
- §4.2 (FvsF): a prop-driven palette override on `VerdictShareCard`, not a CSS overlay (the card is inline-styled).
- §4.1/D5 (Solo): re-tint the **current** `FaceCard`/`OutfitCard` (circular-selfie face, etc.) — the kit's `fc2-*` full-bleed layout is reference-only, not replicated.

---

## Spec reference
`docs/superpowers/specs/2026-06-29-nfactorial-edition-skin-design.md` §3, §4, §6, §7, §8.
Re-tint **reference** (color rules to port, not copy): `C:\Users\progr\Downloads\nfactorial-skin-kit\nfactorial.css` (esp. the `data-theme="white"` block, lines 96–137, and the readability/accent rules).

## Conventions discovered (follow these)
- Real Solo card classes (targets for the re-tint):
  - Face (`FaceCard.tsx`): `.asset.facecard`, `.fc-top` (`.brand-tag`,`.kind-tag`), `.selfie-ring`, `.fc-recticks span`, `.fc-eyebrow`, `.fc-line .hl`, `.fc-stats`, `.fc-foot`, `.barcode i`.
  - Outfit (`OutfitCard.tsx`): `.asset.outfitcard`, `.outfit-photo`, `.scrim`, `.oc-top .brand-tag`, `.score-badge .sub/.num`, `.caption-bar .cap`, `.oc-stats`, `.oc-foot`.
  - Receipt (`Receipt.tsx`): `.asset.receipt`, `.receipt-inner`, `.r-head .logo/.sub`, `.r-row .v.good`, `.r-verdict .r-stamp-big`, `.r-qrfoot`.
  - Shared MiniStat track fill reads `--verdict`/`--accent` (see `fitaura.css` `.mstat .fill`). Re-tinting `--accent`/`--verdict` under the scope recolors stats automatically.
- Design tokens live in `apps/web/src/design/fitaura.css` `:root` (`--accent`, `--accent-ink`, `--verdict`, `--cyan/--lime/--red/--magenta/--icy/--gold`, plus surface tokens `--ink`, `--ink-dim`, `--ink-faint`, `--hair`, `--hair-soft`, `--panel`, ...). The kit uses the same token vocabulary.
- Result page already mounts cards in `.rs-card-mount` with `data-paper/data-verdict/data-gender` (`Result.tsx:431`) and offscreen export copies in `.rs-export-card` (`Result.tsx:603-631`). Add `data-edition` to both.
- Existing scoped skin stylesheets are imported at the top of `Result.tsx` (`clean-skin.css`, `nameplate-skin.css`, ...). Follow that pattern.
- Per-result state uses `usePerCardState(key, initial)` keyed on the generation id (`Result.tsx:91-99`).

## Test command (exact)
- `cd "apps/web" && npx vitest run src/<path>.test.ts`
- Typecheck: `npm run typecheck --workspace @fitaura/web`

---

## File structure

**Create**
- `apps/web/src/components/cards/editions/registry.ts` — `EDITIONS`, `entitledEditions()`.
- `apps/web/src/components/cards/editions/registry.test.ts` — unit tests.
- `apps/web/src/components/cards/EditionLockup.tsx` — ¡n! co-brand overlay.
- `apps/web/src/components/EditionSwitch.tsx` — the gated Default/nFactorial control.
- `apps/web/src/design/nfactorial-skin.css` — scoped Solo re-tint.
- `apps/web/src/assets/nfactorial-logo.png` — the ¡n! mark (copied from the kit).

**Modify**
- `apps/web/src/features/result/Result.tsx` — edition state + switch + edition-aware render/export.
- `apps/web/src/features/versus/components/VerdictShareCard.tsx` — `edition` prop (red/charcoal palette + lockup).
- `apps/web/src/features/versus/VersusResult.tsx` — edition state + switch + pass edition to cards/exports.

---

## Task 1: Edition registry (TDD)

**Files:**
- Create: `apps/web/src/components/cards/editions/registry.ts`
- Test: `apps/web/src/components/cards/editions/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/components/cards/editions/registry.test.ts
import { describe, expect, it } from 'vitest';
import { EDITIONS, entitledEditions, NFACTORIAL_ENTITLEMENT } from './registry';

describe('editions registry', () => {
  it('always includes the default edition first', () => {
    expect(EDITIONS[0].id).toBe('default');
    expect(EDITIONS[0].entitlement).toBeUndefined();
  });

  it('nfactorial is gated by the company entitlement', () => {
    const nf = EDITIONS.find((e) => e.id === 'nfactorial')!;
    expect(nf.entitlement).toBe(NFACTORIAL_ENTITLEMENT);
  });

  it('entitledEditions returns default-only without the entitlement', () => {
    expect(entitledEditions([]).map((e) => e.id)).toEqual(['default']);
  });

  it('entitledEditions adds nfactorial once owned', () => {
    expect(entitledEditions([NFACTORIAL_ENTITLEMENT]).map((e) => e.id)).toEqual(['default', 'nfactorial']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

Run: `cd "apps/web" && npx vitest run src/components/cards/editions/registry.test.ts`
Expected: FAIL — cannot resolve `./registry`.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/components/cards/editions/registry.ts
export const NFACTORIAL_ENTITLEMENT = 'theme:company-nfactorial';

export type EditionId = 'default' | 'nfactorial';

export interface Edition {
  id: EditionId;
  label: string;
  /** Gate key; undefined = always available. */
  entitlement?: string;
}

export const EDITIONS: Edition[] = [
  { id: 'default', label: 'Default' },
  { id: 'nfactorial', label: 'nFactorial', entitlement: NFACTORIAL_ENTITLEMENT },
];

/** The editions a holder of `owned` entitlements may pick (default always included). */
export function entitledEditions(owned: string[]): Edition[] {
  return EDITIONS.filter((e) => !e.entitlement || owned.includes(e.entitlement));
}

/** Narrow an arbitrary string to a known EditionId, else 'default'. */
export function asEditionId(v: string | null | undefined): EditionId {
  return v === 'nfactorial' ? 'nfactorial' : 'default';
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd "apps/web" && npx vitest run src/components/cards/editions/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/cards/editions/registry.ts apps/web/src/components/cards/editions/registry.test.ts
git commit -m "feat(editions): edition registry + entitledEditions helper"
```

---

## Task 2: ¡n! logo asset + lockup overlay

**Files:**
- Create: `apps/web/src/assets/nfactorial-logo.png`
- Create: `apps/web/src/components/cards/EditionLockup.tsx`

- [ ] **Step 1: Copy the logo asset**

```bash
mkdir -p "apps/web/src/assets"
cp "/c/Users/progr/Downloads/nfactorial-skin-kit/assets/nfactorial-logo.png" "apps/web/src/assets/nfactorial-logo.png"
```

- [ ] **Step 2: Write the lockup overlay**

```tsx
// apps/web/src/components/cards/EditionLockup.tsx
import nfLogo from '../../assets/nfactorial-logo.png';

/**
 * Co-brand lockup laid over an Edition-skinned card: "FITAURA × nFACTORIAL" with
 * the ¡n! mark. Positioned by `nfactorial-skin.css` (.nf-lockup) per card kind.
 */
export function EditionLockup({ kind }: { kind: 'face' | 'outfit' | 'receipt' }) {
  return (
    <div className={'nf-lockup nf-lockup--' + kind} aria-hidden="true">
      <span className="brand">FITAURA</span>
      <span className="x">×</span>
      <img className="chip" src={nfLogo} alt="" />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck (image import)**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: no errors. (Vite ships `vite/client` types for `*.png` imports; if a "cannot find module" error appears, confirm `apps/web/src/vite-env.d.ts` references `vite/client` — it should already.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/assets/nfactorial-logo.png apps/web/src/components/cards/EditionLockup.tsx
git commit -m "feat(editions): nFactorial co-brand lockup overlay + logo asset"
```

---

## Task 3: nFactorial Solo re-tint stylesheet

**Files:**
- Create: `apps/web/src/design/nfactorial-skin.css`

This scopes everything under `[data-edition="nfactorial"]` so the Default edition is untouched. It (a) flips the card surface to nFactorial **white**, (b) remaps the accent/verdict to nFactorial **red**, and (c) positions the lockup. The starter below covers the structural overrides; **port the remaining fine rules from the kit's `nfactorial.css`** (the `data-theme="white"` block + the readability fixes), changing the kit's `.nf-stage[data-theme="white"] .asset` selectors to our `[data-edition="nfactorial"] .asset`.

- [ ] **Step 1: Write the starter stylesheet**

```css
/* nFactorial Edition — scoped re-tint of the CURRENT Solo cards. Active only
   under [data-edition="nfactorial"]; the Default edition never sees these rules.
   White surface + ¡n! red accent. Reference: nfactorial-skin-kit/nfactorial.css. */

[data-edition="nfactorial"]{
  /* the only accent the whole Edition rides on */
  --accent:#e8232a;
  --accent-ink:#ffffff;
  --verdict:#e8232a;
  /* white-edition surface + ink (verify these token names against fitaura.css
     :root; adjust if a name differs there) */
  --ink:#16181d;
  --ink-dim:rgba(22,24,29,.62);
  --ink-faint:rgba(22,24,29,.42);
  --hair:rgba(0,0,0,.12);
  --hair-soft:rgba(0,0,0,.08);
  --panel:rgba(0,0,0,.03);
}

/* ---- card surface goes light (face + outfit + receipt body) ---- */
[data-edition="nfactorial"] .asset.facecard,
[data-edition="nfactorial"] .asset.outfitcard .oc-body,
[data-edition="nfactorial"] .asset.receipt .receipt-inner{
  background:linear-gradient(180deg,#ffffff,#f6f7f9 80%);
  color:var(--ink);
}
[data-edition="nfactorial"] .asset{
  border-color:rgba(0,0,0,.10);
  box-shadow:0 34px 70px -34px rgba(20,22,28,.4), 0 6px 20px -12px rgba(20,22,28,.25);
}

/* ---- red accent on the brand/eyebrow/score + a sealing red top rule ---- */
[data-edition="nfactorial"] .brand-tag{ color:var(--accent); }
[data-edition="nfactorial"] .fc-eyebrow{ color:var(--accent); }
[data-edition="nfactorial"] .fc-line .hl{ color:var(--accent); }
[data-edition="nfactorial"] .outfit-photo::after{
  content:""; position:absolute; top:0; left:0; right:0; height:3px; z-index:5;
  background:var(--accent); box-shadow:0 0 16px -2px var(--accent);
}
[data-edition="nfactorial"] .score-badge .sub{
  background:var(--accent) !important; color:#fff !important;
}

/* ---- receipt: white paper + red rule ---- */
[data-edition="nfactorial"] .asset.receipt{ --receipt-ink:#16181d; }
[data-edition="nfactorial"] .asset.receipt .receipt-inner{ border-top:3px solid var(--accent); }
[data-edition="nfactorial"] .asset.receipt .r-head .logo,
[data-edition="nfactorial"] .asset.receipt .r-verdict .r-stamp-big{ color:#16181d; }
[data-edition="nfactorial"] .asset.receipt .r-row .v.good{ color:#1f9b54; }

/* ---- co-brand lockup placement (markup from <EditionLockup/>) ---- */
[data-edition="nfactorial"] .nf-lockup{
  position:absolute; z-index:6; display:flex; align-items:center; gap:8px;
  font-family:"Space Mono",monospace; font-weight:700; font-size:11px;
  letter-spacing:0.14em; text-transform:uppercase;
}
[data-edition="nfactorial"] .nf-lockup .x{ color:rgba(0,0,0,.4); }
[data-edition="nfactorial"] .nf-lockup .chip{ width:26px; height:26px; border-radius:50%;
  box-shadow:0 0 0 1px rgba(0,0,0,.15), 0 6px 16px -6px rgba(232,35,42,.7); }
[data-edition="nfactorial"] .nf-lockup--face,
[data-edition="nfactorial"] .nf-lockup--receipt{ top:14px; left:16px; color:var(--ink); }
/* on the photo-led outfit card the lockup sits over the image → keep it white */
[data-edition="nfactorial"] .nf-lockup--outfit{ top:14px; left:16px; color:#fff;
  text-shadow:0 1px 10px rgba(0,0,0,.7); }
[data-edition="nfactorial"] .nf-lockup--outfit .x{ color:rgba(255,255,255,.6); }
```

- [ ] **Step 2: Import it in `Result.tsx`**

Add to the design-import block (after `nameplate-skin.css`, `Result.tsx:31`):

```ts
import '../../design/nfactorial-skin.css';
```

- [ ] **Step 3: Commit** (visual wiring happens in Task 5; this just lands the stylesheet)

```bash
git add apps/web/src/design/nfactorial-skin.css apps/web/src/features/result/Result.tsx
git commit -m "feat(editions): nFactorial Solo re-tint stylesheet"
```

---

## Task 4: EditionSwitch component (gated)

**Files:**
- Create: `apps/web/src/components/EditionSwitch.tsx`

- [ ] **Step 1: Write the switch**

```tsx
// apps/web/src/components/EditionSwitch.tsx
import { useAccount } from '../features/account/AccountContext';
import { entitledEditions, asEditionId, type EditionId } from './cards/editions/registry';

/**
 * "Edition · Default | nFactorial" segmented control. Renders nothing unless the
 * account is entitled to at least one non-default edition — so by default the
 * result pages look exactly as before (spec D9: no locked teasers).
 */
export function EditionSwitch({ value, onChange }: { value: EditionId; onChange: (id: EditionId) => void }) {
  const { entitlements } = useAccount();
  const options = entitledEditions(entitlements);
  if (options.length < 2) return null;
  return (
    <div className="rs-seg edition-seg" role="tablist" aria-label="Card edition">
      {options.map((e) => (
        <button
          key={e.id}
          role="tab"
          aria-selected={value === e.id}
          onClick={() => onChange(asEditionId(e.id))}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck --workspace @fitaura/web
git add apps/web/src/components/EditionSwitch.tsx
git commit -m "feat(editions): gated EditionSwitch control"
```

> Reuses the existing `.rs-seg` segmented-control styles (used by the receipt paper bar). `.edition-seg` is a hook for any spacing tweak.

---

## Task 5: Wire the Edition into the Solo result

**Files:**
- Modify: `apps/web/src/features/result/Result.tsx`

- [ ] **Step 1: Imports + edition state**

Add imports near the other card imports (after `Result.tsx:8`):

```ts
import { EditionSwitch } from '../../components/EditionSwitch';
import { EditionLockup } from '../../components/cards/EditionLockup';
import { asEditionId, type EditionId } from '../../components/cards/editions/registry';
```

After the `outfitSkin` per-card state (`Result.tsx:99`) add:

```ts
  const [edition, setEditionRaw] = usePerCardState<EditionId>(fxKey ? `${fxKey}.edition` : null, 'default');
  const setEdition = (id: EditionId) => setEditionRaw(asEditionId(id));
  const nf = edition === 'nfactorial';
```

- [ ] **Step 2: Tag the card mount + export host with the edition**

Change the card mount (`Result.tsx:431`) to add `data-edition`:

```tsx
              <div className="rs-card-mount" data-paper={paper} data-verdict={result.verdict} data-gender={gender} data-edition={edition}>
```

Change the export host wrapper (`Result.tsx:604`) to add it too, so downloads match:

```tsx
      <div className="rs-exporthost" aria-hidden="true" ref={exportHostRef} data-edition={edition}>
```

- [ ] **Step 3: Render the lockup on the active card when the Edition is on**

Inside the visible `assetEl` mount, the lockup overlays the front card. Simplest: render it right after the `CardSwitcher`/`assetEl` within `.rs-card-mount`. Add, immediately after the closing of the `kind === 'receipt' ? (...) : (<CardSwitcher .../>)` block (just before the closing `</div>` of `.rs-card-mount`, `Result.tsx:457`):

```tsx
                {nf && <EditionLockup kind={kind} />}
```

And in the export host, add a lockup to each exported card wrapper (after each `<FaceSkinComp .../>` etc. inside `.rs-export-card`):

```tsx
          {nf && <EditionLockup kind="face" />}
```
```tsx
          {nf && <EditionLockup kind="outfit" />}
```
```tsx
          {nf && <EditionLockup kind="receipt" />}
```

- [ ] **Step 4: Hide the per-card dots + paper bar while the Edition is on**

The Edition owns the look, so the per-card skin dots (`Result.tsx:462`) and the receipt paper segment (`Result.tsx:483`) should not compete. Change the dots guard:

```tsx
          {!nf && kind !== 'receipt' && skinsFor(kind).length > 1 && (
```

And the receipt controlbar's Paper segment — wrap the `<div className="rs-seg">…</div>` (`Result.tsx:486-499`) so it only shows when `!nf` (leave Stamp/Reposition controls available):

```tsx
              {!nf && (
                <div className="rs-seg">
                  {/* …existing four paper buttons unchanged… */}
                </div>
              )}
```

- [ ] **Step 5: Place the EditionSwitch**

Add it just above the per-asset export actions (before `Result.tsx:562` `{!editing && (<div className="rs-assetactions">`):

```tsx
          {!editing && (
            <div className="rs-editionbar">
              <span className="rs-cb-label">Edition</span>
              <EditionSwitch value={edition} onChange={setEdition} />
            </div>
          )}
```

(The switch self-hides when the account isn't entitled, so this row collapses to just the label for unentitled users — to fully hide the row, gate the whole block on a `useAccount().hasEntitlement(NFACTORIAL_ENTITLEMENT)` check; import `NFACTORIAL_ENTITLEMENT` and wrap: `{!editing && hasEntitlement(NFACTORIAL_ENTITLEMENT) && (…)}`.)

- [ ] **Step 6: Typecheck + manual check**

Run: `npm run typecheck --workspace @fitaura/web`
Then run the app (`npm run dev --workspace @fitaura/web`), open a result as an **entitled** account (grant via Plan 1's `/unlock/NFACTORIAL2026`, or temporarily hardcode `entitlements` in dev), toggle the Edition, and confirm: face/outfit/receipt go white+red with the ¡n! lockup; toggling back restores the default exactly; Download produces the skinned PNG.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/result/Result.tsx
git commit -m "feat(editions): nFactorial Edition switch + skin on the Solo result"
```

---

## Task 6: `edition` prop on VerdictShareCard (FvsF cards)

**Files:**
- Modify: `apps/web/src/features/versus/components/VerdictShareCard.tsx`

The card is inline-styled, so we re-tint by overriding the palette + adding the lockup. Winner→nFactorial red, loser→charcoal (spec D6).

- [ ] **Step 1: Add the prop + palette override**

In `VerdictShareCardProps` (after `colB: string;`, line 61) add:

```ts
  /** Active edition; 'nfactorial' recolors winner→red / loser→charcoal + lockup. */
  edition?: 'default' | 'nfactorial';
```

At the top of `VerdictShareCard` (after `const s = useShare(props);`, line 155), derive effective colors. Because the card reads `colA`/`colB` (per side) AND `s.winRim`/`s.loseRim` (per outcome), override at the per-side level so both stay consistent:

```ts
  const NF_RED = '#e8232a';
  const NF_CHARCOAL = '#3a3a40';
  const nf = props.edition === 'nfactorial';
  // Winner side = red, other = charcoal (ties → both charcoal). Keep A/B mapping.
  const colA = nf ? (s.winner === 'a' ? NF_RED : NF_CHARCOAL) : props.colA;
  const colB = nf ? (s.winner === 'b' ? NF_RED : NF_CHARCOAL) : props.colB;
```

Then change the destructure on line 154 to stop pulling `colA, colB` from props (they're shadowed above):

```ts
  const { view, kind, names, cardRef } = props;
```

`useShare` also needs the effective colors. Change the `useShare(props)` call to pass the overrides:

```ts
  const s = useShare({ ...props, colA: nf ? (props.group.winner === 'a' ? NF_RED : NF_CHARCOAL) : props.colA, colB: nf ? (props.group.winner === 'b' ? NF_RED : NF_CHARCOAL) : props.colB });
```

> Note: define `NF_RED`/`NF_CHARCOAL`/`nf` as module-level consts above the component so both the `useShare` call and the body can use them; move the three `const NF_* / nf` lines to module scope (above `useShare`) to avoid the ordering issue. The per-side `colA`/`colB` locals stay inside the component.

- [ ] **Step 2: Render the co-brand lockup**

In `TopChrome` (line 125), append the ¡n! mark next to the FITAURA wordmark when nfactorial. Simplest: pass an `nf` flag to `TopChrome` and render "× nFACTORIAL" text (avoid importing the PNG into this inline-styled file to keep the export simple):

```tsx
function TopChrome({ label, nf }: { label: string; nf?: boolean }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 16px', pointerEvents: 'none' }}>
      <span style={{ fontWeight: 800, letterSpacing: '0.3em', fontSize: 9.5, textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 8px #000' }}>
        FITAURA{nf && <span style={{ color: '#e8232a' }}> × nFACTORIAL</span>}
      </span>
      <span style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', textShadow: '0 1px 8px #000' }}>{label}</span>
    </div>
  );
}
```

Then update each `<TopChrome label=… />` call site (4 of them) to pass `nf={nf}`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: no errors. (Existing call sites that don't pass `edition` default to `'default'` → unchanged behavior.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/versus/components/VerdictShareCard.tsx
git commit -m "feat(editions): nFactorial palette + co-brand on the FvsF share card"
```

---

## Task 7: Wire the Edition into the FvsF result

**Files:**
- Modify: `apps/web/src/features/versus/VersusResult.tsx`

- [ ] **Step 1: Imports + edition state**

Add imports (after `VersusResult.tsx:32`):

```ts
import { EditionSwitch } from '../../components/EditionSwitch';
import { asEditionId, type EditionId } from '../../components/cards/editions/registry';
import { usePerCardState } from '../../state/usePerCardState';
```

In `VersusResult()` (after `const names = battleNames(battle);`, ~line 459) add per-battle edition state. Use the battle's stored identity for the key (the battle object has saved imgs/palette; use a stable id — `battle.id` if present, else fall back to the names hash already used for palette):

```ts
  const battleKey = battle ? `fitaura.battlefx.${(battle as { id?: string }).id ?? `${names.a}|${names.b}`}` : null;
  const [edition, setEditionRaw] = usePerCardState<EditionId>(battleKey ? `${battleKey}.edition` : null, 'default');
  const setEdition = (id: EditionId) => setEditionRaw(asEditionId(id));
```

- [ ] **Step 2: Pass `edition` to every VerdictShareCard**

There are several render sites (offscreen export copy + fan deck front/back + mobile offscreen). Add `edition={edition}` to each `<VerdictShareCard … />`:
- `VerdictTab` offscreen copy (`VersusResult.tsx:393`)
- `VerdictTab` fan deck cards (`VersusResult.tsx:410`)
- mobile offscreen card (`VersusResult.tsx:669`)

`VerdictTab` is a child component, so thread `edition` through its props:

```ts
// add to VerdictTab's prop type and destructure
  edition: EditionId;
```
```tsx
// at the VerdictTab call site (VersusResult.tsx:663)
        <VerdictTab battle={battle} names={names} verdict={verdict} copy={copy} palette={palette} onRematch={rematch} edition={edition} />
```

- [ ] **Step 3: Place the EditionSwitch**

In the verdict `vs-stack` column, under the stack dots (after the dots block, `VersusResult.tsx:420`), add:

```tsx
        <EditionSwitch value={edition} onChange={setEdition} />
```

(Thread `edition`/`setEdition` into `VerdictTab` props the same way, or render the switch in the main `VersusResult` near the share deck. Keep it on the verdict tab where the share card lives.)

- [ ] **Step 4: Typecheck + manual check**

Run: `npm run typecheck --workspace @fitaura/web`
Then run the app, open a FvsF verdict as an entitled account, toggle the Edition, and confirm: the share card's winner accent goes nFactorial red / loser charcoal, the "× nFACTORIAL" co-brand shows, the rest of the versus page is unchanged, and Download/Share emit the re-tinted card.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/versus/VersusResult.tsx
git commit -m "feat(editions): nFactorial Edition switch + skin on the FvsF result"
```

---

## Task 8: Visual QA + dev-log

- [ ] **Step 1:** Compare the live nFactorial Solo cards against the kit reference (`Fitaura nFactorial Edition.html`). Tune `nfactorial-skin.css` until the white surface + red accent read right (port any missing readability rules from the kit's `nfactorial.css`). Commit tuning as `style(editions): nFactorial re-tint polish`.
- [ ] **Step 2:** Verify export parity on BOTH pages: the downloaded PNG matches the on-screen Edition (Solo face/outfit/receipt; FvsF verdict/stats). Watch the snapdom + StrictMode export gotchas noted for FvsF.
- [ ] **Step 3:** Confirm an **unentitled** account sees NO Edition switch and the default result is byte-for-byte unchanged.
- [ ] **Step 4:** Run full web tests + typecheck: `npm run test --workspace @fitaura/web && npm run typecheck --workspace @fitaura/web`.
- [ ] **Step 5:** Write a dev-log under `docs/dev-log/` (per team convention) covering the Edition layer, the FvsF prop approach, and the export-parity check.

---

## Self-review

**Spec coverage (spec §3/§4/§6/§7/§8):**
- D3/D4 one Edition switch, separate from per-card dots → Task 1 (registry) + Task 4 (switch) + Task 5 step 4 (dots hidden when on). ✓
- D5 re-tint current cards, Dossier base → Task 3 targets the real `FaceCard`/`OutfitCard`/`Receipt` classes. ✓
- §4.1 Solo face+outfit+receipt together + lockup + paper bar hidden → Task 5. ✓
- §4.2/D6 FvsF share cards only, winner=red/other=charcoal, lockup → Task 6 + Task 7; rest of versus page untouched. ✓
- D9 switch hidden unless entitled → `EditionSwitch` returns null when `entitledEditions(entitlements).length < 2`. ✓
- D10 per-result persistence → `usePerCardState` keys in Tasks 5 + 7. ✓
- §6 export parity → `data-edition` on the export host (Task 5 step 2) + `edition` prop on the FvsF export copies (Task 7 step 2). ✓

**Placeholder scan:** The CSS in Task 3 is an explicit *starter* with a named source to port the remaining rules from (the kit's `nfactorial.css`) — not a vague "style it nicely". Visual tuning is its own task (Task 8) because a re-tint is inherently iterated in-browser. No "TBD"/"handle edge cases".

**Type consistency:** `EditionId`, `asEditionId`, `entitledEditions`, `NFACTORIAL_ENTITLEMENT` are defined in Task 1 and used identically in Tasks 4/5/7. `edition?: 'default' | 'nfactorial'` on `VerdictShareCardProps` matches `EditionId`.

**Executor note:** Line numbers reference plan-time positions; if shifted, match on the quoted anchor text. The `useShare`/`colA`/`colB` shadowing in Task 6 is the fiddliest step — keep `NF_RED`/`NF_CHARCOAL`/`nf` at module scope and verify the four `TopChrome` call sites all pass `nf`.
