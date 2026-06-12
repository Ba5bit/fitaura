# FitAura Frontend Audit — 2026-06-12

Inspection-only audit of `apps/web` against `aura_project_context_vault_flow_v3.md`
(Vault IA: Landing → Vault → Generate → upload → scanner → Result → back to Vault;
scan-first / account-optional). **No code was changed.** Goal: stabilize the
frontend before Supabase auth, DB persistence, credits, payments, and server-side
generation.

Stack: Vite 6 + React 18 + TS, react-router-dom 6, html-to-image. State via React
context + localStorage. No backend yet (`apps/api` does not exist). `tsc --noEmit`
and `vite build` are clean.

## Severity legend
- **P0** — blocker / real bug / must-fix before backework
- **P1** — important; fix during stabilization
- **P2** — cleanup / polish

## Top priorities (summary)
| # | Finding | Sev | Evidence |
|---|---------|-----|----------|
| A | Upload & Scanner never render their mobile layout | P0 | `Upload.tsx:33`, `Scan.tsx:197` hardcode `data-mobile="false"`; mobile CSS keyed on `[data-mobile="true"]` (`upload.css:104-130`, `scanner.css:23-287`) |
| B | Credits/free-scan are client-authoritative (forgeable) | P0 (backend) | `state/generation.tsx:23-43,107,138-140` |
| C | Two parallel design systems (`.aw-*` vs `.vlt-*`) + ~40% dead CSS | P1 | `account-web.css` (443 lines) vs `vault.css` (415); grep below |
| D | Offscreen export hosts: 3 full card trees always mounted | P1 | `Result.tsx:583-609`, `.rs-exporthost` `sticker-studio.css:249` |
| E | No ErrorBoundary anywhere (any render error → white screen) | P1 | grep: none |
| F | No automated tests, no ESLint | P1 | no `*.test.*`, no eslint config |
| G | Mobile nav burger is non-functional | P1 | `Landing.tsx:45-47` (no onClick) |
| H | Mock auth/checkout assume sync + always-succeed; no API layer | P1 (backend) | `AccountContext.tsx:94-141`, `AccountModals.tsx` |

---

## 1. Functional bugs
- **P0 — Upload/Scanner not responsive.** `data-mobile` is hardcoded `"false"`
  (`Upload.tsx:33`, `Scan.tsx:197`). Every mobile rule is scoped to
  `[data-mobile="true"]` (`upload.css:104,126,130`; `scanner.css:23,33,56,61,162,167,177,224,225,262,287`).
  Result: on phones the two upload zones stay side-by-side and the scanner keeps
  its 2-column specimen+readout → overflow / unusable. The attribute is a leftover
  from the prototype's device-frame harness (`components.css:48` comment confirms).
- **P1 — Landing mobile nav dead.** `.ln-burger` button has no handler
  (`Landing.tsx:45-47`); on mobile `.ln-nav-links` is hidden and `.ln-burger`
  becomes `display:grid` (`landing.css:280`) but does nothing → the How/Verdict/
  Examples/Credits anchors are unreachable on mobile.
- **P1 — Obsolete route links rely on redirects.** `/storage` and `/results` are
  redirect-only (`App.tsx`), but modals still link to them: AuthGate "How your
  data is stored" → `/storage` (`AccountModals.tsx:96`); MissingResult "Back to
  results" → `/results` (`:451`) and "Why?" → `/storage` (`:459`). "Back to
  results" silently lands on the vault — confusing. Point these at `/settings` /
  `/vault`.
- **P2 — Object URLs leaked.** `UploadZone.tsx:153` `URL.createObjectURL(file)` is
  never `revokeObjectURL`'d on `reset()` (`:119`) or re-ingest (`:140`) → memory
  grows with each replace/remove.
- **P2 — favicon 404** on every page (console error; no icon link in `index.html`).

## 2. Broken / confusing UX flows
- **P1 — AuthGate copy stale.** Header reads "ACCOUNT REQUIRED TO BUY CREDITS"
  (`AccountModals.tsx:23`), but the gate is now also used to reveal the free
  verdict after a guest scan (`Scan.tsx` reveal flow). Misleading for that path.
- **P1 — Missing-result dialog** routes into dead IA (see 1).
- **P1 (backend) — No async generation flow.** `runGeneration` is synchronous
  (`generation.tsx:115-146`); the Result page has no loading/error state of its
  own (the Scanner animation stands in). When generation becomes a server request,
  the Result/Scan path needs real pending + failure + retry states.

