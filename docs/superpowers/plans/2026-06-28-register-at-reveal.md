# Universal Register-at-Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "scan first, register at the reveal" one reusable in-page funnel for every mode (Solo + FvF), killing the photo-re-upload bug, by turning email confirmation OFF and routing the guest→register→resume transition through a shared `useRevealGate`.

**Architecture:** A pure reducer (`revealGate.ts`) owns the once-only "resume after the guest registers" decision; a thin hook (`useRevealGate.ts`) wraps it with `openAuth` + an effect. Solo is refactored onto the hook behavior-preservingly; FvF is restructured to give guests a no-spend teaser and a deferred 2-credit battle that resumes after register. The keystone is a manual Supabase setting (Confirm email OFF) that makes `signUp` return a live session in-page — no email, no reload.

**Tech Stack:** React 18 + TypeScript, Vitest 4 (node env default; `// @vitest-environment jsdom` opt-in per file), Supabase JS, react-router-dom 6. Spec: `docs/superpowers/specs/2026-06-28-register-at-reveal-design.md`. Branch: `feat/register-at-reveal`.

> **Commands** assume the working directory is `apps/web`. Run `cd "apps/web"` once before the steps. Single-file test: `npx vitest run <path>`. Full suite: `npx vitest run`. Types: `npm run typecheck`.

---

## File Structure

- **Create** `apps/web/src/features/account/revealGate.ts` — pure reducer: `GateState`, `gateInit`, `gateArm`, `gateResolve`. No React, no DOM. (Future `packages/core` candidate.)
- **Create** `apps/web/src/features/account/revealGate.test.ts` — node-env unit tests for the reducer.
- **Create** `apps/web/src/features/account/useRevealGate.ts` — thin hook wrapping the reducer with `useAccount()` (`signedIn`, `openAuth`) + a one-shot effect.
- **Modify** `apps/web/src/features/scan/Scan.tsx` — route Solo's guest deferral through `useRevealGate` (remove local `pendingReveal` + its resume effect).
- **Modify** `apps/web/src/features/versus/VersusScan.tsx` — guest teaser (no eager spend), deferred `startScan(revealAfter)` via the gate, guest reveal CTA.
- **Manual** Supabase dashboard: Auth → Sign In/Providers → Email → **Confirm email OFF**.

---

## Task 1: Pure reveal-gate reducer

**Files:**
- Create: `apps/web/src/features/account/revealGate.ts`
- Test: `apps/web/src/features/account/revealGate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/account/revealGate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gateInit, gateArm, gateResolve } from './revealGate';

describe('revealGate', () => {
  it('starts un-armed and unresolved', () => {
    expect(gateInit()).toEqual({ pending: false, resolved: false });
  });

  it('gateArm sets pending', () => {
    expect(gateArm(gateInit())).toEqual({ pending: true, resolved: false });
  });

  it('does not resume while un-armed (signed-in user just browsing)', () => {
    const { resume } = gateResolve(gateInit(), true, true);
    expect(resume).toBe(false);
  });

  it('does not resume while still a guest', () => {
    const armed = gateArm(gateInit());
    expect(gateResolve(armed, false, true).resume).toBe(false);
  });

  it('does not resume until the user can afford it', () => {
    const armed = gateArm(gateInit());
    expect(gateResolve(armed, true, false).resume).toBe(false);
  });

  it('resumes once when armed + signed-in + ready, then marks resolved', () => {
    const armed = gateArm(gateInit());
    const first = gateResolve(armed, true, true);
    expect(first.resume).toBe(true);
    expect(first.state).toEqual({ pending: false, resolved: true });
  });

  it('never resumes twice (resolved guards re-entry)', () => {
    const armed = gateArm(gateInit());
    const first = gateResolve(armed, true, true);
    const second = gateResolve(first.state, true, true);
    expect(second.resume).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/account/revealGate.test.ts`
Expected: FAIL — `Failed to resolve import "./revealGate"` / `gateInit is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/src/features/account/revealGate.ts`:

```ts
/**
 * Pure, platform-agnostic state for the guest -> register -> resume transition
 * shared by every scan mode. The hook (useRevealGate) is thin glue over this;
 * keeping the once-only logic here makes it unit-testable in the node env and a
 * clean candidate for packages/core when the mobile app lands.
 *
 * Lifecycle: gateInit() -> (guest taps reveal) gateArm() -> (each render)
 * gateResolve(state, signedIn, ready). `resolved` guarantees the deferred
 * action runs at most once.
 */
export interface GateState {
  /** The guest tapped "reveal" and was sent to register. */
  pending: boolean;
  /** The deferred action has already fired — never fire it again. */
  resolved: boolean;
}

export function gateInit(): GateState {
  return { pending: false, resolved: false };
}

/** Arm the gate when the guest requests the reveal (and is sent to register). */
export function gateArm(state: GateState): GateState {
  return { ...state, pending: true };
}

/**
 * Decide whether the deferred reveal should run now. Returns the next state and
 * a one-shot `resume` flag (true exactly once, when armed + signed-in + the user
 * can afford the reveal).
 */
export function gateResolve(
  state: GateState,
  signedIn: boolean,
  ready: boolean,
): { state: GateState; resume: boolean } {
  if (state.pending && !state.resolved && signedIn && ready) {
    return { state: { pending: false, resolved: true }, resume: true };
  }
  return { state, resume: false };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/account/revealGate.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/account/revealGate.ts apps/web/src/features/account/revealGate.test.ts
git commit -m "feat(auth): pure reveal-gate reducer for guest register-at-reveal"
```

---

## Task 2: The `useRevealGate` hook

**Files:**
- Create: `apps/web/src/features/account/useRevealGate.ts`

