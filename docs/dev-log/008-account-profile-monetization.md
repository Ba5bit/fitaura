# 008 — Integrate account, profile & monetization

**Date:** 2026-06-11
**Scope:** New `features/account/` module + nav wiring + generation history.
**Ask:** merge the supplied account/profile/monetization experience into FitAura so
it feels native — not a separate dashboard/template. No new pricing system, no
placeholder data.

---

## Source files reviewed (~/Downloads)

`account-web-app.jsx`, `account-web-account.jsx`, `account-web-ui.jsx`,
`account-web-pay.jsx`, `account-web.css`, `Fitaura Account Web.html`. (The HTML
referenced an `account-data.jsx` that wasn't supplied — it only held demo
placeholders `AC_ACCOUNT/AC_PACKS/AC_RESULTS` + `AIco`, which we replace with real
FitAura data, so nothing was missing functionally.)

The supplied app is a **design harness**: `aw-stage` = a navigator rail + fake
browser frame driving every MVP state. The harness, rail, demo `SiteNav`, and the
Tweaks panel were **not** ported. The product surfaces inside it were.

## What was integrated

**State**
- `state/generation.tsx` — added a capped on-device `history` of full results
  (newest first, cap 4), `openResult(id)`, and **legacy-state coercion**
  (`{ ...INITIAL, ...rawState, history: rawState.history ?? [] }`) so older stored
  state without newer fields can't crash.
- `features/account/AccountContext.tsx` — auth (`signedIn`, `user`, `signIn`,
  `requestLogout`/`confirmLogout`), the overlay **scene machine**
  (`auth | paywall | checkout | processing | success | failure | logout | missing`),
  selected `pack`, the **buy flow** (`startCheckout` → `pay` → processing →
  success → `addCredits`), and a global toast. Auth persists to `fitaura.account`.

**Modals / dialogs** (`AccountModals.tsx` + `AccountOverlays.tsx` host):
AuthGate, Paywall, Checkout (confirm + embedded card), Processing, PaySuccess,
PayFailure, LogoutConfirm, MissingResult — ported, wired to real `CREDIT_PACKS`
and the live credit balance. `WebModal`/`WebField` atoms ported.

**Pages / routes** (`AccountDashboard`, `CreditsPage`, `StoragePage`, `ResultsPage`):
`/account`, `/credits`, `/storage`, `/results` — share a ported `AccountNav`
(brand + links + balance chip + avatar). Real user email/initial/"member since",
real credit balance, real on-device history grid (`ResultTile` + `useResultTiles`).

**Nav entry points**
- `AccountEntry` (chip + avatar) embedded into the landing `Nav`; avatar → `/account`
  when signed in, else opens the AuthGate. Guest chip shows "1 FREE VERDICT".
- Result-page header avatar + credits button wired to `/account` / `/credits` / auth.
- The landing pricing packs now route through the **same checkout funnel** (replacing
  the earlier instant-grant mock from log 003).

## Data mapping (placeholders → real)

- `AC_PACKS` → `@fitaura/shared` `CREDIT_PACKS` ($4.99/5, $11.99/15 featured,
  $29.99/40). `acMoney(price)` → `pack.price` string directly.
- `AC_ACCOUNT` → the signed-in `user` (email from the gate field / OAuth, initial,
  "MEMBER SINCE <mon year>").
- `AC_RESULTS`/`AC_VERDICTS` → on-device `history` + shared `VERDICT_LABEL` /
  `VERDICT_COLOR_VAR`.

## Decisions / gotchas

- **Credit enforcement stays OFF** (log 005). Buying works and increases the balance;
  scans still don't consume or block. The Paywall / out-of-credits gate is wired and
  ready behind `CREDITS_ENFORCED` for when the backend lands.
- `account-web.css` shipped harness globals — **stripped** `html,body{overflow:hidden}`
  (would kill app scroll) and switched `.aw-scrim`/`.aw-toast` from `position:absolute`
  (scoped to the demo browser frame) to `fixed` so modals overlay the real viewport.
- Auth/credits are **mock + device-local** (no Supabase yet). When the backend lands,
  the credit ledger + auth become server-authoritative; the UI is already shaped for it.
- Dev server must be restarted after adding the providers (HMR served a stale module
  during testing → modal didn't open until a hard reload).

## Verification

- `npm run typecheck` + `npm run build` clean.
- Playwright: landing nav shows the chip + guest avatar; avatar → AuthGate (two-column,
  OAuth, fields); sign-in → `/credits`; select Starter → Checkout ($4.99) → Pay →
  Processing → Success (+5, "New balance 5 credits"), `credits` persisted = 5;
  `/account` shows real email/`MEMBER SINCE JUN 2026`/balance 5 + recent-verdicts empty
  state; `/storage` renders the server-vs-local explainer. Console clean (favicon only).

## Follow-ups

- Wire real Supabase Auth + a server credit ledger; flip `CREDITS_ENFORCED` on.
- Replace the mock payment with Stripe (the Checkout funnel + receipt UI are ready).
- Optional: PayDuplicate / redirect-vs-embedded variants (ported design exists) once a
  real PSP can trigger those states.