## 3. Visual inconsistencies / conflicting systems
- **P1 — Two overlapping CSS systems.** `.aw-*` (`account-web.css`) and `.vlt-*`
  (`vault.css`) both define the same primitives with slightly different values:
  buttons (`aw-btn`/`vlt-btn`), credit packs (`aw-packs`/`vlt-packs`), unlock list
  (`aw-unlock`/`vlt-unlock`), balance, storage columns (`aw-store-*`/`vlt-store-*`),
  meter, eyebrow, h1, tags, panels, modals. The vault pages use `vlt-*`; the
  account modals use `aw-*`. Two sources of truth for the same look → drift risk.
- **P2 — Five+ button styles** across systems: `.aw-btn`, `.vlt-btn`, `.rs-*`
  buttons, `.ln-btn`, `.cbtn`/`.cta` (upload), `.btn` (scanner). Consolidate to a
  shared primitive layer (the existing `--accent` token already unifies color).

## 4. Responsive-layout problems
- See **1** (Upload/Scan no mobile; Landing burger dead) — the biggest gaps.
- **P2 — Result scale is a JS hack.** `Result.tsx:146-166` computes `--rs-scale`
  from viewport on resize. Works, but is imperative layout; verify on narrow
  screens and with the on-screen keyboard.

## 5. Performance / lag
- **P1 — Always-mounted offscreen export hosts.** On the Result page, 3 full card
  component trees (FaceCard + OutfitCard + Receipt, each with images, `Bars`
  barcode, stickers) are rendered off-screen at all times
  (`Result.tsx:583-609`; `.rs-exporthost { left:-10000px }` `sticker-studio.css:249`),
  in addition to the visible card → 4 card trees mounted concurrently. They're
  only needed during export. Render on demand (mount → capture → unmount).
- **P2 — Count-up timers.** `useCountUp` runs a 40ms `setInterval` per animated
  stat (`useCountUp.ts:17`); the analysis block remounts on every Result tab
  switch (`animKey`) re-firing all of them. Bursty but self-terminating.
- **P2 — Landing scroll listener** sets state on every scroll
  (`Landing.tsx:22-26`); React bails on unchanged value, so cheap, but could be
  a passive rAF-throttled check.

## 6. Duplicate / obsolete code
- **P1 — Dead CSS in `account-web.css`** (0 TSX references — verified by grep):
  - Design-tool "browser frame" chrome: `aw-stage`, `aw-rail`, `aw-browser`,
    `aw-chrome`, `aw-viewport`, `aw-lights`, `aw-url` (~lines 8-77) — never
    rendered by the React app (comment at `:14` admits it's "design tool chrome,
    NOT the product").
  - Old dashboard (deleted `AccountDashboard`): `aw-dash-grid/head`, `aw-acct-id/row`,
    `aw-balance` panel, `aw-results/result/meter`, `aw-section-h`, `aw-freebanner`,
    `aw-localnote` (~173-242).
  - Pack selector + unlock + storage explainer (~244-269, 397-417) — duplicated by
    the live `vlt-*` versions.
  Estimated ~40% of the 443-line file is unreachable.
- **P2 — Leftover mock id.** MissingResult fallback `'FA-2B6T'`
  (`AccountModals.tsx:420`) is a stray id from the old `AC_RESULTS` prototype data.

## 7. Unused code / assets / dependencies / styles
- **P2 — `uploaded/` prototypes** (~20 `.jsx/.css/.html/.md` files) are reference
  only — not imported by `src`. Keep out of the deploy bundle (already are), but
  they clutter the repo; move to `docs/` or a separate ref folder.
- **P2 — `apps/web/dist/`** committed build output (564 KB stale artifact).
- **P1 — No ESLint.** Root `lint` script is `--if-present` with no eslint
  dependency → dead code/styles/imports aren't caught automatically (this audit
  found them by hand). Add ESLint + `noUnusedLocals`/`noUnusedParameters`.
- Dependencies are lean (`react`, `react-dom`, `react-router-dom`,
  `html-to-image`) — no unused npm packages found.

## 8. Leftovers from previous flows
- `data-mobile` device-frame harness (see 1).
- `/storage` + `/results` redirect routes (`App.tsx`) and links to them.
- `.aw-*` dashboard / storage / packs CSS (see 6).
- Prototype `uploaded/` set (see 7).

## 9. Architecture problems for backend integration
- **P0 (backend) — Client-authoritative credits.** `credits` and `freeUsed` live
  in localStorage `fitaura.state` (`generation.tsx:23-43,86`); `addCredits` grants
  client-side (`:107`) and `runGeneration` consumes client-side (`:138-140`). A
  user can edit localStorage to mint credits. `CREDITS_ENFORCED=false` today
  (`:53`). Before payments, the credit ledger and free-scan flag MUST be
  server-authoritative; the client should only reflect server state.
- **P1 — One localStorage blob mixes trust domains.** `fitaura.state` holds
  server-domain data (credits/free) and device-domain data (photos/result/history)
  together. Split so the server owns credits/receipts and the device keeps only
  photos/results.
