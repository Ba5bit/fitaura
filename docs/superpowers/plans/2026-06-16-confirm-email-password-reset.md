# Email confirmation, password reset & registration credit grant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell users to confirm their email after signup, verify it via a first-party `fitaura.studio/auth/confirm` link, add a password-reset flow, require a confirm-password field on registration, and grant a flat 1 credit on signup.

**Architecture:** Client-only Vite + React + React Router SPA. All Supabase auth calls stay behind `services/authService.ts`; `AccountContext` orchestrates scenes/state; UI calls the context. Email/recovery links are verified on a public `/auth/confirm` route via `supabase.auth.verifyOtp({ token_hash, type })` (the SPA path from `~/Downloads/FITAURA_SUPABASE_RESEND_AUTH.md`). The credit grant is set server-side by the `handle_new_user` trigger, keyed off a `used_free_scan` flag passed as signup metadata.

**Tech Stack:** TypeScript, React 18, React Router 6, Supabase JS v2, Vitest (jsdom; `vi.hoisted` mock pattern — no `@testing-library/react`, so TDD covers pure logic + the service layer).

**Spec:** `docs/superpowers/specs/2026-06-16-confirm-email-password-reset-design.md`

**Conventions for every task:**
- Run single tests from `apps/web`: `npx vitest run <path>`.
- Typecheck/build from `apps/web`: `npm run typecheck` / `npm run build`.
- Never log `token_hash` or tokens. No secrets in client code.

---

## File structure

- **Create** `apps/web/src/lib/authRedirect.ts` — pure `getSafeNextPath`, `isSupportedOtpType`.
- **Create** `apps/web/src/lib/authRedirect.test.ts` — their tests.
- **Create** `apps/web/src/lib/authValidation.ts` — pure `signupPasswordError`.
- **Create** `apps/web/src/lib/authValidation.test.ts` — its tests.
- **Modify** `apps/web/src/services/authService.ts` — new wrappers + richer `authSignUp`/`authSignIn` + `friendly` cases.
- **Modify** `apps/web/src/services/authService.test.ts` — extend the mock + new tests.
- **Modify** `apps/web/src/features/account/AccountContext.tsx` — `confirm` scene, `pendingEmail`, `confirmKind`, resend cooldown, new actions, reworked `signUp`/`logIn`.
- **Modify** `apps/web/src/lib/icons.tsx` — add `mail` icon.
- **Modify** `apps/web/src/features/account/AccountModals.tsx` — `EmailSentNotice` scene + `AuthGate` confirm-password/reset mode.
- **Modify** `apps/web/src/features/account/AccountOverlays.tsx` — render the `confirm` scene.
- **Create** `apps/web/src/features/auth/AuthConfirm.tsx` — `/auth/confirm` page.
- **Create** `apps/web/src/features/auth/UpdatePassword.tsx` — `/auth/update-password` page.
- **Create** `apps/web/src/design/auth.css` — centered standalone auth-page styles.
- **Modify** `apps/web/src/App.tsx` — two routes + CSS import.
- **DB (via Supabase MCP)** — redefine `public.handle_new_user`.
- **Create** `docs/dev-log/044-auth-email-confirmation-and-reset.md` + index it.

---

## Task 1: Pure redirect/OTP helpers

**Files:**
- Create: `apps/web/src/lib/authRedirect.ts`
- Test: `apps/web/src/lib/authRedirect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/authRedirect.test.ts
import { describe, it, expect } from 'vitest';
import { getSafeNextPath, isSupportedOtpType } from './authRedirect';

describe('getSafeNextPath', () => {
  it('returns the fallback for null/empty', () => {
    expect(getSafeNextPath(null, '/vault')).toBe('/vault');
    expect(getSafeNextPath('', '/vault')).toBe('/vault');
  });
  it('accepts a single-slash internal path', () => {
    expect(getSafeNextPath('/auth/update-password', '/vault')).toBe('/auth/update-password');
  });
  it('rejects protocol-relative, absolute and javascript URLs', () => {
    expect(getSafeNextPath('//evil.example', '/vault')).toBe('/vault');
    expect(getSafeNextPath('https://evil.example', '/vault')).toBe('/vault');
    expect(getSafeNextPath('javascript:alert(1)', '/vault')).toBe('/vault');
  });
});

describe('isSupportedOtpType', () => {
  it('accepts email and recovery', () => {
    expect(isSupportedOtpType('email')).toBe(true);
    expect(isSupportedOtpType('recovery')).toBe(true);
  });
  it('rejects unknown/empty values', () => {
    expect(isSupportedOtpType('sms')).toBe(false);
    expect(isSupportedOtpType(null)).toBe(false);
    expect(isSupportedOtpType('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/authRedirect.test.ts`
