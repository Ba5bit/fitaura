# Premium QR Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third receipt "paper" — a Premium holo *verified pass* carrying a **real, scannable QR code** to `https://fitaura.studio/` — alongside the existing Dark Neon and Thermal receipts.

**Architecture:** A small `qrMatrix` helper (backed by the tiny `qrcode-generator` lib) turns a URL into a boolean module grid; a `QrCode` component renders that grid as a scalable inline SVG (snapdom-safe for WYSIWYG export). A new `ReceiptPremium` component rebuilds the prototype's holo "pass" layout in the existing system CSS tokens and renders the real QR. `ReceiptPaper` gains `'premium'`; the Result page's paper control, visible asset, and export host branch to `ReceiptPremium` when `paper === 'premium'` (the movable stamp overlay is suppressed there — Premium carries its own seal/QR).

**Tech Stack:** TypeScript, React 18, Vite, Vitest, inline SVG, `qrcode-generator` (~5 KB, no deps). Export rasterizes via snapdom (already in use). Tests run with `npm run test --workspace @fitaura/web`.

**Scope note:** Phase A part 2 of `docs/superpowers/specs/2026-06-18-gender-skins-card-stack-design.md`. Independent of Phase A pt1 (already shipped) and Phase B (skins + switcher — separate plan). This is a **frontend-only** change — no edge-function redeploy.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/package.json` | Add `qrcode-generator` dep | Modify |
| `apps/web/src/lib/qr.ts` | `SITE_URL` + `qrMatrix(text)` boolean grid | Create |
| `apps/web/src/lib/qr.test.ts` | Tests for `qrMatrix` | Create |
| `apps/web/src/components/cards/QrCode.tsx` | Render a QR matrix as scalable inline SVG | Create |
| `packages/shared/src/result.ts` | `ReceiptPaper` gains `'premium'` | Modify |
| `apps/web/src/components/cards/ReceiptPremium.tsx` | The holo "verified pass" + real QR | Create |
| `apps/web/src/design/receipt-premium.css` | Premium receipt styles (system tokens) | Create |
| `apps/web/src/components/cards/index.ts` | Export `ReceiptPremium` | Modify |
| `apps/web/src/features/result/Result.tsx` | Paper control + render + export + stamp suppression | Modify |

---

## Task 1: QR matrix helper + SVG component

**Files:**
- Modify: `apps/web/package.json` (dependency)
- Create: `apps/web/src/lib/qr.ts`
- Create: `apps/web/src/lib/qr.test.ts`
- Create: `apps/web/src/components/cards/QrCode.tsx`

- [ ] **Step 1: Add the QR library**

Run (from repo root):
```bash
npm install qrcode-generator@^1.4.4 --workspace @fitaura/web
npm install -D @types/qrcode-generator@^1.0.5 --workspace @fitaura/web
```
Expected: `qrcode-generator` appears in `apps/web/package.json` dependencies and `@types/qrcode-generator` in devDependencies; `package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/lib/qr.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { qrMatrix, SITE_URL } from './qr';