- **P1 — No API / service layer.** All flow logic lives directly in React contexts
  (`generation.tsx`, `AccountContext.tsx`). Introduce a thin client (auth,
  credits, generation, payments) so contexts call services, not mocks — this is
  where Supabase/payment calls will land.
- **P1 — Auth is fully mock & synchronous.** `signIn` fabricates a user for ANY
  email with no token/session (`AccountContext.tsx:94-109`), persisted in
  `fitaura.account`; OAuth buttons just call `signIn` with a canned email
  (`AccountModals.tsx:71-76`); password is never read (`:84`). Supabase replaces
  this and is async — current code has no loading/verify/error states for auth.
- **P1 — Checkout is mock.** `pay()` is a `setTimeout` that grants credits
  (`AccountContext.tsx:131-141`); card UI is hardcoded (`AccountModals.tsx:207-256`).
  Needs a real provider + server-side confirmation.
- Mock generation content (`data/mockGenerations.ts`) is the stand-in for the AI
  JSON — expected, but the result model is already typed (`@fitaura/shared`), which
  is good for the swap.

## 10. Security / privacy
- **P0 — Forgeable credits** (see 9) — the core issue once money is involved.
- **P1 — Raw card input.** The "Change → embedded" checkout renders a raw
  `<input>` for the card number (`AccountModals.tsx:237`). For real payments this
  must be a PCI-compliant tokenizing element (e.g. Stripe Elements iframe); a real
  PAN must never touch app state. (Currently mock, but the shape invites a mistake.)
- **P1 — localStorage image quota.** Photos are stored as data URLs in
  `fitaura.state` (`generation.tsx`); 2 full-res images × up to 4 history entries
  can exceed the ~5 MB localStorage budget, and `useLocalStorage` swallows
  `setItem` failures silently (`useLocalStorage.ts:18-24`) → silent loss of saved
  results. Move images to IndexedDB.
- Privacy posture is otherwise consistent with the rule ("photos on device, never
  server"). No `dangerouslySetInnerHTML`; React escaping intact.

## 11. Missing loading / error / empty states
- **P1 — No ErrorBoundary** (grep: none) → a single render throw blanks the app.
- **P1 — No async-aware states** for auth / generation / payment (all mock-sync
  today) — required once those become network calls.
- **P2 — CardImage** has no load-error fallback (`CardImage.tsx:25`) — a bad data
  URL shows a broken `<img>`.
- Present & good: Upload zone (`empty/uploading/ready/error` + validation,
  `UploadZone.tsx`), Vault/Solo empty state (`SoloMode.tsx`), export try/catch with
  toasts (`Result.tsx:206-243`).

## 12. Accessibility
- **P1 — Clickable non-buttons.** `span.lk` "How your data is stored"
  (`AccountModals.tsx:92`) and `span.chg` "Change" (`:212`) use `onClick` on
  spans — not focusable or keyboard-operable.
- **P1 — Modal focus management.** `WebModal` handles Esc + scrim click
  (`WebModal.tsx:15-35`) but has no focus trap and no focus return → keyboard
  users can tab to content behind the dialog.
- **P1 — Burger announces a dead control** (`aria-label="Menu"` with no action,
  `Landing.tsx:45`).
- **P2** — decorative `alt=""` on card images (`CardImage.tsx`); confirm the
  face/outfit aren't meant to be described. Tabs and zoom range have proper
  roles/labels (good).

## Other notes
- React Router v6 **future-flag warnings** in console (`v7_startTransition`,
  `v7_relativeSplatPath`) — add the `future` flags to `<BrowserRouter>` to silence
  and ease the v7 upgrade. (P2)
- StrictMode double-invoke is already handled correctly in `runGeneration` via
  `stateRef` (`generation.tsx:92-146`). (Good.)

## Suggested stabilization order (no backend work)
1. **P0 responsive:** wire `data-mobile` to a real breakpoint (or delete the
   attribute and convert those rules to `@media`) so Upload/Scan work on phones;
   give the Landing burger a real mobile menu.
2. **P0/P1 architecture seams (no backend):** extract a service layer + split the
   localStorage domains, and stop treating client credits as truth (gate UI on a
   "server will verify" assumption) — so the Supabase/payments swap is a drop-in.
3. **P1 cleanup:** delete dead `account-web.css`, consolidate `aw-*`/`vlt-*` into a
   shared primitive layer, add an ErrorBoundary, fix the a11y issues (focus trap,
   clickable spans), render export hosts on demand.
4. **P1 tooling:** add ESLint + `noUnusedLocals` and a minimal test setup before
   the integration.
5. **P2 polish:** remove `dist/`, relocate `uploaded/`, add favicon, revoke object
   URLs, set Router future flags, refresh stale modal copy/links.
