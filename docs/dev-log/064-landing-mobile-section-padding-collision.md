# 064 — Landing mobile fix: `.ln-section` + `.ln-wrap` padding-shorthand collision

**Date:** 2026-06-23
**Scope:** One-line root cause, four-line CSS fix in `apps/web/src/design/landing.css`. Mobile only (visible), latent on desktop.

## Symptom
On phones, a few landing blocks ignored the page gutter the others respected: the
big Anton headings (`.ln-h2` "DISTINCT CARDS / ONE VERDICT", `.ln-distinct-title`
"MAIN CHARACTER") and the `.rs-breakgrid` score cards bled to / past the left
screen edge, while the eyebrows, the bundle-note box, and the caption looked
inset. Reported as "some blocks don't go with the assigned grids like the others."

## Root cause (the lesson)
Two layout helpers were both applied to the **same element** on three sections —
`<section className="ln-section ln-wrap">` (Artifacts `#outputs`, Privacy
`#privacy`, the final CTA) — and **both set the `padding` *shorthand***:

- `.ln-wrap { padding: 0 20px }`  → horizontal gutter
- `.ln-section { padding: <clamp> 0 }` → vertical rhythm

Single-class selectors → **equal specificity**, so the cascade falls back to
**source order**. In the mobile `@media` block, `.ln-section` (line 420) is
declared *after* `.ln-wrap` (line 408), so its shorthand wins and rewrites **all
four** sides — zeroing the horizontal padding. A `padding` shorthand can't
"merge" with another; it always resets the longhands it omits.

The "good" sections (How / Modes / Credits) never hit this because they keep the
classes on **separate** elements: `<section class="ln-section alt"><div class="ln-wrap">`.
The eyebrow only *looked* inset because of its `::before` accent dash — measured
`padding-left: 0`, `left: 0`, same as the heading.

## Fix
Give each helper a single axis via longhand so they **compose** on one element:

- `.ln-wrap` → `padding-inline` (both breakpoints)
- `.ln-section` → `padding-block` (both breakpoints)

Hero (`.ln-hero.ln-wrap`) is untouched — it's not a `.ln-section`, and its own
`padding-block` shorthand still resolves to 20px inline on mobile / 0 on desktop
exactly as before (verified).

## Verification (Playwright @ 390×844, computed styles + screenshots)
- Before: `#outputs` / `#privacy` `padding-left/right = 0`; `.ln-h2`,
  `.ln-distinct-title`, `.rs-breakgrid` all at `left: 0` (flush to edge).
- After: `#outputs` / `#privacy` `padding-left/right = 20px`, vertical 52px
  preserved; the three offenders now at `left: 20`. `#how .ln-wrap` unchanged
  (20px). `.ln-hero h1` unchanged (`left: 20`). No horizontal overflow
  (`scrollWidth == innerWidth`). Visually confirmed the heading + card grid sit
  in the gutter.

## Takeaway
Never stack two `padding`/`margin` **shorthands** on the same element for
different axes — they clobber, and the winner is just whichever is later in
source order. Use `padding-inline` / `padding-block` (or longhands) when one
element wears two layout-helper classes.
