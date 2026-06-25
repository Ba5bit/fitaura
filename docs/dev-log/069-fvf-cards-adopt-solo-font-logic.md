# 069 — FvF cards adopt Solo Scan's font logic (fewer bold weights)

**Date:** 2026-06-23
**Area:** `apps/web` — `versus.css`
**Follows:** [068](068-fvf-face-duel-card-and-medallion-removal.md)

## Why

The FvF cards diverged from the Solo face/outfit cards — too much **bold** sans.
Solo's type system is restrained and has three clear roles:

- **Anton** (weight 400) → *all* display / identity text — score (56px), caption
  (30px), verdict line (38px). Condensed, reads strong without a bold weight.
- **Space Mono** (regular) → *every* small label / eyebrow / meta / kind-tag.
- **Hanken Grotesk 800** → reserved for the **FITAURA wordmark** + **stat values**
  (`MiniStat .val`). That's the only bold on a Solo card.

FvF was using bold sans for **names** and the **footer URL**, which piled extra
800/700 weight onto the cards.

## Changes (`versus.css`)

- `.vs-card.is-duel .dside .nm` (duel-card name): Hanken **800** 22px →
  **Anton 27px** uppercase. Mirrors Solo's eyebrow→Anton rhythm (the name is the
  card's display line, like the verdict line).
- `.vs-col .nm` (comparison-tab contender name): Hanken **800** 18px →
  **Anton 21px** uppercase — same element, kept consistent across the FvF result.
- `.vs-card .cfoot .url` (classic-card footer): Hanken **700** → **Space Mono**
  `kind-tag` style (Solo footers use a Space Mono kind-tag, not bold sans).
- `.vs-card.is-duel .dhalf.b` divider: custom `#fff 13%` → the shared `var(--hair)`
  token.

Net: the only Hanken-800 left on a card is the **wordmark + stat values** (chip
values / split-bar values) — exactly Solo's pattern. Names and the headline
winner are Anton; all labels are Space Mono.

## Verification

- Drove the verdict stack on the dev server (seeded battle, dev fallback) and
  screenshotted: the **face duel card** ("MAYA"/"THEO" now Anton, only the chip
  values + wordmark bold) and the **face comparison deck** (column names now Anton,
  consistent with the score). Reads noticeably calmer / closer to Solo.

## Notes

- Earlier (068) the reference mockup used a bold-sans name; this instruction
  (adopt Solo's font logic, fewer bolds) supersedes that — names are now Anton.
- Chip / split-bar **values** stay Hanken 800 (that's the sanctioned Solo bold).
- The breakdown panel (`.vs-bd`) still has a couple of bold spots (punchline,
  superlative name) that mirror Solo's roast/value bolds — left as-is. Easy to
  tone down further if the user wants the whole result page swept.
- Push held per the iterative-session convention.

## Follow-up — card FITAURA wordmark sized to Solo's proportion

`.vs-card .cardtop .wm`: **11px → 8.5px**. The FvF share card is 274px wide vs the
Solo face/outfit card's 360px, so an 11px wordmark (identical *absolute* size to
Solo's `.brand-tag`) looked ~31% larger relative to the smaller card. 11 × 274/360
≈ 8.4 → **8.5px** so FITAURA reads the same *proportional* size as on a Solo card.
Applies to both the duel and classic card variants. (Page header `.rs-wm` was
already identical to Solo at 13px — untouched.)