Expected: FAIL — "Failed to resolve import './authRedirect'".

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/authRedirect.ts
import type { EmailOtpType } from '@supabase/supabase-js';

/** OTP types this app's /auth/confirm route supports. `email` = signup confirm. */
const SUPPORTED: ReadonlySet<EmailOtpType> = new Set<EmailOtpType>(['email', 'recovery']);

export function isSupportedOtpType(value: string | null): value is EmailOtpType {
  return value != null && SUPPORTED.has(value as EmailOtpType);
}

/** Only allow relative internal paths beginning with exactly one "/". Anything
 * else (null, "//x", "https://x", "javascript:…") falls back. Prevents open redirects. */
export function getSafeNextPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/authRedirect.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/authRedirect.ts apps/web/src/lib/authRedirect.test.ts
git commit -m "feat(web): pure auth redirect + OTP-type guards"
```

---

## Task 2: Signup password-match validation

**Files:**
- Create: `apps/web/src/lib/authValidation.ts`
- Test: `apps/web/src/lib/authValidation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/authValidation.test.ts
import { describe, it, expect } from 'vitest';
import { signupPasswordError } from './authValidation';

describe('signupPasswordError', () => {
  it('returns null when both passwords match and are non-empty', () => {
    expect(signupPasswordError('hunter2pw', 'hunter2pw')).toBeNull();
  });
  it('flags an empty password', () => {
    expect(signupPasswordError('', '')).toBe('Enter a password.');
  });
  it('flags a mismatch', () => {
    expect(signupPasswordError('hunter2pw', 'hunter3pw')).toBe("Passwords don't match.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/authValidation.test.ts`
Expected: FAIL — cannot resolve './authValidation'.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/authValidation.ts
/** Client-side signup password check. Returns an error string, or null when valid.
 * Length/strength is enforced by Supabase; this only guards the confirm field. */
export function signupPasswordError(password: string, confirm: string): string | null {
  if (password.length === 0) return 'Enter a password.';
  if (password !== confirm) return "Passwords don't match.";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/authValidation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/authValidation.ts apps/web/src/lib/authValidation.test.ts
git commit -m "feat(web): signup password-match validation helper"
```

---

## Task 3: authService — new wrappers, richer results, friendly cases

**Files:**
- Modify: `apps/web/src/services/authService.ts`
- Test: `apps/web/src/services/authService.test.ts`

- [ ] **Step 1: Write the failing tests** (replace the file with this — it extends the mock and keeps the existing cases)

```ts
// apps/web/src/services/authService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { signUp, signInWithPassword, signOut, resend, resetPasswordForEmail, verifyOtp, updateUser } =
  vi.hoisted(() => ({
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resend: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
  }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signUp, signInWithPassword, signOut, resend, resetPasswordForEmail, verifyOtp, updateUser },
  },
}));

import {
  authSignUp, authSignIn, authSignOut, authResend, authResetPassword, authVerifyOtp, authUpdatePassword,
} from './authService';

beforeEach(() => {
  [signUp, signInWithPassword, signOut, resend, resetPasswordForEmail, verifyOtp, updateUser].forEach((m) => m.mockReset());
});

describe('authSignUp', () => {
  it('returns status "confirm" when no session is created (email confirmation on)', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', identities: [{ id: 'i1' }] }, session: null },
      error: null,
    });
    const res = await authSignUp('a@b.com', 'password123', { usedFreeScan: false });
    expect(res).toEqual({ ok: true, status: 'confirm', user: { id: 'u1', email: 'a@b.com' } });
    expect(signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'password123',
      options: { data: { used_free_scan: false } },
    });
  });

  it('treats an empty identities array as already-registered', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', identities: [] }, session: null },
      error: null,
    });
    const res = await authSignUp('a@b.com', 'password123', { usedFreeScan: true });
    expect(res).toEqual({ ok: false, error: 'That email already has an account — try logging in.' });
  });

  it('maps an error to a friendly message', async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'User already registered' } });
    const res = await authSignUp('a@b.com', 'password123', { usedFreeScan: true });
    expect(res).toEqual({ ok: false, error: 'That email already has an account — try logging in.' });
  });
});