describe('qrMatrix', () => {
  it('encodes the site url as a square grid with the QR finder pattern', () => {
    const m = qrMatrix(SITE_URL);
    expect(m.length).toBeGreaterThanOrEqual(21); // QR is at least 21x21
    expect(m.every((row) => row.length === m.length)).toBe(true); // square
    // Top-left finder pattern invariants (true on the dark ring, false inside it):
    expect(m[0][0]).toBe(true);
    expect(m[0][6]).toBe(true);
    expect(m[1][1]).toBe(false);
    expect(m[3][3]).toBe(true); // 3x3 dark centre of the finder
  });

  it('is deterministic for the same input', () => {
    expect(qrMatrix('hello')).toEqual(qrMatrix('hello'));
  });

  it('differs for different input', () => {
    expect(qrMatrix('a')).not.toEqual(qrMatrix('b'));
  });

  it('points at the configured site', () => {
    expect(SITE_URL).toBe('https://fitaura.studio/');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace @fitaura/web -- qr`
Expected: FAIL — `./qr` module not found.

- [ ] **Step 4: Implement `qr.ts`**

Create `apps/web/src/lib/qr.ts`:

```ts
import qrcode from 'qrcode-generator';

/** The homepage the receipt QR links to. */
export const SITE_URL = 'https://fitaura.studio/';

/**
 * Encode `text` as a QR code and return its module grid (`true` = dark module).
 * Type number 0 = auto-size; error-correction level "M" is a good balance for a
 * short URL printed/shared at card scale.
 */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const grid: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    grid.push(row);
  }
  return grid;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace @fitaura/web -- qr`
Expected: PASS (4 tests).

- [ ] **Step 6: Create the `QrCode` SVG component**

Create `apps/web/src/components/cards/QrCode.tsx`:

```tsx
import { useMemo } from 'react';
import { qrMatrix } from '../../lib/qr';

interface QrCodeProps {
  value: string;
  className?: string;
}

/**
 * Renders a QR code as a scalable inline SVG — one `<rect>` per dark module on a
 * transparent ground (the container provides the light background). snapdom
 * rasterizes SVG faithfully, so the exported card keeps a scannable code.
 * The module count varies with the URL length, so the viewBox is sized to it.
 */
export function QrCode({ value, className }: QrCodeProps) {
  const grid = useMemo(() => qrMatrix(value), [value]);
  const n = grid.length;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) {
        // 1.02 overlap kills hairline seams between modules when rasterized.
        rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} />);
      }
    }
  }
  return (
    <svg
      className={className}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code to fitaura.studio"
    >
      {rects}
    </svg>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/lib/qr.ts apps/web/src/lib/qr.test.ts apps/web/src/components/cards/QrCode.tsx
git commit -m "feat(cards): real QR matrix helper + scalable SVG QrCode component"
```

---

## Task 2: Extend `ReceiptPaper` with `'premium'`

**Files:**
- Modify: `packages/shared/src/result.ts` (the `ReceiptPaper` type)
- Test: `apps/web/src/solo-scan/assembleGender.test.ts` is unaffected; add a tiny type-level guard test below.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/receiptPaper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ReceiptPaper } from '@fitaura/shared';

describe('ReceiptPaper', () => {
  it('includes premium alongside neon and thermal', () => {
    const papers: ReceiptPaper[] = ['neon', 'thermal', 'premium'];
    expect(papers).toContain('premium');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @fitaura/web -- receiptPaper`
Expected: FAIL — `'premium'` is not assignable to `ReceiptPaper` (TS error in the test).

- [ ] **Step 3: Add `'premium'` to the type**

In `packages/shared/src/result.ts`, change:

```ts
export type ReceiptPaper = 'neon' | 'thermal';
```

to:

```ts
export type ReceiptPaper = 'neon' | 'thermal' | 'premium';
```

- [ ] **Step 4: Run the test + typecheck**

Run: `npm run test --workspace @fitaura/web -- receiptPaper`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS — the existing `Receipt` component's `data-style={paper}` and the `TONE_CLASS` switch don't exhaustively match on paper, so no new errors appear.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/result.ts apps/web/src/receiptPaper.test.ts
git commit -m "feat(shared): ReceiptPaper gains a premium variant"
```

---

## Task 3: `ReceiptPremium` component + styles

**Files:**
- Create: `apps/web/src/components/cards/ReceiptPremium.tsx`
- Create: `apps/web/src/design/receipt-premium.css`
- Modify: `apps/web/src/components/cards/index.ts`

This ports the prototype's holo "verified pass" (`new card modes/card-styles.jsx` `ReceiptPremium` + `new card modes/card-studio-v2.css` `.rcp*`) but rebuilt in **system tokens** and using the real `QrCode`. The component reads the existing `DatingReceiptResult` and a `gender` for the accent identity.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/cards/ReceiptPremium.tsx`:

```tsx
import { VERDICT_LABEL, type DatingReceiptResult, type ReceiptRowTone } from '@fitaura/shared';
import { SITE_URL } from '../../lib/qr';
import { QrCode } from './QrCode';

interface ReceiptPremiumProps {
  content: DatingReceiptResult;
}

const TONE_CLASS: Record<ReceiptRowTone, string> = { default: '', good: 'good', hi: 'hi' };

/**
 * Premium receipt — a sleek "verified pass": iridescent holo strip, big neon
 * verdict, frosted data panel, and a real scannable QR to the homepage. Built in
 * system tokens; the accent follows the card's gender identity (set via
 * `data-gender` on the mount, as the face/outfit cards do). Verdict colour stays
 * semantic. Ported from the Card Studio v2 prototype, no gold-on-gold.
 */
export function ReceiptPremium({ content }: ReceiptPremiumProps) {
  const verdictLabel = VERDICT_LABEL[content.datingVerdict];
  return (
    <div className="asset rcp" data-verdict={content.datingVerdict}>
      <div className="rcp-glow" aria-hidden="true" />
      <div className="rcp-inner">
        <div className="rcp-top">
          <div className="rcp-brand"><span className="rcp-dot" />FITAURA</div>
          <div className="rcp-passtag">VERIFIED PASS</div>
        </div>

        <div className="rcp-holo" aria-hidden="true">
          <span>DATING DOSSIER · FITAURA · DATING DOSSIER · FITAURA ·</span>
        </div>

        <div className="rcp-hero">
          <span className="rcp-vlabel">CATEGORICAL VERDICT</span>
          <span className="rcp-stamp">{verdictLabel}</span>
          <span className="rcp-punch">{content.finalPunchline}</span>
        </div>

        <div className="rcp-rows">
          {content.rows.map((row) => (
            <div className="rcp-row" key={row.id}>
              <span className="rk">{row.label}</span>
              <span className="rlead" />
              <span className={'rv ' + TONE_CLASS[row.tone ?? 'default']}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className="rcp-foot">
          <QrCode value={SITE_URL} className="rcp-qr" />
          <div className="rcp-foottext">
            <div className="rcp-seal">SCAN TO PLAY</div>
            <div className="rcp-meta">GET YOUR FRIENDS SCORED</div>
            <div className="rcp-meta">NO. {content.generationId} · FITAURA.STUDIO</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles (system tokens)**

Create `apps/web/src/design/receipt-premium.css`:

```css
/* ============================================================
   PREMIUM RECEIPT — "verified pass". System tokens only.
   Accent = card gender identity (--accent, remapped to --magenta
   for femme by gender-theme.css). Verdict colour stays semantic.
   Ported from the Card Studio v2 prototype, rebuilt in tokens.
   ============================================================ */
.rcp {
  position: relative;
  width: 360px;
  height: 640px;
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% -10%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 60%),
    linear-gradient(180deg, var(--bg-2), var(--bg-0) 78%);
  border: 1px solid var(--hair);
  box-shadow: var(--shadow-card);
  color: var(--ink);
}
.rcp-glow {
  position: absolute; inset: 0; z-index: 0; pointer-events: none; mix-blend-mode: screen;
  background: radial-gradient(60% 40% at 50% 8%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%);
}
.rcp-inner { position: relative; z-index: 2; height: 100%; padding: 24px 23px 22px; display: flex; flex-direction: column; }

