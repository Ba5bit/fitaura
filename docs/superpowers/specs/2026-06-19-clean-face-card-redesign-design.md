# Clean Face Card Redesign — Design

- **Date:** 2026-06-19
- **Status:** Draft for review
- **Author:** brainstormed with Claude
- **Area:** `apps/web` (Clean face skin, result wiring), `components/cards/skins`

---

## 1. Summary

Redesign the **Clean face skin** (`CleanFace`) so selfies stop getting stretched
and the card reads with the same type hierarchy as the outfit card. The photo
becomes a **contained, naturally-cropped block** at the top; the verdict,
punchline, and roast ride a scrim at the bottom of the photo; and a **solid info
block** below carries the four face stats as **Clean pill chips** plus a footer
read label.

Scope is the **Clean face skin only**. Dossier and Lore faces, the Clean *outfit*
card, and all other skins are untouched — this is the first of a card-by-card
pass ("01 Face").

## 2. Problem with the current card

`CleanFace` is full-bleed: the photo fills the entire 360×640 card and the
verdict + 3 stat chips + roast sit on a bottom scrim. A portrait selfie cropped
to a 360×640 frame is zoomed/cut unflatteringly ("stretches the image — looks bad
with selfies"). There is also no bold subtitle tier between the big headline and
the thin roast, so the hierarchy reads flat next to the outfit card.

## 3. Decisions (locked with the user)

| Topic | Decision |
|---|---|
| Photo | **Contained** block at top (natural `object-fit: cover` crop), not full-bleed |
| Text placement | **verdict → punchline → roast**, stacked on a scrim at the **bottom of the photo** |
| Roast order | **Below the punchline** (directly) |
| Punchline source | The result's **`finalPunchline`** (e.g. "AURA FARMER") — band/gender-aware |
| Score box | **Removed** (no top-right AURA box; aura still shows in the stat chips) |
| Bottom block | **Solid info block** with the four stats as **Clean pill chips** + footer read |
| Stat treatment | **Clean pill chips** (rounded), not a 2×2 grid-with-bars |
| Type hierarchy | Matches the outfit card: display headline → bold uppercase punchline → thin roast |
| Accent / gender | Unchanged — accent follows `--accent` (magenta for femme via `gender-theme.css`) |
| Scope | **Clean face skin only** |

## 4. Layout

```
┌──────────────────────┐
│ FITAURA              │   contained photo (~360px tall frame,
│  ▓▓ PHOTO ▓▓  [STKR] │   object-fit cover → natural crop),
│  ▓ contained ▓       │   rounded top. Overlays: FITAURA
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓      │   watermark + editable sticker.
│  MAIN CHARACTER      │   verdict (2nd part accent)  ─┐
│  AURA FARMER         │   punchline = finalPunchline  │ on photo
│  the cap's shadow…   │   roast, below the punchline  ─┘ scrim
├──────────────────────┤   ← solid info block (--bg-1)
│ ╰AURA·72╯  ╰AGE·26╯   │   four stats as Clean pill chips
│ ╰FEMME·73╯ ╰MAIN·94╯  │   (Est. Age shows "26 y.o.")
│ FACE / VIBE READ     │   mono dim footer label
└──────────────────────┘
```

- The card stays **360×640** so it slots into the existing switcher/export mounts
  with no layout changes around it.
- Photo region ≈ top 58%; solid info block ≈ bottom 42% (tunable so the chips +
  footer never clip).

## 5. Content mapping

All from existing result data — **no AI/schema change, no edge redeploy**.

| Element | Source |
|---|---|
| Verdict (2-part) | `content.verdict` (`[0]` plain, `[1]` accent) |
| Punchline | `result.receipt.finalPunchline` (new `SkinProps.punchline`) |
| Roast | `result.face.analysis.roast` (already passed as `roast`) |
| Stat chips | `content.scores` — Aura, Est. Age (`displayValue` "26 y.o.", `noBar`), Femininity/Masculinity, Main Character |
| FITAURA watermark | static |
| Footer read | static "FACE / VIBE READ" |

The four face scores already arrive in the right order from `assemble.ts`
(`aura`, `age`, `gender-index`, `main-character`), so the chips render directly
from `content.scores` (all four, vs. the current `slice(0,3)`).

## 6. Implementation surface

- **`components/cards/skins/types.ts`** — add `punchline?: string` to `SkinProps`.
- **`components/cards/skins/CleanFace.tsx`** — restructure to: contained photo +
  watermark + photo-scrim text stack (verdict/punchline/roast) + solid info block
  (pill chips + footer). Reuses `CardImage`.
- **`design/clean-skin.css`** — new rules for the contained photo frame, the
  photo-bottom scrim, and the solid info block. **Scope new rules to the face
  variant** (e.g. under `.clean-card[data-kind="face"]` or a new `.cleanface-*`
  namespace) so `CleanOutfit` (which shares `.clean-card`) is unaffected.
- **`features/result/Result.tsx`** — pass `punchline={result.receipt.finalPunchline}`
  to the face skin at **both** call sites: the `CardSwitcher` `skinProps` (~L501)
  and the export host `FaceSkinComp` (~L725). Outfit skin unaffected.

## 7. Sticker / export

- The editable sticker overlay still rides on the **front** skin from the Result
  page; its default anchor should land on the **contained photo** region (the
  shared sticker `pos` from 058 still applies — verify the default sits on the
  photo, not the solid block).
- Export is snapdom over the real DOM — the contained photo + scrim + solid block
  rasterize faithfully. The export host renders the active skin, so downloads
  match on-screen.

## 8. Testing

- **Visual / manual:** femme + masc × red/normie/green verdicts — selfie crops
  look natural (not stretched); verdict→punchline→roast stack on the photo;
  pill chips show all four stats incl. "26 y.o." with no bar; footer read renders;
  export WYSIWYG parity (incl. the scrim + chips); sticker still drags on the photo.
- **Switcher:** Clean face still switches/peeks correctly; Dossier + Lore faces
  and both outfit cards visually unchanged.
- **Regression:** `CleanOutfit` unchanged (confirms the CSS scoping held).

## 9. Risks / watch-list

- **Shared `.clean-card` CSS** — `CleanFace` and `CleanOutfit` share the class;
  new face rules must be scoped so the outfit card doesn't shift.
- **Vertical budget** — verdict + punchline + roast on the photo plus chips +
  footer below is tight in 640px; size the text tiers and cap roast length so
  nothing clips at 2–3 line verdicts.
- **Punchline reuse** — `finalPunchline` also appears on the receipt; showing it
  on the face card is intentional reinforcement, not a bug.