describe('authSignIn', () => {
  it('flags an unconfirmed email', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Email not confirmed' } });
    const res = await authSignIn('a@b.com', 'password123');
    expect(res).toEqual({
      ok: false,
      needsConfirm: true,
      error: 'Please confirm your email first — check your inbox (and spam).',
    });
  });

  it('returns ok with the user on success', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });
    const res = await authSignIn('a@b.com', 'password123');
    expect(res).toEqual({ ok: true, user: { id: 'u1', email: 'a@b.com' } });
  });
});

describe('authResend / authResetPassword / authVerifyOtp / authUpdatePassword', () => {
  it('authResend resends the signup confirmation', async () => {
    resend.mockResolvedValue({ error: null });
    expect(await authResend('a@b.com')).toEqual({ ok: true });
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' });
  });
  it('authResetPassword triggers a recovery email', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await authResetPassword('a@b.com')).toEqual({ ok: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.com');
  });
  it('authVerifyOtp returns ok:false with a friendly message on error', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    expect(await authVerifyOtp('abc', 'email')).toEqual({
      ok: false,
      error: 'This link is invalid or has expired.',
    });
  });
  it('authUpdatePassword updates the password', async () => {
    updateUser.mockResolvedValue({ error: null });
    expect(await authUpdatePassword('newpassword1')).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: 'newpassword1' });
  });
});

