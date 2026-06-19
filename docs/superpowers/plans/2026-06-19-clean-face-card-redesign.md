# Clean Face Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Clean *face* skin so selfies stop stretching — a contained, naturally-cropped photo carries the verdict/punchline/roast on a bottom scrim, and a solid block below holds the four stats as Clean pill chips plus a footer read.

**Architecture:** Frontend-only, no AI/schema/edge change. Add an optional `punchline` to the shared `SkinProps`, thread the existing `result.receipt.finalPunchline` into the face skin from `Result.tsx`, rewrite `CleanFace.tsx` markup, and add face-scoped rules to `clean-skin.css`. The `CleanOutfit` card shares `.clean-card` so all new CSS is scoped to the face variant.

**Tech Stack:** React 18 + TypeScript, Vite, vitest (logic tests only — no component-render infra), CSS design tokens, snapdom export.

**Testing note:** This is a presentational change. There is **no component-render test infra** in this repo (no `@testing-library/react`, zero `.test.tsx`). The automated gate is therefore `npm run typecheck` + the existing `vitest` suites staying green; **behavioral verification is in-browser via Playwright**, exactly as Phase B / dev-log 058 verified the skins. Do **not** invent a contrived vitest render test.

**Scope:** Clean **face** skin only. Dossier face, Lore face, all outfit cards, and the receipt are untouched.

---

## File Structure

- `apps/web/src/components/cards/skins/types.ts` — add `punchline?: string` to `SkinProps`.
- `apps/web/src/features/result/Result.tsx` — pass `finalPunchline` to the face skin at the switcher `skinProps` and the export-host call sites.
- `apps/web/src/components/cards/skins/CleanFace.tsx` — rewrite to contained-photo + scrim text stack + solid info block.
- `apps/web/src/design/clean-skin.css` — add `.cleanface*` rules (face-scoped); leave existing `.clean-card`/`.clean-scrim`/`.clean-bottom` rules (used by `CleanOutfit`) untouched.
- `docs/dev-log/060-clean-face-card-redesign.md` — study log (project convention).

---

## Task 1: Thread the punchline prop into the face skin

**Files:**
- Modify: `apps/web/src/components/cards/skins/types.ts`
- Modify: `apps/web/src/features/result/Result.tsx` (~L501-507 switcher `skinProps`; ~L725 export host)

- [ ] **Step 1: Add `punchline` to `SkinProps`**

In `types.ts`, add the field after `roast` inside the `SkinProps` interface:

```ts
  /** One-line roast shown under the verdict. */
  roast?: string;
  /** The big viral punchline (result.receipt.finalPunchline); the Clean face skin
   * renders it between the verdict and the roast. Optional — other skins ignore it. */
  punchline?: string;
```

- [ ] **Step 2: Pass it from the switcher `skinProps`**

In `Result.tsx`, the `<CardSwitcher … skinProps={{ … }}>` object literal (~L501) currently ends with the `roast:` line. Add a `punchline:` line. `finalPunchline` is a single string on the result, so it can be passed unconditionally — only `CleanFace` reads it:

```tsx
                    skinProps={{
                      content: (kind === 'face' ? faceContent : outfitContent)!,
                      verdict: result.verdict,
                      gender,
                      stickerOn: false,
                      roast: kind === 'face' ? result.face!.analysis.roast : result.outfit!.analysis.verdict,
                      punchline: result.receipt.finalPunchline,
                    }}
```

- [ ] **Step 3: Pass it to the export host**

In `Result.tsx`, the offscreen export `<FaceSkinComp … />` (~L725) currently passes `roast={result.face!.analysis.roast}`. Add `punchline`:

```tsx
          <FaceSkinComp content={faceContent} verdict={result.verdict} gender={gender} stickerOn={false} run={false} roast={result.face!.analysis.roast} punchline={result.receipt.finalPunchline} />
```

(Leave the sibling `<OutfitSkinComp … />` unchanged.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). Confirms the new optional prop threads cleanly through `CardSwitcher` (which spreads `skinProps`) and the export host.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/cards/skins/types.ts apps/web/src/features/result/Result.tsx
git commit -m "feat(skins): thread finalPunchline into face skin props"
```

---

## Task 2: Redesign the Clean face card (markup + CSS together)

**Files:**
- Rewrite: `apps/web/src/components/cards/skins/CleanFace.tsx`
- Modify: `apps/web/src/design/clean-skin.css` (append face-scoped rules; do not edit existing rules)

These land together — the new markup needs the new CSS to read correctly, and vice-versa.

- [ ] **Step 1: Rewrite `CleanFace.tsx`**

Replace the entire file with:

```tsx
import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Clean skin (face) — a contained, naturally-cropped photo carries the verdict,
 * punchline and roast on a bottom scrim; a solid info block below holds the four
 * face stats as Clean pill chips and a footer read. Replaces the old full-bleed
 * layout that stretched/over-cropped selfies. System tokens only; the accent
 * (verdict highlight, punchline) follows the card's gender identity via the
 * ancestor `data-gender`. The editable sticker rides on top from the Result page.
 */
