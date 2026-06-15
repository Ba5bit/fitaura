# 035 — Landing: remove the "A single scan unlocks everything" bundle section

## Ask

Too many "scan" CTAs on the landing. Remove the Bundle section entirely (the
"A SINGLE SCAN UNLOCKS EVERYTHING" checklist + the "1 SCAN = 3 CARDS" credit box
with its "Run your first scan free" button).

## Change

- `Landing.tsx`: deleted the `Bundle` component and its `<Bundle />` in the page
  order. Modes now flows straight into Credits.
- `landing.css`: removed the now-dead BUNDLE block (`.ln-bundle-grid`,
  `.ln-bundle-list` + descendants, `.ln-credit-box` + `::before`/`.one`/`.one-sub`)
  and the `.ln-bundle-grid` mobile override. Kept `.ln-bundle-note` — that class
  belongs to the Artifacts section, not Bundle.

The remaining scan CTAs: hero ("Scan me — it's free"), each Modes card, the
Credits packs, the final CTA, and the sticky mobile bar.

## Verification

Dev server + Playwright (1280-wide): Bundle gone (`.ln-bundle-grid` absent),
Modes → Credits transition clean with normal section spacing. tsc clean.

## Files

- `apps/web/src/features/landing/Landing.tsx`
- `apps/web/src/design/landing.css`