.rcp-top { display: flex; align-items: center; justify-content: space-between; }
.rcp-brand { display: flex; align-items: center; gap: 9px; font-family: "Hanken Grotesk", sans-serif; font-weight: 800; letter-spacing: .3em; font-size: 13px; color: var(--ink); }
.rcp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px var(--accent); }
.rcp-passtag {
  font-family: "Space Mono", monospace; font-size: 8.5px; letter-spacing: .2em; color: var(--ink-dim); text-transform: uppercase;
  padding: 4px 9px; border: 1px solid var(--hair); border-radius: 999px;
}

.rcp-holo { position: relative; margin: 18px 0 2px; height: 28px; border-radius: 8px; overflow: hidden; border: 1px solid var(--hair-soft); }
.rcp-holo::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(100deg, transparent 10%, color-mix(in oklab, var(--accent) 35%, transparent) 35%, color-mix(in oklab, var(--lime) 25%, transparent) 50%, color-mix(in oklab, var(--accent) 35%, transparent) 65%, transparent 90%);
  opacity: .8;
}
.rcp-holo span {
  position: absolute; inset: 0; display: flex; align-items: center; white-space: nowrap; overflow: hidden;
  font-family: "Space Mono", monospace; font-size: 9px; letter-spacing: .26em; color: var(--ink-dim); text-transform: uppercase; padding-left: 10px;
}