export function CleanFace({ content, roast, punchline }: SkinProps) {
  const c = content as FaceCardContent;
  return (
    <div className="asset clean-card cleanface" data-kind="face">
      <div className="cleanface-photo">
        <CardImage src={c.imageUrl} shape="rect" placeholder="drop face photo" alt="Your face" />
        <span className="clean-wm">FITAURA</span>
        <div className="cleanface-photo-scrim" />
        <div className="cleanface-text">
          <h2 className="clean-verdict">
            {c.verdict[0]} <span className="hl">{c.verdict[1]}</span>
          </h2>
          {punchline && <p className="cleanface-punch">{punchline}</p>}
          {roast && <p className="cleanface-roast">{roast}</p>}
        </div>
      </div>
      <div className="cleanface-info">
        <div className="clean-chips">
          {c.scores.map((s) => (
            <span className="clean-chip" key={s.id}>
              {s.label} · {s.displayValue ?? s.value}
            </span>
          ))}
        </div>
        <div className="cleanface-read">FACE / VIBE READ</div>
      </div>
    </div>
  );
}
```

Notes: the root keeps `clean-card` (frame: size, radius, overflow, shadow, `--bg-1`) and adds `cleanface` (flex column). It reuses the shared `clean-wm`, `clean-verdict`/`.hl`, `clean-chips`/`clean-chip` classes — so the type + chip styling matches the outfit card. All four `content.scores` render as chips (Aura, Est. Age with `displayValue` "26 y.o.", Femininity/Masculinity, Main Character), vs. the old `slice(0,3)`.

- [ ] **Step 2: Append face-scoped rules to `clean-skin.css`**

Add at the end of `apps/web/src/design/clean-skin.css` (do **not** modify the existing `.clean-card`/`.clean-scrim`/`.clean-wm`/`.clean-verdict`/`.clean-chips`/`.clean-chip`/`.clean-bio` rules — `CleanOutfit` depends on them):

```css
/* ============================================================
   CLEAN FACE variant — contained photo (no selfie stretch) with the
   verdict/punchline/roast on a bottom scrim, and a solid info block of
   pill chips + footer read below. Scoped to `.cleanface` so the shared
   `.clean-card` outfit skin is unaffected.
   ============================================================ */
.cleanface { display: flex; flex-direction: column; }

/* Photo region: top ~58%. The base `.clean-card .card-image { inset:0 }` rule
   fills THIS positioned box (not the whole card), so the photo is contained and
   `object-fit: cover` gives a natural crop instead of a 360×640 stretch. */
.cleanface-photo { position: relative; flex: 0 0 58%; overflow: hidden; }

.cleanface-photo-scrim {
  position: absolute; left: 0; right: 0; bottom: 0; height: 64%;
  z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,.5) 46%, rgba(0,0,0,.92) 100%);
}

.cleanface-text { position: absolute; left: 22px; right: 22px; bottom: 18px; z-index: 2; }
.cleanface .clean-verdict { font-size: 32px; }
.cleanface-punch {
  margin: 8px 0 0; font-family: "Hanken Grotesk", sans-serif; font-weight: 800;
  font-size: 14px; letter-spacing: .04em; text-transform: uppercase;
  color: var(--accent); text-shadow: 0 2px 12px rgba(0,0,0,.6);
}
.cleanface-roast {
  margin: 6px 0 0; font-family: "Hanken Grotesk", sans-serif; font-size: 13px; line-height: 1.35;
  color: rgba(255,255,255,.82); text-wrap: pretty; text-shadow: 0 1px 8px rgba(0,0,0,.7);
}

