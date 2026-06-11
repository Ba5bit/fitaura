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