describe('authSignOut', () => {
  it('calls supabase signOut', async () => {
    signOut.mockResolvedValue({ error: null });
    await authSignOut();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/authService.test.ts`
Expected: FAIL — new exports not defined / `authSignUp` arity + shape mismatch.

- [ ] **Step 3: Write the implementation** (replace `apps/web/src/services/authService.ts`)

```ts
import type { EmailOtpType, Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthUser = Pick<User, 'id' | 'email'>;

export type SignUpResult =
  | { ok: true; status: 'confirm' | 'session'; user: AuthUser }
  | { ok: false; error: string };
export type SignInResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string; needsConfirm?: boolean };
export type SimpleResult = { ok: true } | { ok: false; error: string };

/** Translate raw Supabase auth errors into copy we can show a user. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered')) return 'That email already has an account — try logging in.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox (and spam).';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('password should be at least')) return 'Password is too short (minimum 6 characters).';
  if (m.includes('expired') || m.includes('invalid')) return 'This link is invalid or has expired.';
  if (m.includes('unable to validate email')) return 'That email address looks invalid.';
  if (m.includes('email') && m.includes('valid')) return 'That email address looks invalid.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts — wait a minute and try again.';
  return 'Something went wrong. Please try again.';
}

export async function authSignUp(
  email: string,
  password: string,
  opts: { usedFreeScan: boolean },
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { used_free_scan: opts.usedFreeScan } },
  });
  if (error || !data.user) return { ok: false, error: friendly(error?.message ?? 'no user') };
  // Confirm-email on: an existing account returns a user with an empty identities
  // array (anti-enumeration). Treat that as "already registered".
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'That email already has an account — try logging in.' };
  }
  const user = { id: data.user.id, email: data.user.email ?? email };
  return { ok: true, status: data.session ? 'session' : 'confirm', user };
}

export async function authSignIn(email: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const needsConfirm = (error?.message ?? '').toLowerCase().includes('email not confirmed');
    return { ok: false, error: friendly(error?.message ?? 'no user'), needsConfirm };
  }
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? email } };
}

export async function authSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function authResend(email: string): Promise<SimpleResult> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function authResetPassword(email: string): Promise<SimpleResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function authVerifyOtp(token_hash: string, type: EmailOtpType): Promise<SimpleResult> {
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function authUpdatePassword(password: string): Promise<SimpleResult> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/authService.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/authService.ts apps/web/src/services/authService.test.ts
git commit -m "feat(web): auth service — confirm/resend/reset/verify/update wrappers"
```

> Note: `authSignUp` is now `(email, password, { usedFreeScan })` and `authSignIn` returns `needsConfirm`. Task 4 updates the one caller (`AccountContext`).

---

## Task 4: AccountContext — confirm scene, pendingEmail, resend cooldown, reworked auth actions

**Files:**
- Modify: `apps/web/src/features/account/AccountContext.tsx`

This task has no unit test (the repo has no React test renderer); verify with `npm run typecheck`.

- [ ] **Step 1: Extend the imports + Scene union + context interface**

At the top, update the service import:

```ts
import {
  authResend, authResetPassword, authSignIn, authSignOut, authSignUp,
  getCurrentSession, onAuthChange,
} from '../../services/authService';
import { getBalance, grantCredits, refundCredit, spendCredit, hasUsedFreeScan } from '../../services/creditsService';
```

Add `'confirm'` to the `Scene` union:

```ts
export type Scene =
  | null
  | 'auth'
  | 'confirm'
  | 'paywall'
  | 'checkout'
  | 'processing'
  | 'success'
  | 'failure'
  | 'logout'
  | 'missing';

export type ConfirmKind = 'signup' | 'recovery';
```

Add to `AccountContextValue` (after `openAuth`):

```ts
  /** Email awaiting confirmation / reset, shown on the confirm scene. */
  pendingEmail: string | null;
  /** Which "check your email" copy to show. */
  confirmKind: ConfirmKind;
  /** Seconds remaining before resend is allowed again (0 = allowed). */
  resendCooldown: number;
  /** Resend the signup-confirmation or password-reset email (cooldown-guarded). */
  resendConfirmation: () => Promise<void>;
  /** Send a password-reset email and open the recovery confirm scene. */
  requestPasswordReset: (email: string) => Promise<void>;
```

- [ ] **Step 2: Add state + cooldown ticker** (inside `AccountProvider`, near the other `useState`s)

```ts
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>('signup');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const RESEND_COOLDOWN_SECONDS = 45;
```

- [ ] **Step 3: Rework `signUp`** (replace the existing `signUp` useCallback)

```ts
  const signUp = useCallback<AccountContextValue['signUp']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignUp(email.trim(), password, { usedFreeScan: hasUsedFreeScan() });
      if (!res.ok) {
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      // Email confirmation is on: signUp creates no session. Show the
      // "check your email" scene instead of logging in.
      setAuthStatus('idle');
      setPendingEmail(res.user.email ?? email.trim());
      setConfirmKind('signup');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setScene('confirm');
      return true;
    },
    [],
  );
```

- [ ] **Step 4: Rework `logIn`** (replace the existing `logIn` useCallback)

```ts
  const logIn = useCallback<AccountContextValue['logIn']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignIn(email.trim(), password);
      if (!res.ok) {
        if (res.needsConfirm) {
          // They have an account but haven't confirmed — send them to the
          // confirm scene so they can resend.
          setAuthStatus('idle');
          setPendingEmail(email.trim());
          setConfirmKind('signup');
          setResendCooldown(0);
          setScene('confirm');
          return false;
        }
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      finishAuth(res.user.id, res.user.email);
      return true;
    },
    [finishAuth],
  );
```

- [ ] **Step 5: Add `requestPasswordReset` + `resendConfirmation`** (after `logIn`)

```ts
  const requestPasswordReset = useCallback<AccountContextValue['requestPasswordReset']>(async (email) => {
    setAuthStatus('pending');
    setAuthError(null);
    const res = await authResetPassword(email.trim());
    if (!res.ok) {
      setAuthStatus('error');
      setAuthError(res.error);
      return;
    }
    setAuthStatus('idle');
    setPendingEmail(email.trim());
    setConfirmKind('recovery');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setScene('confirm');
  }, []);

  const resendConfirmation = useCallback<AccountContextValue['resendConfirmation']>(async () => {
    if (resendCooldown > 0 || !pendingEmail) return;
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const res = confirmKind === 'recovery'
      ? await authResetPassword(pendingEmail)
      : await authResend(pendingEmail);
    flash(res.ok ? 'Email sent — check your inbox.' : res.error);
  }, [resendCooldown, pendingEmail, confirmKind, flash]);
```

- [ ] **Step 6: Expose the new values** — add to the `value` object and its dependency array

In the `useMemo` object add: `pendingEmail, confirmKind, resendCooldown, resendConfirmation, requestPasswordReset,`.
In the dependency array add the same identifiers: `pendingEmail, confirmKind, resendCooldown, resendConfirmation, requestPasswordReset`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `closeScene` should also clear `pendingEmail`, that's optional — leaving it is harmless.)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/account/AccountContext.tsx
git commit -m "feat(web): account context — confirm scene, resend cooldown, password reset"
```

---

## Task 5: `mail` icon + EmailSentNotice scene + overlay wiring

**Files:**
- Modify: `apps/web/src/lib/icons.tsx`
- Modify: `apps/web/src/features/account/AccountModals.tsx`
- Modify: `apps/web/src/features/account/AccountOverlays.tsx`

- [ ] **Step 1: Add a `mail` icon** — in `apps/web/src/lib/icons.tsx`, add this entry to the `Icon` object (next to `shield`):

```tsx
  mail: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
```

- [ ] **Step 2: Add `EmailSentNotice`** — in `apps/web/src/features/account/AccountModals.tsx`, add this component (e.g. after `AuthGate`):

```tsx
/* ============================ EMAIL SENT (confirm / recovery) ============================ */
export function EmailSentNotice() {
  const { pendingEmail, confirmKind, resendConfirmation, resendCooldown, closeScene, openAuth } = useAccount();
  const isRecovery = confirmKind === 'recovery';
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <div className="aw-glyph neutral">
          <Icon.mail />
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '18px' }}>
          CHECK YOUR EMAIL
        </h2>
        <p className="aw-modal-sub">
          {isRecovery
            ? 'We sent a password-reset link to '
            : 'We sent a confirmation link to '}
          <b style={{ color: 'var(--ink)' }}>{pendingEmail ?? 'your inbox'}</b>
          {isRecovery ? '. Open it to set a new password.' : '. Click it to activate your account.'}
        </p>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '20px' }}
          disabled={resendCooldown > 0}
          onClick={() => void resendConfirmation()}
        >
          <Icon.refresh /> {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : isRecovery ? 'Resend reset link' : 'Resend confirmation'}
        </button>
        <button className="aw-linkbtn" onClick={() => openAuth()}>
          Back to log in
        </button>
        <div className="aw-fineprint" style={{ marginTop: '6px' }}>
          Can't find it? Check your spam folder.
        </div>
      </WebDialogBody>
    </WebModal>
  );
}
```

- [ ] **Step 3: Render the scene** — in `apps/web/src/features/account/AccountOverlays.tsx`, import `EmailSentNotice` and add its branch:

```tsx
import {
  AuthGate,
  EmailSentNotice,
  Paywall,
  Checkout,
  Processing,
  PaySuccess,
  PayFailure,
  LogoutConfirm,
  MissingResult,
} from './AccountModals';
```

```tsx
      {scene === 'auth' && <AuthGate />}
      {scene === 'confirm' && <EmailSentNotice />}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/icons.tsx apps/web/src/features/account/AccountModals.tsx apps/web/src/features/account/AccountOverlays.tsx
git commit -m "feat(web): check-your-email scene + mail icon"
```

---

## Task 6: AuthGate — confirm-password field + reset mode + forgot-password link

**Files:**
- Modify: `apps/web/src/features/account/AccountModals.tsx`

- [ ] **Step 1: Replace the `AuthGate` component** with this version (adds `confirm` field, `reset` mode, validation):

```tsx
export function AuthGate() {
  const { closeScene, signUp, logIn, requestPasswordReset, authStatus, authError } = useAccount();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mode, setMode] = useState<'signup' | 'login' | 'reset'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';
  const pending = authStatus === 'pending';

  const switchMode = (m: 'signup' | 'login' | 'reset') => {
    setMode(m);
    setPassword('');
    setConfirm('');
    setLocalError(null);
  };

  const submit = async () => {
    if (pending) return;
    setLocalError(null);
    if (isReset) {
      await requestPasswordReset(email.trim());
      return;
    }
    if (isSignup) {
      const err = signupPasswordError(password, confirm);
      if (err) {
        setLocalError(err);
        return;
      }
      await signUp(email.trim(), password);
      return;
    }
    void logIn(email.trim(), password);
  };

  const title = isReset ? ['RESET YOUR', 'PASSWORD'] : ['SAVE YOUR SCANS', 'KEEP GOING'];
  const cta = pending ? 'Working…' : isReset ? 'Send reset link' : isSignup ? 'Create account' : 'Log in';

  return (
    <WebModal size="lg" onClose={closeScene}>
      <div className="aw-auth">
        <div className="aw-auth-left">
          <span className="aw-eyebrow accent">ACCOUNT REQUIRED TO CONTINUE</span>
          <h2 className="aw-modal-title" style={{ marginTop: '16px', fontSize: '34px' }}>
            {title[0]}
            <br />
            {title[1]}
          </h2>
          <p className="aw-modal-sub">
            Your first verdict was free and stayed on this device. An account lets you buy credits and run more, on
            any device you log in from.
          </p>
          <ul className="pts">
            <li><span className="ck"><Icon.check /></span><span>Credits follow your login<span className="s">Not tied to one browser</span></span></li>
            <li><span className="ck"><Icon.check /></span><span>Payment receipts saved<span className="s">On your account, server-side</span></span></li>
            <li><span className="ck"><Icon.check /></span><span>Your photos stay on your device<span className="s">We never store source photos</span></span></li>
          </ul>
        </div>

        <div className="aw-auth-right">
          {!isReset && (
            <div className="aw-seg" role="tablist">
              <button type="button" role="tab" aria-selected={isSignup} onClick={() => switchMode('signup')}>Sign up</button>
              <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>Log in</button>
            </div>
          )}
          <form
            style={{ display: 'contents' }}
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
          >
            <WebField label="Email" type="email" placeholder="you@email.com" value={email} onChange={setEmail} />
            {!isReset && (
              <WebField
                label="Password"
                type="password"
                placeholder={isSignup ? 'Create a password' : 'Your password'}
                value={password}
                onChange={setPassword}
              />
            )}
            {isSignup && (
              <WebField label="Confirm password" type="password" placeholder="Re-enter your password" value={confirm} onChange={setConfirm} />
            )}
            {(localError || authError) && (
              <p className="aw-formerror" role="alert">{localError ?? authError}</p>
            )}
            <button type="submit" className="aw-btn primary block" style={{ marginTop: '18px' }} disabled={pending}>
              {cta}
            </button>
          </form>
          {!isSignup && !isReset && (
            <button type="button" className="aw-linkbtn" onClick={() => switchMode('reset')}>Forgot password?</button>
          )}
          {isReset && (
            <button type="button" className="aw-linkbtn" onClick={() => switchMode('login')}>Back to log in</button>
          )}
          <div className="aw-finehelp">
            <Icon.shield />
            <span>
              We store your account, credit balance, and payment receipts, never your photos.{' '}
              <button
                type="button"
                className="lk"
                onClick={() => { closeScene(); navigate('/settings', { state: { from: pathname } }); }}
              >
                How your data is stored
              </button>
            </span>
          </div>
        </div>
      </div>
    </WebModal>
  );
}
```

- [ ] **Step 2: Add the validation import** at the top of `AccountModals.tsx`:

```tsx
import { signupPasswordError } from '../../lib/authValidation';
```

(The previous `notice`-based "now log in" state is intentionally removed — confirmation is handled by the `confirm` scene from Task 4.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/account/AccountModals.tsx
git commit -m "feat(web): signup confirm-password field + forgot-password/reset mode"
```

---

## Task 7: `/auth/confirm` page + auth-page CSS + route

**Files:**
- Create: `apps/web/src/features/auth/AuthConfirm.tsx`
- Create: `apps/web/src/design/auth.css`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create the auth-page CSS**

```css
/* apps/web/src/design/auth.css — standalone (non-modal) auth pages */
.auth-page{ min-height:100dvh; display:grid; place-items:center; padding:24px;
  background:var(--bg, #07090c); }
.auth-card{ width:100%; max-width:420px; border:1px solid var(--hair-soft);
  background:var(--panel); border-radius:18px; padding:28px 26px; text-align:center;
  display:flex; flex-direction:column; align-items:center; gap:14px; }
.auth-card .aw-spinner{ margin:4px auto; }
.auth-card .aw-btn{ width:100%; }
.auth-card .auth-msg{ color:var(--muted, #9aa3ad); font-size:14px; line-height:1.5; }
```

- [ ] **Step 2: Create `AuthConfirm.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { authVerifyOtp } from '../../services/authService';
import { getSafeNextPath, isSupportedOtpType } from '../../lib/authRedirect';

const FALLBACK: Record<string, string> = { recovery: '/auth/update-password' };

/** Public route hit by the first-party confirmation/recovery email link.
 * Verifies the token via verifyOtp, then routes the (now signed-in) user. */
export function AuthConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { flash, openAuth } = useAccount();
  const [error, setError] = useState(false);
  const ran = useRef(false); // guard StrictMode double-invoke (token is single-use)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || !isSupportedOtpType(type)) {
      setError(true);
      return;
    }
    const next = getSafeNextPath(params.get('next'), FALLBACK[type] ?? '/vault');
    void authVerifyOtp(tokenHash, type).then((res) => {
      if (!res.ok) {
        setError(true);
        return;
      }
      if (type !== 'recovery') flash('Email confirmed — welcome.');
      navigate(next, { replace: true });
    });
  }, [params, navigate, flash]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {error ? (
          <>
            <div className="aw-glyph bad"><Icon.x /></div>
            <h2 className="aw-modal-title">LINK INVALID</h2>
            <p className="auth-msg">This link is invalid or has expired. Sign in to request a new one.</p>
            <button className="aw-btn primary" onClick={() => { navigate('/'); openAuth(); }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="aw-spinner" />
            <h2 className="aw-modal-title">CONFIRMING…</h2>
            <p className="auth-msg">Verifying your email and signing you in.</p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register the route + CSS** in `apps/web/src/App.tsx`

Add the import near the other feature imports:

```tsx
import { AuthConfirm } from './features/auth/AuthConfirm';
import { UpdatePassword } from './features/auth/UpdatePassword';
import './design/auth.css';
```

Add the routes **before** the `*` catch-all:

```tsx
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
```

(Importing `UpdatePassword` now keeps App.tsx compiling once Task 8 creates it; do Task 8 before typechecking, or comment the line/route until then.)

- [ ] **Step 4: Commit** (after Task 8 typechecks clean — see Task 8 Step 4)

---

## Task 8: `/auth/update-password` page

**Files:**
- Create: `apps/web/src/features/auth/UpdatePassword.tsx`

- [ ] **Step 1: Create `UpdatePassword.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { authUpdatePassword } from '../../services/authService';
import { getCurrentSession } from '../../services/authService';
import { signupPasswordError } from '../../lib/authValidation';

/** Reached via the recovery link (after /auth/confirm establishes a recovery
 * session). Gated: no session → tell the user to request a new link. */
export function UpdatePassword() {
  const navigate = useNavigate();
  const { flash } = useAccount();
  const [ready, setReady] = useState<boolean | null>(null); // null = checking
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentSession().then((s) => { if (active) setReady(!!s); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (busy) return;
    const err = signupPasswordError(password, confirm);
    if (err) { setError(err); return; }
    setBusy(true);
    setError(null);
    const res = await authUpdatePassword(password);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    flash('Password updated.');
    navigate('/vault', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {ready === null ? (
          <>
            <div className="aw-spinner" />
            <p className="auth-msg">Checking your reset link…</p>
          </>
        ) : !ready ? (
          <>
            <div className="aw-glyph bad"><Icon.x /></div>
            <h2 className="aw-modal-title">LINK EXPIRED</h2>
            <p className="auth-msg">This reset link is no longer valid. Request a new one from the login screen.</p>
            <button className="aw-btn primary" onClick={() => navigate('/')}>Back to sign in</button>
          </>
        ) : (
          <>
            <div className="aw-glyph neutral"><Icon.key /></div>
            <h2 className="aw-modal-title">SET A NEW PASSWORD</h2>
            <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <WebField label="New password" type="password" placeholder="Create a password" value={password} onChange={setPassword} />
              <WebField label="Confirm password" type="password" placeholder="Re-enter your password" value={confirm} onChange={setConfirm} />
              {error && <p className="aw-formerror" role="alert">{error}</p>}
              <button type="submit" className="aw-btn primary" disabled={busy}>{busy ? 'Working…' : 'Update password'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

Add the `WebField` import at the top:

```tsx
import { WebField } from '../account/WebModal';
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (both `/auth/confirm` and `/auth/update-password` now resolve).

- [ ] **Step 3: Run the full test + build**

Run: `npm test` then `npm run build`
Expected: all unit tests PASS; build clean.

- [ ] **Step 4: Commit** (covers Task 7 + Task 8)

```bash
git add apps/web/src/features/auth/AuthConfirm.tsx apps/web/src/features/auth/UpdatePassword.tsx apps/web/src/design/auth.css apps/web/src/App.tsx
git commit -m "feat(web): /auth/confirm + /auth/update-password routes"
```

---

## Task 9: Registration credit grant — `handle_new_user` trigger

**Applied via the Supabase MCP** (`apply_migration`) or the dashboard SQL editor — there are no committed migration files in this repo. Project ref `rxtlbhjysksoxkdcdqyr`.

- [ ] **Step 1: Inspect the current function** so nothing else in its body is lost

Run (MCP `execute_sql` or SQL editor):

```sql
select pg_get_functiondef('public.handle_new_user'::regproc);
```

Expected: a `SECURITY DEFINER` function that inserts a `public.profiles` row for `new.id`. Preserve everything except the credits value.

- [ ] **Step 2: Apply the migration** (MCP `apply_migration`, name `grant_credits_by_registration_stage`)

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, credits)
  values (new.id, 1);
  return new;
end;
$$;

-- Set the column default consistent with the flat grant.
alter table public.profiles alter column credits set default 1;
```

> Rule: a flat **1 credit** for every new account (down from default 3). NOTE: an earlier draft of
> this plan (and the Task 3/4 code blocks above) branched on a `used_free_scan` signup-metadata flag
> for a 2-credit early-registration bonus. **That was dropped** — the grant is unconditional and
> `signUp` sends no metadata (see commit `9cbdc3d` / dev-log 044). Ignore the `used_free_scan`
> references in the earlier steps.
> Reconcile `set search_path` / any extra statements with what Step 1 printed.

- [ ] **Step 3: Verify** (MCP `execute_sql`)

```sql
select pg_get_functiondef('public.handle_new_user'::regproc);
```

Expected: the new conditional body. No advisor regressions (`get_advisors` security — the function keeps `security definer` + `set search_path`).

- [ ] **Step 4: No code commit** (DB change). Note it in the dev-log (Task 11).

---

## Task 10: Manual configuration (cannot be automated)

These are dashboard/Resend steps required for the email links to work and to clear the deliverability warning. **Do them before the manual test in Task 11.**

- [ ] **Supabase → Authentication → URL Configuration**
  - Site URL: `https://fitaura.studio`
  - Redirect URLs: add `https://fitaura.studio/**` and `http://localhost:5173/**`

- [ ] **Supabase → Authentication → Email Templates**
  - *Confirm signup* link → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/vault`
  - *Reset password* link → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`

- [ ] **Resend**
  - Keep sending enabled; sender `auth@fitaura.studio`.
  - Disable click-tracking / link-rewriting for auth emails (one-time links break if rewritten).
  - Leave DKIM/SPF/DMARC DNS records untouched.

---

## Task 11: Verify end-to-end + dev-log

- [ ] **Step 1: Local checks**

Run from `apps/web`: `npm test` && `npm run build`
Expected: all tests PASS, build clean.

- [ ] **Step 2: Manual test report** (on prod `fitaura.studio` — Strategy A links can't be click-tested from localhost)

Confirm each:
- Sign up with a new email → the "CHECK YOUR EMAIL" modal shows the address; Resend disables for ~45s.
- The email is sent from `fitaura.studio`; the link starts with `https://fitaura.studio/auth/confirm` (not `supabase.co`).
- Clicking it → `/auth/confirm` "Confirming…" → lands in `/vault`, signed in, toast "Email confirmed — welcome"; refresh keeps the session.
- A reused/expired link → `/auth/confirm` "LINK INVALID" + "Back to sign in"; no token in the URL bar copy/logs.
- Signup with mismatched passwords → inline "Passwords don't match.", `signUp` not called.
- Try to log in before confirming → "CHECK YOUR EMAIL" scene with a Resend button.
- Forgot password → "CHECK YOUR EMAIL" (recovery copy) → link → `/auth/update-password` → set new password → `/vault`; new password logs in, old one fails.
- **Credits:** register before any scan → account shows **2**; use the free scan, then register → **1**.
- Regression: normal login, logout, session refresh, guest free-scan flow all still work.

- [ ] **Step 3: Write the dev-log** — create `docs/dev-log/044-auth-email-confirmation-and-reset.md` (decisions, the verifyOtp/first-party-link rationale, the credit-grant rule + the metadata-forgery caveat, the Strategy-A localhost caveat) and add it to `docs/dev-log/README.md` index.

```bash
git add docs/dev-log/044-auth-email-confirmation-and-reset.md docs/dev-log/README.md
git commit -m "docs(dev-log): 044 auth email confirmation + password reset"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Self-review notes (for the implementer)

- **No `@testing-library/react`** in the repo — do not write component/hook render tests. TDD is real for Tasks 1–3 (pure helpers + service); Tasks 4–8 are typecheck + build + the Task 11 manual report.
- **StrictMode double-invoke:** `AuthConfirm` guards `verifyOtp` with a `ran` ref because the token is single-use — a second call would fail and wrongly show the error state.
- **Type consistency:** `authSignUp(email, password, { usedFreeScan })` → `SignUpResult` (`status: 'confirm' | 'session'`); `authSignIn` → `SignInResult` (`needsConfirm?`); `authResend`/`authResetPassword`/`authVerifyOtp`/`authUpdatePassword` → `SimpleResult`. `AccountContext` adds `pendingEmail`, `confirmKind: 'signup' | 'recovery'`, `resendCooldown`, `resendConfirmation`, `requestPasswordReset`, and `Scene` gains `'confirm'`.
- **Metadata `used_free_scan`** is a string in `raw_user_meta_data` (`'true'`/`'false'`); the trigger compares against `'false'`.