The hook is thin glue (no new unit test — its logic lives in the tested reducer; it's exercised by Tasks 3–4 + the E2E in Task 6). A `firedRef` guards against React StrictMode's synchronous double-invoke of the effect (which sees the same pre-commit state twice).

- [ ] **Step 1: Write the hook**

Create `apps/web/src/features/account/useRevealGate.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from './AccountContext';
import { gateArm, gateInit, gateResolve, type GateState } from './revealGate';

export interface RevealGateOptions {
  /** Path passed to openAuth so finishAuth returns the user to the run route. */
  redirectTo: string;
  /** True once the (now signed-in) user can afford this reveal — e.g. Solo: canScan; FvF: credits >= 2. */
  readyToResume: boolean;
  /** The guest's deferred spend+generate+navigate action. Runs exactly once after register. */
  onResume: () => void | Promise<void>;
}

export interface RevealGate {
  /** Call from the GUEST reveal CTA: arms the gate and opens the auth modal. */
  requestRegister: () => void;
  /** True while a guest is mid-registration — for CTA disabled state / labels. */
  pending: boolean;
}

/**
 * Shared guest -> register -> resume transition for every scan mode. Signed-in
 * users do NOT go through here (they already generated during the scan timeline);
 * this is purely the guest deferral, so it can never double-spend.
 */
export function useRevealGate({ redirectTo, readyToResume, onResume }: RevealGateOptions): RevealGate {
  const { signedIn, openAuth } = useAccount();
  const [gate, setGate] = useState<GateState>(gateInit);
  // Latest onResume without re-arming the effect each render.
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;
  // Synchronous one-shot guard: StrictMode double-invokes the effect against the
  // same pre-commit state, so the reducer's `resolved` flag alone isn't enough.
  const firedRef = useRef(false);

  const requestRegister = useCallback(() => {
    setGate((g) => gateArm(g));
    openAuth(redirectTo);
  }, [openAuth, redirectTo]);

  useEffect(() => {
    const { state, resume } = gateResolve(gate, signedIn, readyToResume);
    if (state !== gate) setGate(state);
    if (resume && !firedRef.current) {
      firedRef.current = true;
      void onResumeRef.current();
    }
  }, [gate, signedIn, readyToResume]);

  return { requestRegister, pending: gate.pending };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). The hook is unused so far — that's fine for `tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/account/useRevealGate.ts
git commit -m "feat(auth): useRevealGate hook wrapping the reveal-gate reducer"
```

---

## Task 3: Refactor Solo onto the gate (behavior-preserving)

**Files:**
- Modify: `apps/web/src/features/scan/Scan.tsx`

Replace Solo's local `pendingReveal` state + resume effect + the guest branch of `onReveal` with the hook. `doRevealGuest` is unchanged and becomes the hook's `onResume`. The signed-in `onReveal` branch is untouched.

- [ ] **Step 1: Add the hook import**

At the top of `apps/web/src/features/scan/Scan.tsx`, add (next to the other feature imports):

```ts
import { useRevealGate } from '../account/useRevealGate';
```

- [ ] **Step 2: Remove the `pendingReveal` state**

Delete this line (around line 131):

```ts
  const [pendingReveal, setPendingReveal] = useState(false);
```

- [ ] **Step 3: Drop the now-unused `openAuth` from the account destructure**

Change (around line 128):

```ts
  const { signedIn, openAuth, canScan, spendForScan, openPaywall, refundScan } = useAccount();
```
to:
```ts
  const { signedIn, canScan, spendForScan, openPaywall, refundScan } = useAccount();
```

- [ ] **Step 4: Wire the hook after `doRevealGuest` is defined**

Immediately AFTER the `doRevealGuest` `useCallback` (ends around line 329), add:

```ts
  const { requestRegister } = useRevealGate({
    redirectTo: '/scan/run',
    readyToResume: canScan,
    onResume: doRevealGuest,
  });
```

- [ ] **Step 5: Point the guest branch of `onReveal` at the hook**

Change `onReveal` (around lines 333–343) from:

```ts
  const onReveal = useCallback(() => {
    if (signedIn) {
      if (genStateRef.current === 'ready') {
        localStorage.setItem('fitaura.tab', 'face');
        navigate('/result#face');
      }
      return;
    }
    setPendingReveal(true);
    openAuth('/scan/run');
  }, [signedIn, navigate, openAuth]);
```
to:
```ts
  const onReveal = useCallback(() => {
    if (signedIn) {
      if (genStateRef.current === 'ready') {
        localStorage.setItem('fitaura.tab', 'face');
        navigate('/result#face');
      }
      return;
    }
    requestRegister();
  }, [signedIn, navigate, requestRegister]);
```

- [ ] **Step 6: Delete the old resume effect**

Delete this effect (around lines 345–351):

```ts
  // Once a pending guest signs up (and the free credits land), run the generation.
  useEffect(() => {
    if (pendingReveal && signedIn && canScan) {
      setPendingReveal(false);
      void doRevealGuest();
    }
  }, [pendingReveal, signedIn, canScan, doRevealGuest]);
```

- [ ] **Step 7: Typecheck + full test suite**

Run: `npm run typecheck`
Expected: PASS (no unused-var errors for `openAuth`/`pendingReveal`/`setPendingReveal`).

Run: `npx vitest run`
Expected: PASS — all existing suites green (no Scan test exists; nothing should regress).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/scan/Scan.tsx
git commit -m "refactor(scan): route Solo guest reveal through useRevealGate"
```

---

## Task 4: Bring FvF to parity

**Files:**
- Modify: `apps/web/src/features/versus/VersusScan.tsx`

Give guests a no-spend teaser and a deferred 2-credit battle that resumes after register. Signed-in users keep today's eager spend-during-timeline. `startScan` gains a `revealAfter` flag so the guest resume auto-navigates to the result (parity with Solo), while the eager signed-in path still ends on the manual "Reveal the verdict" button.

- [ ] **Step 1: Add the hook import + account fields**

`useAccount` is already imported in this file (used at line 55) — do NOT re-import it. At the top of `apps/web/src/features/versus/VersusScan.tsx`, add only:

```ts
import { useRevealGate } from '../account/useRevealGate';
```

Change the account destructure (around line 55) from:

```ts
  const { spendForBattle, refundBattle } = useAccount();
```
to:
```ts
  const { spendForBattle, refundBattle, signedIn, credits } = useAccount();
```

- [ ] **Step 2: Parametrize `startScan` with `revealAfter`**

Replace the existing `startScan` `useCallback` (around lines 88–109) with:

```ts
  // Spend 2 credits, fire the comparative scan, commit + save on success. When
  // `revealAfter` is set (the guest resume after register) we jump straight to
  // the result; the eager signed-in path instead lands on the manual reveal CTA.
  // Runs at most once per kickoff (startedRef / the gate's firedRef); the
  // in-flight call is never aborted on cleanup — only the state write is skipped
  // if the tree unmounted for real.
  const startScan = useCallback(async (revealAfter = false) => {
    if (!battle) return;
    const ok = await spendForBattle();
    if (!ok) {
      navigate('/credits');
      return;
    }
    const outcome = await runVersusScan(battle);
    if (!mountedRef.current) return;
    if (outcome.kind === 'result') {
      commitResult(outcome.result);
      // Persist to the on-device vault so the battle shows as a saved card.
      saveBattle(battle, outcome.result);
      if (revealAfter) {
        try {
          sessionStorage.setItem('fvf:reveal', '1');
        } catch {
          /* sessionStorage unavailable — result just renders static */
        }
        navigate('/versus/result', { replace: true });
      } else {
        setAiState('done');
      }
      return;
    }
    await refundBattle();
    if (!mountedRef.current) return;
    setAiError('That battle did not go through. Your 2 credits were refunded, give it another go.');
    setAiReason(outcome.message);
    setAiState('error');
  }, [battle, spendForBattle, refundBattle, commitResult, saveBattle, navigate]);
```

- [ ] **Step 3: Add the reveal gate (after `startScan`)**

Immediately AFTER the `startScan` `useCallback`, add:

```ts
  // Guest deferral: a signed-out visitor runs the teaser only, then registers at
  // the reveal; the battle (spend + AI) runs here, once, after register.
  const { requestRegister } = useRevealGate({
    redirectTo: '/versus/run',
    readyToResume: credits >= 2,
    onResume: () => startScan(true),
  });
```

- [ ] **Step 4: Only kick off eagerly for signed-in users**

Change the kickoff effect (around lines 118–132) from:

```ts
  useEffect(() => {
    if (!hydrated || !battle || startedRef.current) return;
    if (result) {
      startedRef.current = true;
      navigate('/versus/result', { replace: true });
      return;
    }
    startedRef.current = true;
    void startScan();
  }, [hydrated, battle, result, startScan, navigate]);
```
to:
```ts
  useEffect(() => {
    if (!hydrated || !battle || startedRef.current) return;
    if (result) {
      startedRef.current = true;
      navigate('/versus/result', { replace: true });
      return;
    }
    startedRef.current = true;
    // Signed-in: spend + scan eagerly so the AI runs during the timeline. Guests
    // run the teaser only — no spend until they register at the reveal (the gate).
    if (signedIn) void startScan();
  }, [hydrated, battle, result, signedIn, startScan, navigate]);
```

- [ ] **Step 5: Add a guest reveal CTA at the top of the `done` branch**

In the JSX, the timeline-`done` block currently starts `errored ? (...) : finishingUp ? (...) : (...)` (around line 218). A guest never produced a verdict, so `finishingUp` (`done && aiState === 'pending'`) would wrongly show. Add a guest branch that takes precedence. Change:

```tsx
          {done ? (
            errored ? (
```
to:
```tsx
          {done ? (
            !signedIn ? (
              <div className="reveal">
                <span className="stamp">✶ Battle scored ✶</span>
                <h2>
                  Crown the <span className="hl">winner</span>
                </h2>
                <p className="sub">
                  {names.a} vs {names.b} — create your free account to reveal the head-to-head.
                </p>
                <button className="go" onClick={requestRegister}>
                  <Icon.bolt /> Sign up to reveal the winner
                </button>
              </div>
            ) : errored ? (
```

(The matching close paren for this added ternary arm is the existing `)` before `: (` introducing `errored`. After the edit the chain reads `!signedIn ? (...guest...) : errored ? (...) : finishingUp ? (...) : (...scored...)`. The outer `done ? (...) : (<div className="sa-stage">...)` is unchanged.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (Confirms `signedIn`, `credits`, `requestRegister`, the `revealAfter` arg, and the JSX ternary all type-check.)

- [ ] **Step 7: Full test suite**

Run: `npx vitest run`
Expected: PASS — all suites green (no VersusScan test exists; nothing should regress).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/versus/VersusScan.tsx
git commit -m "feat(versus): guest teaser + deferred battle via useRevealGate (FvF parity)"
```

---

## Task 5: Turn email confirmation OFF (manual Supabase) + verify

No code change. This is the keystone that makes guest sign-up return a live session in-page.

- [ ] **Step 1: Check the current setting**

In the Supabase dashboard for the live project: **Authentication → Sign In / Providers → Email**. Note whether **"Confirm email"** is currently ON or OFF. (Per the launch notes it may already be OFF — in which case Steps 2–3 are a no-op.)

- [ ] **Step 2: Turn "Confirm email" OFF**

Toggle **Confirm email** OFF and save.

- [ ] **Step 3: Verify `signUp` now returns a session immediately**

Quickest check in the browser console on `localhost:5173` (dev) or prod, with a throwaway email:

```js
const { data } = await window.supabase?.auth.signUp({ email: `t${Date.now()}@example.com`, password: 'test1234' });
console.log('session?', !!data.session); // expect: true
```
If `window.supabase` isn't exposed, instead run the Solo E2E in Task 6 — landing on the verdict with no "check your email" screen confirms it.
Expected: a session exists right after `signUp` (no email/confirm step).

- [ ] **Step 4: Confirm password reset still emails a link**

Trigger "Forgot password" for the tester account; confirm the recovery email + `/auth/confirm?...type=recovery` link still arrives and signs in (the recovery path is intentionally untouched).

(No commit — configuration only.)

---

## Task 6: End-to-end verification

**Files:** none (verification only). Use the standing tester account (`tester@fitaura.test`, pre-confirmed, 100 credits) for signed-in checks, and fresh throwaway emails for guest→register checks.

- [ ] **Step 1: Static gates**

Run: `npm run typecheck` → Expected: PASS.
Run: `npx vitest run` → Expected: PASS (all suites, including the new `revealGate.test.ts`).

- [ ] **Step 2: Solo guest → register → reveal (the bug)**

Start the app (`npm run dev` from repo root), signed out:
1. Upload a face/outfit photo → Scan → let the teaser finish.
2. Tap **"Sign up to reveal your verdict"** → register with a fresh email in the modal.
3. **Expected:** no "check your email" screen; the modal closes, the verdict generates on the **same photos** (no re-upload), and `/result#face` opens. 1 credit spent (balance 9).

- [ ] **Step 3: FvF guest → register → reveal**

Signed out:
1. Build a battle (`/versus`), add both sides' photos → Compare → let the teaser timeline finish.
2. **Expected:** a **"Sign up to reveal the winner"** CTA (not a `/credits` bounce, not a stuck "Finishing up").
3. Register with a fresh email → **Expected:** the modal closes, a brief "Crowning a winner…" hold while the AI runs, then the result opens. 2 credits spent (balance 8).

- [ ] **Step 4: Signed-in regressions**

With the tester account: a Solo scan still generates during the timeline and "Reveal my verdict" opens the result; an FvF battle still spends 2 up front and "Reveal the verdict" opens the result; a signed-in user with <2 credits starting a battle still routes to `/credits`.

- [ ] **Step 5: Returning sign-in + recovery**

Logging in (existing account) still completes in-page/instantly; password reset link still works (Task 5 Step 4).

- [ ] **Step 6: Final branch state**

Run: `git log --oneline feat/register-at-reveal` and confirm the task commits are present. Leave the push to the user (held per the iterative-session preference) unless they say otherwise.

---

## Self-review notes (coverage map)

- Spec §1 (confirmation OFF + funnel invariant) → Task 5; the in-page session path needs no code (verified Task 6 Step 2).
- Spec §2 (`useRevealGate`) → Tasks 1–2 (reducer + hook).
- Spec §3 (Solo refactor) → Task 3.
- Spec §4 (FvF parity) → Task 4.
- Spec §5 (files) → File Structure section.
- Spec Verification (unit + E2E) → Tasks 1, 6.
- Out of scope (abuse mitigation, deleting inert confirm UI, schema/edge changes) → not addressed, by design.
