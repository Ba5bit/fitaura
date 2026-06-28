# Universal Register-at-Reveal (Confirmation OFF + Shared Reveal-Gate) — Design

- **Date:** 2026-06-28
- **Status:** 🟢 Approved — ready for implementation plan
- **Goal:** Make "scan first, register at the reveal" a single reusable funnel that works in-page for **every mode (Solo + Friend-vs-Friend) and future modes**, and kill the bug where a guest who registers at the reveal has to **re-upload their photos**.

---

## Context — why this change

Today a signed-out visitor runs a **teaser scan** with the free funnel, then hits a register wall at the reveal. The current sign-up path uses an **email confirmation link**: the user leaves to their inbox, clicks the link, and the app reloads in a fresh context. That reload drops both the in-memory auth redirect (`/scan/run`) **and** the guest's uploaded photos, so after confirming they land somewhere generic and must **resubmit their photos**. (Root cause traced 2026-06-26 in `VersusResult.tsx` + `AccountContext.tsx`; the 06-26 session designed an in-page 6-digit OTP fix but wrote no code.)

This design supersedes the OTP idea. The simpler root fix is to remove the reload entirely: **turn email confirmation OFF**. With it off, `supabase.auth.signUp` returns a live session synchronously, registration completes **in the same page**, and the existing in-page "resume" logic regenerates the verdict on the photos the guest already provided — no email, no link, no reload, no re-upload. As a bonus it removes the **Resend 100 emails/day** ceiling, which matters for a viral launch.

Scope was deliberately widened during brainstorming: the register-at-reveal funnel should be **one reusable pattern** used by all modes and future features — not copied per mode. Solo already implements this pattern locally; FvF does not (it spends credits up front and silently bounces guests to `/credits`). So this change also **brings FvF to parity** and **extracts the pattern into a shared hook**.

---

## Locked decisions

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | Verification mechanism | **Email confirmation OFF** | Instant in-page session; no email → no Resend cap; no OTP UI to build. Chosen over 6-digit OTP and "off-now-OTP-later". |
| 2 | Funnel scope | **All modes + future features** | One shared `useRevealGate` hook; refactor Solo onto it; bring FvF to parity; document as the convention for new modes. |
| 3 | Confirm-link code | **Leave inert, do not delete** | Keep the signup-`confirm` scene / `authResend` / `needsConfirm` paths in place but unreachable, so the setting stays reversible. **Keep `AuthConfirm` + recovery** (password reset still emails a link). |
| 4 | Credit-grant timing | **Already correct — no change** | `handle_new_user()` (migration `20260625120000`) grants 10 credits at account creation; guests get 0. "Grant only post-registration" is already satisfied. |
| 5 | Abuse mitigation | **Out of scope (accepted risk)** | No email verification → throwaway-email credit farming is possible. Per launch priorities (ceilings are Vercel bandwidth + Gemini 429, not abuse/cost), not addressed here. |

---

## Section 1 — The global flip & funnel invariant

**Setting change (manual, Supabase dashboard):** Authentication → Sign In / Providers → **Email** → turn **"Confirm email" OFF**. Nothing in application code toggles this. **First implementation step is to confirm the *current* value** — the launch notes already leaned toward off, so this may be a no-op.

**Effect on auth flow (existing code, no change needed for the happy path):**
- `authSignUp` (`apps/web/src/services/authService.ts`) returns `status: 'session'` when a session exists → `signUp` in `AccountContext.tsx` calls `finishAuth(uid, email)` → navigates to `authRedirect.current` (set by `openAuth(redirectTo)`).
- Duplicate sign-up still surfaces "That email already has an account — try logging in." via `friendly()`.

**Funnel invariant for all modes:** a signed-out visitor runs the scan/battle as a **teaser only (no credit spend, no AI call)** → at the reveal, registers **in-page** → `finishAuth` returns them to the mode's run route → the real verdict is generated on the **already-provided photos**. New accounts arrive with 10 credits (existing trigger).

**Inert after the flip (kept, not removed):** signup-confirmation `'confirm'` scene, `authResend`, the `needsConfirm` branch in `logIn`. **Retained and still live:** `AuthConfirm` route + `type=recovery` password-reset link.

---

## Section 2 — The shared `useRevealGate` hook (the reusable pattern)

**Location:** `apps/web/src/features/account/useRevealGate.ts` (co-located with `AccountContext`). Flagged in-code as a **`packages/core` candidate** for the future mobile port (logic is platform-agnostic; only `openAuth`/navigation are web-bound).

**Responsibility:** own **only the guest → register → resume transition** that every scan mode shares. It deliberately does **not** model the signed-in reveal: in every mode a signed-in user has *already* generated their verdict *during* the cosmetic timeline, so their "reveal" is just opening the ready result — a per-mode concern. Folding that into the hook would risk a **double-spend**. The hook is the guest deferral only.

**Interface (sketch):**
```ts
function useRevealGate(opts: {
  redirectTo: string;                    // passed to openAuth so finishAuth returns the user here
  readyToResume: boolean;                // deferred action's precondition (Solo: canScan; FvF: credits >= 2)
  onResume: () => void | Promise<void>;  // the guest's deferred spend+generate+navigate; runs ONCE after register
}): {
  requestRegister: () => void;           // called by the GUEST reveal CTA
  pending: boolean;                      // for CTA disabled state / labels
};
```

