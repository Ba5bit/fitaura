# Partial Scans — Phase 2 (UI Unlock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users actually run face-only / outfit-only / both scans end-to-end — upload gating, scan animation variants, result tabs, vault cards, and export all adapt to `result.parts`.

**Architecture:** Phase 1 already made the data model, scoring, AI, edge function, and all consumers partial-capable behind the both-photo upload gate. Phase 2 flips the gate (≥1 photo) and replaces the Phase-1 defensive guards with real partial UX driven by `result.parts` (and, during scanning, the session photos present).

**Tech Stack:** React, React Router, TypeScript, CSS, Vitest.

**Convention:** All commits end with the repo trailer:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
Run tests/typecheck from `apps/web`.

**Prereq:** Phase 1 plan (`2026-06-17-partial-scans-phase-1-plumbing.md`) merged + edge deployed.
**Spec:** `docs/superpowers/specs/2026-06-17-partial-scans-face-or-outfit-design.md`

---

## File Structure

- `apps/web/src/features/upload/Upload.tsx` — gate on ≥1 photo; copy/hint updates.
- `apps/web/src/state/generation.tsx` — relax `runGeneration` gate; send provided urls.
- `apps/web/src/features/scan/Scan.tsx` + `apps/web/src/design/scanner.css` — parts-driven stages + specimen.
- `apps/web/src/features/result/Result.tsx` — dynamic tabs from `result.parts`.
- `apps/web/src/features/vault/SoloMode.tsx` — asset chips + thumbnail reflect parts.
- `apps/web/src/lib/exportCard.ts` — export only present cards.

---

## Task 1: Upload accepts one or both photos

**Files:**
- Modify: `apps/web/src/features/upload/Upload.tsx`

- [ ] **Step 1: Gate on ≥1 photo**

Replace the readiness block:

```ts
  const faceReady = !!face;
  const outfitReady = !!outfit;
  const anyReady = faceReady || outfitReady;

  function onGenerate() {
    if (!anyReady) {
      setAttempted(true);
      return;
    }
    navigate('/scan/run');
  }
```

(Remove `bothReady` and `missingList`.)

- [ ] **Step 2: Update title + validation copy**

Title block:

```tsx
          <div className="ua-title">
            <span className="eyebrow">Upload · 1 or 2 photos</span>
            <h2>
              Drop your <span className="hl">face</span>, your <span className="hl">fit</span>, or both
            </h2>
            <p className="sub">One photo or two. We score whatever you give us — face, outfit, or the full verdict.</p>
          </div>
```

Validation banner (only when nothing is selected):

```tsx
            {attempted && !anyReady && (
              <div className="val-banner">
                <Icon.alert />
                <span className="vt"><b>Add at least one photo</b> to run your scan.</span>
              </div>
            )}
```

- [ ] **Step 3: CTA enablement + hint**

In the CTA block, replace `bothReady` with `anyReady`:

```tsx
                <button className={'cta ' + (anyReady ? 'go' : 'disabled')} onClick={onGenerate}>
                  <Icon.bolt /> {guest ? 'Scan my aura, free' : 'Scan my aura'}
                </button>
```

Replace the unlock hint:

```tsx
              {(guest || canScan) && !anyReady && !attempted && (
                <div className="cta-hint">Add a face photo, an outfit photo, or both.</div>
              )}
```

(The two `rchip` "Face ready/needed" / "Outfit ready/needed" indicators stay — they now read as optional progress, which is fine.)

- [ ] **Step 4: Verify**

Run (from `apps/web`): `npx tsc -p tsconfig.json --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/upload/Upload.tsx
git commit -m "feat(web): upload accepts one or both photos"
```

---

## Task 2: Generation runs with whatever photos exist

**Files:**
- Modify: `apps/web/src/state/generation.tsx`

- [ ] **Step 1: Relax the gate + send provided urls**

In `runGeneration`, replace the both-photo guard and the service call:

```ts
    const s = stateRef.current;
    if (!s.face && !s.outfit) return { ok: false, reason: 'missing_photos' };

    const startedKey = s.accountKey;
    const startedFace = s.face;
    const startedOutfit = s.outfit;

    const outcome = await runSoloScan(startedFace?.url ?? null, startedOutfit?.url ?? null);
```

