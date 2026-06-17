# 050 — UX refresh: review tweaks + ship (edge v3.3)

Follows `049`. After visual review on a dev server, a round of tweaks landed on
`feat/ux-refresh`, then it merged to `main` and the edge function redeployed to **v3.3
(version 9, ACTIVE)**. Frontend ships via Vercel on the `main` merge.

## Review-round tweaks
- **Distinct-cards fan** now matches the hero exactly: symmetric left/right fan at hero card
  sizes (the earlier downscaled stack looked tiny on mobile). Added **dot indicators** below
  the fan (white = active, clickable to jump). `CardFan` gained a `goTo()`.
- **Pricing** → **$3.99 / $9.99 / $14.99** (per-scan $0.40 / $0.33 / $0.19). Display-only
  (`pricing.ts`); the checkout funnel grants credits without a real charge.
- **Roast on cards**: removed the leading quote glyph; bumped to **19px / 2-line clamp**;
  shrank the face circle (264→220) so the verdict + roast breathe; lifted the **outfit** roast
  up under the verdict with clear space before the stats.
- **AI age estimate (new, schema v3.2→v3.3):** the model now returns
  `presentation.ageEstimate`; the face card's 2nd slot shows **"X y.o." with no bar**
  (`ScoreItem.noBar`), and **Haircut Match moved to the score breakdown**. Sourced via a card
  prop from existing data; mocks carry fixed ages.
- **Roast quality (prompt):** capped copy at ~10 words and banned the repeated openers
  ("This fit…", "Giving…", "…in human form", "gives the vibe of") for more variety.

## Why the two AI changes shipped together
Age estimate + the new roast voice both live in the **edge function (v3.3)**. The card now
renders an age slot + no-bar handling that the *old* frontend lacked, so redeploying the edge
before the frontend was live would have glitched production. They were therefore coupled:
**merge the frontend → redeploy the edge** in the same step, so v3.3 output and the v3.3-aware
frontend went live together.

## Verification
`tsc` clean, **116 tests**, `vite build` OK. Edge `list_edge_functions` → solo-scan **v9
ACTIVE**. Real scans now return an age + tighter, varied roasts; existing saved verdicts
(v3.2) still render fine (the card reads whatever `scores` it has).

## Notes
- `cardFan.ts`→`cardFanCycle.ts` rename (Windows case-collision with `CardFan.tsx`) from `049`.
- Receipt untouched, per the product call.