**Internals (lifted verbatim from `Scan.tsx`'s guest path):**
- `requestRegister()` → `setPending(true); openAuth(redirectTo)`. (Called only on the guest branch; a signed-in user never reaches it.)
- One `useEffect` keyed on `[pending, signedIn, readyToResume]` calls `onResume()` **exactly once** when `pending && signedIn && readyToResume`, then clears `pending`. (`signedIn` is read from `useAccount()`; for Solo `readyToResume = canScan` already implies signed-in, but the hook keeps the `signedIn` guard explicit so any mode is safe.)
- A ref guards against double-fire (mirrors the existing `revealingRef`).

This is the **single source of truth** for the guest deferral in "scan-first, register-at-reveal." A future mode supplies its own `onResume` and gets the funnel for free; it keeps its own signed-in "open the ready result" branch.

---

## Section 3 — Solo refactor (behavior-preserving)

In `apps/web/src/features/scan/Scan.tsx`:
- Replace the local `pendingReveal` state and the resume `useEffect` with:
  `const { requestRegister } = useRevealGate({ redirectTo: '/scan/run', readyToResume: canScan, onResume: doRevealGuest });`
- `onReveal` keeps the **signed-in** branch unchanged ("already have verdict → `/result#face`"; generation already ran during the timeline) and replaces its guest branch with `requestRegister()`.
- `doRevealGuest` (spend → `runGeneration` → navigate / refund-on-failure) is unchanged — it becomes the hook's `onResume`.

**Net behavior is identical.** The only goal is to route Solo's guest deferral through the shared hook so there is one implementation. **Existing Scan tests must stay green** (no behavior change).

---

## Section 4 — FvF parity (the real new work)

In `apps/web/src/features/versus/VersusScan.tsx`, restructure to mirror Solo's teaser / deferred-generation split. The battle state already supports this: `battle.tsx` separates `commit` (photos + mode) from `commitResult` (verdict), and persists the battle to `sessionStorage`.

- **Guest:** run the cosmetic scan timeline as a **teaser only — no `spendForBattle`, no `runVersusScan`**. At the reveal CTA call `requestRegister()` from
  `useRevealGate({ redirectTo: '/versus/run', readyToResume: credits >= 2, onResume: startBattle })`.
- **`startBattle`** (the guest's deferred resume action — runs once after register): `spendForBattle()` → `runVersusScan(battle)` → on success `commitResult` + `saveBattle`, set `fvf:reveal`, navigate to the result; **refund on failure** (existing logic preserved).
- **Signed-in, ≥2 credits:** behavior unchanged — keep today's `startScan` that spends + generates **during** the timeline; the reveal CTA opens the already-committed result. (Matches Solo: signed-in users do not defer; only guests do.)
- **Signed-in, <2 credits:** keep the existing `/credits` paywall route — a genuine shortfall, distinct from a guest.
- **Copy:** the guest reveal CTA reads "Sign up to reveal the winner" (parity with Solo), replacing the silent `/credits` bounce. This makes `VersusUpload`'s "10 free credits" promise truthful.

> **Implementation note for the plan:** `VersusScan` currently kicks off `startScan` (spend + AI) unconditionally on mount. The restructure must branch on `signedIn` at mount — guests get the teaser-only timeline and the gate; signed-in users keep the eager `startScan`. This is the bulk of the FvF work and the main risk area (StrictMode double-invoke + the existing `startedRef` guard must be preserved so no battle double-spends).

---

## Section 5 — Files affected

- **Manual (no code):** Supabase Auth → Email → "Confirm email" OFF.
- **New:** `apps/web/src/features/account/useRevealGate.ts` + `useRevealGate.test.ts`.
- **Edit:** `apps/web/src/features/scan/Scan.tsx` (route through the hook), `apps/web/src/features/versus/VersusScan.tsx` (teaser + deferred battle + hook), minor copy in the FvF reveal CTA.
- **Untouched but verified:** `AccountContext.tsx` (`signUp`/`finishAuth`/`openAuth`), `authService.ts`, `AuthConfirm.tsx` (recovery), `battle.tsx`, `handle_new_user()` trigger.

---

## Out of scope

- Email-verification abuse / throwaway-account credit farming (accepted risk).
- Ripping out the now-inert signup-confirmation UI (kept for reversibility).
- Any Supabase schema / edge-function / migration changes (none needed).
- The `packages/core` extraction itself (only *flagged* for the mobile port).

---

## Verification

- **Unit:** `useRevealGate.test.ts` — `requestRegister()` arms `pending` + calls `openAuth(redirectTo)`; `onResume` fires **exactly once** when `pending && signedIn && readyToResume` all become true; it does **not** fire while still a guest, and never double-fires (StrictMode / re-render). Follow existing patterns in `authRedirect.test.ts` / `authValidation.test.ts`. Keep `Scan` tests green.
- **Manual E2E (tester account + Playwright):**
  1. Signed-out **Solo**: upload → teaser → "Sign up to reveal" → register in modal → verdict generates on the **same photos**, no re-upload.
  2. Signed-out **FvF**: build battle → teaser → register → battle reveals; **2 credits** spent from the 10.
  3. Returning user **sign-in** still completes in-page/instantly.
  4. **Password reset** email + link still works (recovery path untouched).
- **Setting check:** confirm "Confirm email" is OFF in the live project before/after.