/* Solid info block: bottom ~42%. Pill chips at top, footer read pinned bottom. */
.cleanface-info {
  flex: 1; min-height: 0; background: var(--bg-1);
  padding: 16px 22px 18px; display: flex; flex-direction: column;
}
.cleanface-info .clean-chips { margin-top: 0; }
.cleanface-read {
  margin-top: auto; font-family: "Space Mono", monospace; font-size: 10px;
  letter-spacing: .22em; text-transform: uppercase; color: var(--ink-faint);
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. (`build` runs `tsc --noEmit && vite build` for the web app.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/cards/skins/CleanFace.tsx apps/web/src/design/clean-skin.css
git commit -m "feat(skins): redesign Clean face card — contained photo + pill chips"
```

---

## Task 3: In-browser verification + regression

**Files:** none (verification; commit only if a tweak is needed)

Verify with Playwright against the real dev server, the same way dev-log 058 verified the skins (seed a face result into IndexedDB, open the result route). Use the Playwright MCP `browser_*` tools or the `verify` skill.

- [ ] **Step 1: Start the dev server**

Run (background): `npm run dev`
Note the local URL (Vite prints e.g. `http://localhost:5173`).

- [ ] **Step 2: Open a result with a face card and switch to the Clean skin**

Seed/open a generation that has a face card (mirror the 058 approach), then click the Clean dot in the face card's `.cs-dots` to bring the Clean face skin to the front.

- [ ] **Step 3: Confirm the acceptance criteria**

Take a screenshot of the face card and verify ALL of:
- The selfie is **contained** in the top ~58% with a natural crop — **not** stretched/over-zoomed to the full card height.
- On the photo scrim, top-to-bottom: **verdict** (2nd part in accent) → **punchline** (bold uppercase, accent — the `finalPunchline`) → **roast** (thin), with the roast directly below the punchline.
- The solid block below shows **four pill chips** — AURA · 72, EST. AGE · 26 Y.O., FEMININITY/MASCULINITY · NN, MAIN CHARACTER · NN — and a **FACE / VIBE READ** footer.
- No `clean-scrim` full-card darkening and **no top-right score box**.
- The editable **sticker** still appears over the photo and can be dragged (enter edit mode).

- [ ] **Step 4: Verify export parity**

Trigger the face card download/export and confirm the saved image matches on-screen (contained photo + scrim text + chips + footer). Export renders the active skin via the host wired in Task 1.

- [ ] **Step 5: Regression — confirm nothing else moved**

- Switch the face card to **Dossier** and **Lore** — both render as before.
- Confirm the **outfit** card (Clean/Dossier/Lore) is visually unchanged (the `.clean-card` outfit skin must be unaffected by the face-scoped CSS).

- [ ] **Step 6: Run the full test suites**

Run: `npm run test --workspace @fitaura/web && npm run test --workspace @fitaura/shared`
Expected: all green (incl. the existing `registry` and `cycleOrder` tests). No tests were added — this confirms no regression.

- [ ] **Step 7: If a tweak was needed, commit it**

If Step 3/4 surfaced clipping or sizing issues, adjust `clean-skin.css` (e.g. the `flex` split, `clean-verdict` size, or chip wrapping) and re-verify, then:

```bash
git add apps/web/src/design/clean-skin.css apps/web/src/components/cards/skins/CleanFace.tsx
git commit -m "fix(skins): tune Clean face card spacing"
```

---

## Task 4: Dev-log

**Files:**
- Create: `docs/dev-log/060-clean-face-card-redesign.md`

- [ ] **Step 1: Write the study log**

Per the project convention (a study-oriented log after each crucial step). Cover: what changed (contained photo + scrim text stack + Clean pill chips + footer; dropped full-bleed stretch and score box), the key decision (punchline = `result.receipt.finalPunchline`, threaded via a new optional `SkinProps.punchline`), the CSS-scoping gotcha (`.clean-card` is shared with `CleanOutfit`, so all new rules are `.cleanface`-scoped), and how it was verified (Playwright + export parity + outfit/Dossier/Lore regression; full suite green). Scope was the Clean face skin only — first of a card-by-card pass.

- [ ] **Step 2: Commit**

```bash
git add docs/dev-log/060-clean-face-card-redesign.md
git commit -m "docs(dev-log): 060 Clean face card redesign"
```

---

## Self-Review

- **Spec coverage:** contained photo (T2 CSS `.cleanface-photo` + base image rule) ✓; verdict→punchline→roast on photo scrim (T2 markup + `.cleanface-text`) ✓; punchline = `finalPunchline` (T1) ✓; roast below punchline (T2 markup order) ✓; no score box (T2 markup omits it) ✓; Clean pill chips + footer read (T2) ✓; type hierarchy matches outfit (reuses `clean-verdict`/`clean-chip`) ✓; accent/gender unchanged (uses `--accent`) ✓; scope = Clean face only (CSS `.cleanface`-scoped; outfit/Dossier/Lore untouched) ✓; export parity (T1 host + T3 Step 4) ✓; sticker still on photo (T3 Step 3) ✓; CleanOutfit regression (T3 Step 5) ✓.
- **Placeholder scan:** none — every step has exact paths, full code, and concrete commands/acceptance criteria.
- **Type consistency:** `punchline?: string` is defined in T1 (types.ts), passed in T1 (Result.tsx, both sites), and consumed in T2 (`CleanFace` destructure). Class names in the markup (`cleanface`, `cleanface-photo`, `cleanface-photo-scrim`, `cleanface-text`, `cleanface-punch`, `cleanface-roast`, `cleanface-info`, `cleanface-read`) all match the CSS rules. Reused shared classes (`clean-card`, `clean-wm`, `clean-verdict`, `hl`, `clean-chips`, `clean-chip`) exist in `clean-skin.css`.
