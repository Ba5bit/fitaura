# Dev Log

A running, study-oriented record of crucial development steps on Fitaura. Each
entry explains **what** was done, **why**, and **what a future agent should know**
before touching that area — not just a changelog.

## Conventions

- One file per work session / milestone: `NNN-short-slug.md` (zero-padded, increasing).
- Date each entry (absolute dates, not "today").
- Write for a future agent with **no memory of the session**. Capture decisions,
  trade-offs, conflicts resolved, and gotchas — the things not obvious from the
  code itself.
- When a decision reverses a previous one, link the earlier entry and say why.
- Keep prose tight. Code/paths in backticks. Prefer "decision → reason → caveat".

## When to add an entry

After any crucial step:
- new architecture / folder layout or stack choices
- a feature or flow built or significantly changed
- a non-obvious bug found and fixed (with root cause)
- a conflict between sources of truth resolved
- anything a future agent could get wrong without context

## Index

- [001 — Initial frontend build from imported design](001-initial-frontend-build.md)
- [002 — Fix: "Scan my aura" didn't proceed (hidden confirm-crop gate)](002-fix-scan-cta-confirm-gate.md)
- [003 — "Scan my aura" jumped to pricing: out-of-credits flow + mock checkout](003-out-of-credits-flow-and-mock-checkout.md)
- [004 — Outfit "Fit & Physique Read": supporting stats group](004-outfit-supporting-stats.md)
- [005 — Disable credit enforcement until the backend lands](005-disable-credit-enforcement-pre-backend.md)
- [006 — Supporting stats: segmented bar → thin performance line](006-supporting-stats-performance-lines.md)
- [007 — Integrate Card Studio into the Verdict page](007-integrate-card-studio-into-verdict-page.md)
- [008 — Integrate account, profile & monetization](008-account-profile-monetization.md)
- [009 — Fix font fallback in downloaded card export](009-fix-export-font-embedding.md)
- [010 — Fix accent contrast on the thermal receipt](010-fix-thermal-receipt-accent-contrast.md)
- [011 — Logo as home navigation on the Result page](011-logo-home-navigation.md)
- [012 — Vault dashboard (v3 IA): account area → Card Vault](012-vault-dashboard.md)
- [013 — Frontend stabilization (audit fixes)](013-frontend-stabilization.md)
- [014 — Supabase auth + per-account credits (Cycle 1)](014-supabase-auth-credits.md)
- [015 — Gemini 2.5 Flash Solo Scan (Cycle 3)](015-gemini-solo-scan.md)
- [016 — Vercel Speed Insights + transparent primary CTAs](016-speed-insights-and-transparent-ctas.md)
- [017 — "How your data is stored" back control returns to origin, not the vault](017-authgate-data-storage-back-target.md)
- [018 — Landing v2: multi-mode hero, Scan Modes section, scroll-spy rail](018-landing-v2-hero-modes-rail.md)
- [019 — Landing v2: header nav rework (Home / Vault pills)](019-landing-v2-header-nav.md)
- [020 — Nav polish: de-glow landing Vault pill + credit chip on the Vault nav](020-nav-sync-vault-credit-chip.md)
- [021 — Nav parity: match Landing/Vault sizes + active pill follows current page](021-nav-sync-sizes-and-active-page.md)
- [022 — Auth modal: close button no longer overlaps the Sign up / Log in tabs](022-auth-modal-close-button-overlap.md)
- [023 — Remove trailing arrows from CTA buttons](023-remove-cta-trailing-arrows.md)
- [024 — Sync the back-button shape (Upload page → `.vlt-back` pill)](024-sync-back-button-shape.md)
- [025 — CTAs use the "Generate verdict" tinted fill](025-cta-tinted-fill-match-generate-verdict.md)
- [026 — Scan page: keep scroll, pin the action bar to the bottom](026-scan-sticky-cta-bar.md)
- [027 — Remove "Looks good"; crop applies live](027-remove-looks-good-live-crop.md)
- [029 — Landing: smooth-scroll in-page anchor jumps (+ revert auto-hide nav)](029-landing-smooth-anchor-scroll.md)
- [030 — Fix: logout impossible (Supabase auth-lock deadlock)](030-fix-logout-auth-lock-deadlock.md)
- [031 — Auth modal: full-width Sign up/Log in toggle + smaller close button](031-auth-seg-full-width-smaller-close.md)
- [032 — Auth modal: Enter submits sign-up / log-in](032-auth-enter-submits.md)
- [033 — Mobile: hero card-fan overflowed into the next section](033-mobile-hero-fan-overflow.md)
- [034 — Landing: final CTA gets the elevated-panel background](034-final-cta-panel.md)
- [035 — Landing: remove the "A single scan unlocks everything" bundle section](035-remove-bundle-section.md)
- [036 — Landing: add a "Full analysis" section + resequence](036-landing-full-analysis-section.md)
- [037 — Fix: card export broken on Safari (blank photo, partial render)](037-fix-card-export-safari.md)
- [038 — Auth-gated scan + generation synced to the animation](038-auth-gated-scan-sync.md)
- [039 — Card export: switch html-to-image → snapdom (Safari fidelity)](039-export-snapdom-safari-fidelity.md)
- [040 — Vercel SPA fallback (fix reload 404 on client routes)](040-vercel-spa-fallback.md)
- [041 — Score diversity (0–100) + caption bank expansion](041-score-diversity-caption-bank.md)
- [042 — Solo Scan v3: gender-aware scoring, icon recognition, savage voice](042-solo-scan-v3.md)
- [043 — Frontend tweaks: webcam capture, full-bleed scan, sticker cycle, glow + save-button cleanup](043-frontend-tweaks-webcam-scan-stickers.md)
- [044 — Email confirmation, password reset & registration credit grant](044-auth-email-confirmation-and-reset.md)
- [045 — Solo Scan v3.1: meme glory vs honest celebrity](045-meme-glory-vs-honest-celebrity.md)

> Note: there is no entry 028 (number skipped during the v3 work; not a missing file).