The result construction from Phase 1 already guards `base.face`/`base.outfit`; update the imageUrl source to the optional photos:

```ts
      face: base.face ? { ...base.face, card: { ...base.face.card, imageUrl: startedFace?.url ?? null } } : null,
      outfit: base.outfit ? { ...base.outfit, card: { ...base.outfit.card, imageUrl: startedOutfit?.url ?? null } } : null,
```

- [ ] **Step 2: Update `bothPhotosReady` consumers**

`generation.tsx` exposes `bothPhotosReady`. Add a sibling `canScanPhotos` and keep `bothPhotosReady` for any remaining caller:

```ts
  const bothPhotosReady = !!face && !!outfit;
  const canScanPhotos = !!face || !!outfit;
```

Add `canScanPhotos` to the context interface + the `value` memo.

- [ ] **Step 3: Verify**

Run (from `apps/web`): `npx tsc -p tsconfig.json --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/state/generation.tsx
git commit -m "feat(web): generate a verdict from one or both photos"
```

---

## Task 3: Scan route gate + animation variants

**Files:**
- Modify: `apps/web/src/features/scan/Scan.tsx`
- Modify: `apps/web/src/design/scanner.css`

- [ ] **Step 1: Use `canScanPhotos` for the entry gate**

In `Scan.tsx`, change the destructure to pull `canScanPhotos`, and replace `bothPhotosReady` in the entry-guard effect + the kickoff/progress effects with `canScanPhotos`:

```ts
  const { face, outfit, result, canScanPhotos, runGeneration, hydrated } = useGeneration();
```
```ts
  useEffect(() => {
    if (hydrated && !canScanPhotos) navigate('/scan', { replace: true });
  }, [hydrated, canScanPhotos, navigate]);
```
Replace `if (!bothPhotosReady || startedRef.current) return;` → `if (!canScanPhotos || startedRef.current) return;` and the progress-effect `if (!bothPhotosReady) return;` → `if (!canScanPhotos) return;` (and dep arrays accordingly).

In the signed-in kickoff, send provided photos:
```ts
      const outcome = await runGeneration();
```
(unchanged — `runGeneration` reads the session photos itself.)

- [ ] **Step 2: Derive parts + active stages**

After the destructure, add:

```ts
  const parts = { face: !!face, outfit: !!outfit };
```

Replace the module-level `STAGES`/`stageAt` usage with a per-scan active list. Add a helper that filters and re-spaces boundaries:

```ts
function activeStagesFor(parts: { face: boolean; outfit: boolean }): Stage[] {
  const picked = STAGES.filter(
    (s) => s.key === 'prep' || s.key === 'aura' || s.key === 'verdict'
      || (s.key === 'face' && parts.face)
      || (s.key === 'fit' && parts.outfit),
  );
  // Re-space boundaries evenly across the picked stages so the bar still ends at 100.
  const step = 100 / picked.length;
  return picked.map((s, i) => ({ ...s, boundary: Math.round(step * (i + 1)) }));
}
```

In the component, compute:

```ts
  const stages = activeStagesFor(parts);
  const idx = stageAtIn(stages, progress);
  const stage = stages[idx];
```

Add `stageAtIn` (parameterised version of `stageAt`):

```ts
function stageAtIn(stages: Stage[], p: number): number {
  for (let i = 0; i < stages.length; i++) {
    if (p < stages[i].boundary || i === stages.length - 1) return i;
  }
  return 0;
}
```

Update the readout "Stage {idx + 1} of 5" → `Stage {idx + 1} of {stages.length}` and the `<Rail>` to take `stages`:

```tsx
            <Rail stages={stages} idx={idx} />
```
and change `Rail` signature to `function Rail({ stages, idx }: { stages: Stage[]; idx: number })` using `stages.map(...)` instead of `STAGES.map(...)`.

- [ ] **Step 3: Specimen reflects parts**

Pass `parts` into `Specimen` and choose the frame image + circle visibility:

```tsx
            <Specimen stageKey={stage.key} parts={parts} faceSrc={faceSrc} outfitSrc={outfitSrc} />
```

In `Specimen`, change the signature + frame/circle:

```tsx
function Specimen({ stageKey, parts, faceSrc, outfitSrc }: { stageKey: string; parts: { face: boolean; outfit: boolean }; faceSrc: string | null; outfitSrc: string | null }) {
  const cap = (STAGES.find((s) => s.key === stageKey) || STAGES[0]).cap;
  // outfit fills the frame when present; otherwise the face does. The circular face
  // inset only makes sense when BOTH exist (face over outfit).
  const frameSrc = parts.outfit ? outfitSrc : faceSrc;
  const showCircle = parts.face && parts.outfit;
  return (
    <div className="specimen ignite">
      <div className="spec-aura" />
      <div className="spec-frame">
        <CardImage src={frameSrc} shape="rect" placeholder={parts.outfit ? 'outfit' : 'face'} />
        ...
      </div>
      {showCircle && (
        <div className="spec-face">
          <div className="ring" />
          <CardImage src={faceSrc} shape="circle" placeholder="face" />
          <span className="tick t1" />
          <span className="tick t2" />
        </div>
      )}
      {MARKERS.map(...)}  // unchanged — markers only show for the active stageKey
    </div>
  );
}
```

(The `MARKERS` block is unchanged: face-stage markers never fire on an outfit-only scan because the `face` stage isn't in `stages`, so `stageKey` is never `'face'`.)

- [ ] **Step 4: Verify + manual**

Run (from `apps/web`): `npx tsc -p tsconfig.json --noEmit` (clean), then `npx vitest run` (green).
Manual: run outfit-only and face-only scans; confirm no face circle on outfit-only, no fit stage on face-only, the progress bar fills smoothly, and the rail shows the right steps.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scan/Scan.tsx apps/web/src/design/scanner.css
git commit -m "feat(scan): animation variants for face-only / outfit-only"
```

---

## Task 4: Result view — dynamic tabs

**Files:**
- Modify: `apps/web/src/features/result/Result.tsx`

> This is the trickiest file. The module-level `TABS` is the full 3-tab list; we derive a per-result `tabs` subset and drive all nav/index logic off it. Render the body for `tabs[tab].slug`.

- [ ] **Step 1: Derive the visible tabs from parts**

Inside `Result()` (after `result` is known and the early null-guard), add:

```ts
  const tabs = TABS.filter(
    (t) => t.slug === 'receipt'
      || (t.slug === 'face' ? !!result?.face : !!result?.outfit),
  );
```

Update `slugToTab` usages and `setTab` to clamp against `tabs` (not `TABS`):
- `const slugToTabIdx = (slug: string) => tabs.findIndex((t) => t.slug === slug);` (returns -1 when absent → fall back to 0).
- In `initialTab`, map a hash/stored slug through `slugToTabIdx`; if -1, use 0.
- In `setTab`, clamp `Math.max(0, Math.min(tabs.length - 1, next))` and read `tabs[n].slug`.

- [ ] **Step 2: Render nav + body from `tabs`**

- The tab strip renders `tabs.map(...)` instead of `TABS.map(...)`.
- Where the body switches on the current kind, use `const kind = tabs[tab].slug;` and render:
  - `kind === 'face'` → `result.face && (<FaceCard .../> + <FaceAnalysisBlock .../>)`
  - `kind === 'outfit'` → `result.outfit && (<OutfitCard .../> + <OutfitAnalysisBlock .../>)`
  - `kind === 'receipt'` → receipt + `<ReceiptSummaryBlock .../>`
- The arrow-key handler already calls `setTab(tab ± 1)`, which now clamps to `tabs`.

- [ ] **Step 3: Export hosts skip absent cards**

The offscreen export hosts are keyed `{ face, outfit, receipt }`. Render the face/outfit hosts only when present:
```tsx
        {result.face && <div ref={exportRefs.face}> ... </div>}
        {result.outfit && <div ref={exportRefs.outfit}> ... </div>}
        <div ref={exportRefs.receipt}> ... </div>
```

- [ ] **Step 4: Verify + manual**

Run (from `apps/web`): `npx tsc -p tsconfig.json --noEmit` (clean), `npx vitest run` (green).
Manual: open an outfit-only result → only OUTFIT + RECEIPT tabs, default OUTFIT; a face-only result → FACE + RECEIPT; both → all three. A stale `#face` hash on an outfit-only result falls back to OUTFIT.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/result/Result.tsx
git commit -m "feat(result): show only the tabs a scan produced"
```

---

## Task 5: Vault cards reflect parts

**Files:**
- Modify: `apps/web/src/features/vault/SoloMode.tsx`

- [ ] **Step 1: Asset chips from parts**

In `SoloCard`, replace the always-on three-asset row with one driven by the result:

```tsx
      <div className="vlt-assets" aria-label="What this verdict contains">
        {r.face && (<span className="a on"><span className="gd" />Face</span>)}
        {r.outfit && (<span className="a on"><span className="gd" />Outfit</span>)}
        <span className="a on"><span className="gd" />Receipt</span>
      </div>
```

- [ ] **Step 2: Thumbnail fallback (already partly done in Phase 1)**

Confirm `OutfitThumb` uses `r.outfit?.card.imageUrl ?? r.face?.card.imageUrl ?? null` and guards the FIT badge/caption (from Phase 1 Task 9). For a face-only card, also show a FACE badge instead of FIT:

```tsx
      {r.outfit ? (
        <div className="badge"><span className="num">{r.outfit.card.overallScore}</span><span className="sub">FIT</span></div>
      ) : r.face ? (
        <div className="badge"><span className="num">{r.face.analysis.aura}</span><span className="sub">AURA</span></div>
      ) : null}
```

- [ ] **Step 3: Verify**

Run (from `apps/web`): `npx tsc -p tsconfig.json --noEmit` (clean).
Manual: vault shows correct chips per saved verdict; face-only card renders a face thumbnail + AURA badge.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/vault/SoloMode.tsx
git commit -m "feat(vault): cards show the assets each scan produced"
```

---

## Task 6: Export only present cards

**Files:**
- Modify: `apps/web/src/lib/exportCard.ts`

- [ ] **Step 1: Skip absent cards**

In `downloadResult` / `shareResult` (and any "download all 3" path), build the export set from the present parts:

```ts
  const kinds = [
    result.face ? 'face' : null,
    result.outfit ? 'outfit' : null,
    'receipt',
  ].filter(Boolean) as Array<'face' | 'outfit' | 'receipt'>;
```

Iterate `kinds` instead of a hardcoded `['face','outfit','receipt']`. Any single-card render path that reads `result.face`/`result.outfit` must early-return when null (Phase 1 added guards; confirm they hold).

- [ ] **Step 2: Verify + manual**

Run (from `apps/web`): `npx tsc -p tsconfig.json --noEmit` (clean).
Manual: download from an outfit-only result yields outfit + receipt only (no blank face card).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/exportCard.ts
git commit -m "feat(export): export only the cards a scan produced"
```

---

## Task 7: Full verification + dev-log

- [ ] **Step 1: Full gate**

Run (from `apps/web`):
```bash
npx tsc -p tsconfig.json --noEmit
npx vitest run
```
Expected: tsc clean; all tests pass.

- [ ] **Step 2: End-to-end manual QA (all three modes)**

For each of face-only, outfit-only, both: upload → scan animation variant → result tabs → save → vault chips/thumbnail → download. Plus the back-from-result guard (Phase 1 scanGuards) for a partial scan (no credit re-spend).

- [ ] **Step 3: Dev-log + commit**

Write `docs/dev-log/0XX-partial-scans-phase-2.md`, then:

```bash
git add docs/dev-log
git commit -m "docs: dev-log for partial-scans phase 2"
```

---

## Self-Review Notes

- **Spec coverage:** §2.1 (Task 1), §2.2 (Task 2), §2.3 (Task 3), §2.4 (Task 4), §2.5 (Task 5), §2.6 (Task 6), §2.7 (Task 7). ✓
- **Type consistency:** `parts`/`ScanParts`, `canScanPhotos`, `result.parts`, `tabs` derivation, `activeStagesFor`/`stageAtIn` — consistent across tasks and with Phase 1.
- **Trickiest task:** Task 4 (Result.tsx tab remap). Do it in isolation, lean on tsc + the manual hash-fallback check.
- **Credit cost unchanged** (1 credit) — no pricing touch.
