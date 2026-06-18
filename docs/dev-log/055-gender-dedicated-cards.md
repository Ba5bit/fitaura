# 055 — Gender-Dedicated Cards (Phase A pt1)

**Date:** 2026-06-18
**Spec:** `docs/superpowers/specs/2026-06-18-gender-skins-card-stack-design.md`
**Plan:** `docs/superpowers/plans/2026-06-18-gender-dedicated-cards.md`
**Branch:** `feat/gender-dedicated-cards` → fast-forward merged to `main` (`c4f8e50`, not pushed)

## Goal

Give female submissions a *visually* distinct, dedicated card identity (magenta + gold) and a gender-correct sticker picker, driven by the gender the AI already detects. Male/unsure stays the current icy/cyan. Gender is **fixed per scan** — there is no toggle; the only "mode switching" (coming in a later phase) is skin/style, never gender.

## The key insight

The system was *already* gender-aware on **content** and we almost rebuilt it. `assemble.ts` resolves `confidentlyFemme = gender === 'femme' && genderConfidence >= 0.60` and forks every banked pick on it — archetypes (`SHE IS MOTHER` vs `GIGACHAD`), captions (`LET HER COOK`), punchlines, and the Femininity/Masculinity index label. What was missing was purely **visual**: the assembled `FullGenerationResult` *dropped the gender flag*, so the Result page had no way to theme. So the whole feature reduces to: **surface the one value that was already computed, and react to it.**

Second insight: the palette already existed. `:root` in `fitaura.css` defines `--magenta` and `--gold`. So "femme identity" is a *scoped variable remap*, not new CSS colors — matching the rule "use the system's colors, don't replicate the prototype's."

## What changed

1. **`gender` on the model** (`packages/shared/src/result.ts`, `assemble.ts`). One field on `FullGenerationResult`, set from the existing `contentGender`. A `genderOf(r)` helper mirrors `partsOf` and defaults legacy rows to `masc`.
2. **Gender-filtered stickers** (`sticker-bank.ts`). Each `StickerPreset` gained an optional `gender` tag (untagged = neutral) plus a `femmeLabel` override (`unc`→`AUNTIE STATUS`, `let-him-cook`→`LET HER COOK`). `stickersFor(kind, gender)` returns neutral + own-gender, applying femme labels. Classification was *derived from the gender marks already in `content-bank.ts`*, not invented.
3. **Result page** (`Result.tsx`). Derives `gender = genderOf(result)`, feeds the picker + swap-cycle from `stickersFor(...)` (with a `Math.min` clamp so a stored index can't overflow the shorter filtered list), and stamps `data-gender` on the card mount **and all three offscreen export wrappers** (so exports are themed too).
4. **Femme theme** (`apps/web/src/design/gender-theme.css`). Scoped to `.rs-card-mount[data-gender="femme"]` / `.rs-export-card[...]`: remaps `--accent → --magenta` (recolors the whole card since everything paints off `--accent`) + gold wordmark/footer + a magenta→gold selfie-ring conic. Scoping to the card subtree keeps page chrome on the brand accent.
5. **Mock data** (`mockGenerations.ts`). `gender` added to all three mocks (one femme for local smoke); fixed the femme mock's score label to `Femininity`.

## Gotchas / things worth remembering

- **The edge function must be redeployed for this to go live.** `assembleResult` runs server-side in `supabase/functions/solo-scan`. A `git push` (or local merge) does nothing for it. No version bump is needed here — the AI prompt/schema are unchanged; only the *assembled* output gained a field. See [[fitaura-solo-scan-deploy]]. Until redeploy, live results have no `gender` and `genderOf` defaults them to masc.
- **`gender` is required on the type**, so the compiler forces every constructor (assemble + mocks) to set it — a deliberate way to catch missed sites. `genderOf` handles *runtime* legacy reads from IndexedDB.
- **Export theming "just works"** because snapdom rasterizes the real DOM; the `data-gender` on the export wrappers carries the same scoped variables into the capture.
- Removing `STICKER_BANK` from `Result.tsx` required dropping it from the import (else `noUnusedLocals` trips) and updating a stale comment.

## Testing

`npm run test --workspace @fitaura/web` → 20 files, **148 tests pass**. New: `assembleGender.test.ts` (gender resolution + `genderOf` legacy default), `stickerBank.test.ts` (gender exclusivity + femme label override). `npm run build` clean. Executed via subagent-driven TDD (implementer + spec review + code-quality review per task, then a holistic final review = "ready to merge").

## Follow-ups

- [ ] **Redeploy `solo-scan`** (manual) — makes it live.
- [ ] Premium QR receipt (Phase A pt2) — own plan.
- [ ] Clean/Lore skins + card-stack switcher (Phase B) — own plan.