.rcp-hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 9px; margin: 16px 0 2px; }
.rcp-vlabel { font-family: "Space Mono", monospace; font-size: 8.5px; letter-spacing: .3em; color: var(--ink-dim); text-transform: uppercase; }
.rcp-stamp {
  font-family: "Anton", sans-serif; font-size: 43px; line-height: .94; letter-spacing: .01em; text-transform: uppercase;
  color: #fff; text-shadow: 0 0 26px color-mix(in oklab, var(--verdict) 55%, transparent);
}
.rcp-punch { font-family: "Hanken Grotesk", sans-serif; font-weight: 800; font-size: 15.5px; letter-spacing: .05em; color: var(--verdict); text-transform: uppercase; }

.rcp-rows {
  margin-top: 18px; padding: 15px; border-radius: 13px; display: flex; flex-direction: column; gap: 10px;
  background: var(--panel); border: 1px solid var(--hair-soft); backdrop-filter: blur(8px);
}
.rcp-row { display: flex; align-items: baseline; gap: 8px; font-family: "Space Mono", monospace; font-size: 11.5px; }
.rcp-row .rk { color: var(--ink-dim); text-transform: uppercase; letter-spacing: .06em; }
.rcp-row .rlead { flex: 1; border-bottom: 1px dotted var(--hair); transform: translateY(-3px); }
.rcp-row .rv { color: var(--ink); font-weight: 700; }
.rcp-row .rv.good { color: var(--lime); }
.rcp-row .rv.hi { color: var(--verdict); }

.rcp-foot { display: flex; align-items: center; gap: 15px; margin-top: auto; padding-top: 16px; }
.rcp-qr { width: 118px; height: 118px; flex: none; padding: 7px; border-radius: 8px; background: #f4f6f8; }
.rcp-qr rect { fill: #0a0c11; }
.rcp-foottext { flex: 1; min-width: 0; }
.rcp-seal { font-family: "Hanken Grotesk", sans-serif; font-weight: 800; letter-spacing: .08em; font-size: 12px; color: var(--ink); }
.rcp-meta { font-family: "Space Mono", monospace; font-size: 8.5px; letter-spacing: .1em; color: var(--ink-dim); text-transform: uppercase; margin-top: 3px; }
```

- [ ] **Step 3: Export the component**

In `apps/web/src/components/cards/index.ts`, add an export line next to the others:

```ts
export { ReceiptPremium } from './ReceiptPremium';
```

(Open the file first to match the existing export style — it re-exports `FaceCard`, `OutfitCard`, `Receipt`, etc.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: PASS. (The component isn't rendered yet — wired in Task 4 — but must compile.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/cards/ReceiptPremium.tsx apps/web/src/design/receipt-premium.css apps/web/src/components/cards/index.ts
git commit -m "feat(cards): premium 'verified pass' receipt with real QR (system tokens)"
```

---

## Task 4: Wire Premium into the Result page

**Files:**
- Modify: `apps/web/src/features/result/Result.tsx`

The Premium receipt replaces the visible/exported `Receipt` when `paper === 'premium'`, and carries its own seal/QR — so the movable stamp overlay and the "Stamp on/off" + reposition controls are suppressed for it.

- [ ] **Step 1: Import ReceiptPremium + the stylesheet**

At the top of `Result.tsx`, add `ReceiptPremium` to the cards import (it currently imports `FaceCard, OutfitCard, Receipt`):

```ts
import { FaceCard, OutfitCard, Receipt, ReceiptPremium } from '../../components/cards';
```

And add the stylesheet import next to the other design imports (after `import '../../design/gender-theme.css';`):

```ts
import '../../design/receipt-premium.css';
```

- [ ] **Step 2: Render Premium as the visible receipt**

In the `assetEl` definition, the receipt branch is:

```tsx
    ) : (
      <Receipt content={result.receipt} paper={paper} sealOn={false} />
    );
```

Change it to:

```tsx
    ) : paper === 'premium' ? (
      <ReceiptPremium content={result.receipt} />
    ) : (
      <Receipt content={result.receipt} paper={paper} sealOn={false} />
    );
```

- [ ] **Step 3: Suppress the stamp overlay for Premium**

The receipt branch of `overlayEl` is:

```tsx
    ) : (
      <ReceiptStampEditor preset={receiptPreset} setPreset={setReceiptPreset} editing={editing} />
    );
```

Change it to:

```tsx
    ) : paper === 'premium' ? null : (
      <ReceiptStampEditor preset={receiptPreset} setPreset={setReceiptPreset} editing={editing} />
    );
```

- [ ] **Step 4: Add the Premium button to the paper control**

The paper segmented control currently has two buttons (Dark neon / Thermal) at the `rs-seg` div:

```tsx
              <div className="rs-seg">
                <button aria-pressed={paper === 'neon'} onClick={() => setPaper('neon')}>
                  Dark neon
                </button>
                <button aria-pressed={paper === 'thermal'} onClick={() => setPaper('thermal')}>
                  Thermal
                </button>
              </div>
```

Add a third button:

```tsx
              <div className="rs-seg">
                <button aria-pressed={paper === 'neon'} onClick={() => setPaper('neon')}>
                  Dark neon
                </button>
                <button aria-pressed={paper === 'thermal'} onClick={() => setPaper('thermal')}>
                  Thermal
                </button>
                <button aria-pressed={paper === 'premium'} onClick={() => setPaper('premium')}>
                  Premium
                </button>
              </div>
```

- [ ] **Step 5: Hide the stamp on/off + reposition controls for Premium**

Immediately after the `rs-seg` div above, the receipt control bar has a spacer + the stamp on/off button + the Reposition button. Wrap those receipt-stamp controls so they only show for non-premium papers. Find this block (the `rs-cb-spacer` through the Reposition `rs-cb-btn`):

```tsx
              <span className="rs-cb-spacer" />
              <button
                className={'rs-cb-btn' + (receiptPreset ? ' on' : '')}
                onClick={() => setReceiptPreset(receiptPreset ? null : 'tr')}
              >
                <Icon.star />
                {receiptPreset ? 'Stamp on' : 'Stamp off'}
              </button>
              <button className="rs-cb-btn" onClick={() => setEditing(true)}>
                <Icon.move />
                Reposition
              </button>
```

and wrap the stamp + reposition buttons in a `paper !== 'premium'` guard (keep the spacer so the layout still pushes right):

```tsx
              <span className="rs-cb-spacer" />
              {paper !== 'premium' && (
                <>
                  <button
                    className={'rs-cb-btn' + (receiptPreset ? ' on' : '')}
                    onClick={() => setReceiptPreset(receiptPreset ? null : 'tr')}
                  >
                    <Icon.star />
                    {receiptPreset ? 'Stamp on' : 'Stamp off'}
                  </button>
                  <button className="rs-cb-btn" onClick={() => setEditing(true)}>
                    <Icon.move />
                    Reposition
                  </button>
                </>
              )}
```

- [ ] **Step 6: Render Premium in the export host (and skip the static stamp)**

The offscreen export receipt host renders `<Receipt … /><StaticStamp … />`. Find it:

```tsx
        <div
          className="rs-export-card is-receipt"
          ref={exportRefs.receipt}
          data-paper={paper}
          data-verdict={result.verdict}
          data-gender={gender}
        >
          <Receipt content={result.receipt} paper={paper} sealOn={false} />
          <StaticStamp preset={receiptPreset} />
        </div>
```

Change the inner render to branch on premium:

```tsx
        <div
          className="rs-export-card is-receipt"
          ref={exportRefs.receipt}
          data-paper={paper}
          data-verdict={result.verdict}
          data-gender={gender}
        >
          {paper === 'premium' ? (
            <ReceiptPremium content={result.receipt} />
          ) : (
            <>
              <Receipt content={result.receipt} paper={paper} sealOn={false} />
              <StaticStamp preset={receiptPreset} />
            </>
          )}
        </div>
```

- [ ] **Step 7: Typecheck + build**

Run: `npm run typecheck`
Expected: PASS.
Run: `npm run build`
Expected: PASS — `tsc --noEmit && vite build` clean, `qrcode-generator` bundled, `receipt-premium.css` resolved.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/result/Result.tsx
git commit -m "feat(result): premium receipt paper option + QR pass wiring"
```

---

## Task 5: Verify + manual smoke

- [ ] **Step 1: Full test suite**

Run: `npm run test --workspace @fitaura/web`
Expected: PASS — all existing tests plus the new `qr` and `receiptPaper` tests.

- [ ] **Step 2: Manual smoke**

Run `npm run dev`, open a result, go to the Receipt tab, and click **Premium**:
- The receipt switches to the holo "verified pass": iridescent strip, big verdict, frosted rows panel, QR bottom-left.
- The QR is **scannable** with a phone camera and opens `https://fitaura.studio/`.
- For a **femme** result the accent reads magenta (the `--accent` remap from `gender-theme.css` flows in via `data-gender` on the card mount); masc reads icy.
- The "Stamp on/off" + "Reposition" controls are **hidden** on Premium; Dark neon / Thermal still show them and still work.
- **Download** the premium receipt and confirm the exported PNG keeps the layout + a scannable QR (snapdom).

- [ ] **Step 3: Push (frontend-only; Vercel deploys — no edge redeploy)**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage (Premium receipt):**
- Premium added as a 3rd paper (neon/thermal/premium) — Tasks 2, 4. ✓
- Real QR to `https://fitaura.studio/` (replaces the prototype's fake matrix), snapdom-safe SVG — Task 1, 3. ✓
- Holo "verified pass" rebuilt in **system tokens** (accent = gender identity, verdict semantic, no gold-on-gold) — Task 3. ✓
- WYSIWYG export — Task 4 Step 6 + Task 5 Step 2. ✓
- Frontend-only, no edge redeploy — noted; Task 5 Step 3. ✓

**Placeholder scan:** No TBD/TODO. Library versions are pinned; the prototype CSS is fully ported (no "style it like the prototype" hand-waves).

**Type consistency:** `ReceiptPaper` (`'neon' | 'thermal' | 'premium'`) is used identically in `Result.tsx` (`paper === 'premium'`) and the new button. `SITE_URL`/`qrMatrix` (Task 1) are consumed by `QrCode` and `ReceiptPremium` (Task 3). `DatingReceiptResult`, `ReceiptRowTone`, `VERDICT_LABEL`, `receiptDate` are existing shared exports reused as-is. `ReceiptPremium` takes only `{ content }` — gender theming arrives via the ancestor `data-gender`, matching how Premium sits inside `rs-card-mount` / `rs-export-card`.

**Risk note:** if a future URL is long enough that the auto-sized QR gets dense, the fixed 118px box still scans (error-correction "M"); bump to a larger box in `.rcp-qr` if needed.
