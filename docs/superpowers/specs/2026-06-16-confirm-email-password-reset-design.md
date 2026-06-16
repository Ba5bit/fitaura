# Design — Email confirmation, password reset & registration credit grant

**Date:** 2026-06-16
**Status:** approved (brainstorming) — pending implementation plan
**Reference:** `~/Downloads/FITAURA_SUPABASE_RESEND_AUTH.md` (the canonical Supabase + Resend
first-party-link setup this design implements).

## Problem

Email confirmation was turned **on** in Supabase, and auth emails are delivered via Resend SMTP
(sender `auth@fitaura.studio`). Two gaps result:

1. **The app doesn't tell users to confirm.** The current signup flow was built for
   confirm-email **off**: `AccountContext.signUp` relies on Supabase auto-creating a session,
   then calls `authSignOut()` and the modal tells the user to "now log in" (`AccountModals.tsx`
   `AuthGate.submit`). With confirmation on there is no session, login-before-confirm fails with
   an error `friendly()` doesn't map, and nothing shows a "check your email" state.
2. **The confirmation link points at `supabase.co`.** The default `{{ .ConfirmationURL }}`
   template generates a `https://<ref>.supabase.co/auth/v1/verify` link, while the email is sent
   from `fitaura.studio` — triggering Resend's domain-mismatch deliverability warning.

Separately, the registration **credit grant** is being changed (see §5).

## Goals

- After signup, clearly prompt the user to confirm their email; let them resend.
- Verify the email via a **first-party `fitaura.studio/auth/confirm`** link (fixes the Resend
  warning) using `token_hash` + `verifyOtp` (the SPA path from the reference doc).
- Add a **password-reset** flow (forgot password → email → set new password).
- Require the password to be entered **twice on registration** (a confirm-password field) so typos
  can't silently lock a user out of an account they then can't confirm.
- Change the registration credit grant to **1 credit**, or **2** when the user registers before
  generating any image.
- No RLS weakening, no second Supabase client, no secrets in client code, no open redirects.

## Non-goals

- OAuth / magic-link / invite / email-change flows (the `/auth/confirm` `type` allowlist is
  forward-compatible, but only `email` and `recovery` are wired this pass).
- Hardening credits against forgery (the owner-`update` RLS gap and the metadata-trust gap in §5
  remain a deferred "Cycle 1" item).
- Switching to PKCE or SSR. The app stays a client-only SPA; sessions persist to localStorage via
  the existing browser client.

## Architecture overview

The app is **Vite + React + React Router**, client-only (no SSR). One Supabase browser client in
`lib/supabase.ts` (`persistSession: true`, default `flowType: 'implicit'`, `detectSessionInUrl`
default true — but verification is done explicitly via `verifyOtp`, not URL auto-detect). The
service seam rule holds: **`services/authService.ts` is the only file touching Supabase auth**;
contexts call services; UI calls contexts.

### Two user journeys

```
SIGNUP:    sign up → [modal] "Check your email" → click first-party link
           → /auth/confirm (verifyOtp type=email) → signed in → /vault

RECOVERY:  login tab → "Forgot password?" → enter email → [modal] "Reset link sent"
           → click link → /auth/confirm (verifyOtp type=recovery)
           → /auth/update-password → set new password → signed in → /vault
```

## 1. New routes (`App.tsx`, added before the `*` catch-all)

### `/auth/confirm` — `AuthConfirm` (public)
1. Read `token_hash`, `type`, `next` from the query string.
2. Validate `type` against an allowlist — `isSupportedOtpType` (pure): accepts
   `'email' | 'recovery'` (allow `'invite' | 'email_change'` in the type guard for
   forward-compatibility, but only `email`/`recovery` have wired destinations this pass).
3. Sanitize `next` — `getSafeNextPath(value, fallback)` (pure): return `fallback` unless the value
   begins with exactly one `/` (reject `null`, `//…`, `https://…`, `javascript:…`). Fallback is
   type-based: `recovery → /auth/update-password`, otherwise `/vault`.
4. If `token_hash` missing or `type` invalid → render the **invalid-link** state immediately
   (no `verifyOtp` call).
5. Otherwise call `authVerifyOtp(token_hash, type)`:
   - **success** → the session is now persisted; `navigate(safeNext, { replace: true })`. For
     `email`, `AccountContext` picks up the new session and the user lands in `/vault` signed in
     (toast "Email confirmed — welcome"). For `recovery`, lands on `/auth/update-password` with a
     recovery session.
   - **failure** → **invalid/expired-link** state: "This link is invalid or has expired." + a
     single action "Back to sign in" (opens the auth modal, login tab). Resend lives in the modal,
     where the user re-enters their email — we don't have the email at the callback.
6. States: a "Confirming your email…" loader while `verifyOtp` is in flight; success is a brief
   pass-through (immediate redirect); the invalid state as above.
7. **Never** render or log `token_hash` / tokens.

Styling reuses the result-shell / `aw-*` visual language (minimal centered card), consistent with
existing scenes; no new design system.

### `/auth/update-password` — `UpdatePassword` (recovery-session-gated)
- On mount, require a session (the recovery session established by `/auth/confirm`). If none →
  show "This reset link is no longer valid — request a new one" with a "Back to sign in" action;
  do **not** render the form. (Guard prevents password change without a valid recovery session.)
- New-password form (password + confirm) → `authUpdatePassword(password)` → on success
  `navigate('/vault')` + toast "Password updated." On error → `friendly()` message inline.

## 2. Modal scenes (`AccountModals.tsx` + `AccountOverlays.tsx`)

### `EmailSentNotice` — new `scene: 'confirm'`
Reuses `WebModal` + `aw-*` (mirrors `PaySuccess` structure). Parameterized by
`confirmKind: 'signup' | 'recovery'` (held in `AccountContext`):
- **signup:** "CHECK YOUR EMAIL", "We sent a confirmation link to **{pendingEmail}** — click it to
  activate your account.", **Resend confirmation** button, "Back to log in" link.
- **recovery:** "CHECK YOUR EMAIL", "We sent a password-reset link to **{pendingEmail}**.",
  **Resend reset link** button, "Back to log in" link.
- The resend button enforces a **~45s cooldown** (disabled + countdown), shows "Sent ✓" feedback,
  and surfaces Supabase's own rate-limit error if it returns one.

`AccountOverlays.tsx` gains `{scene === 'confirm' && <EmailSentNotice />}`.

### `AuthGate` — add a third `reset` mode
`mode: 'signup' | 'login' | 'reset'`. The login tab gains a "Forgot password?" link → switches to
`reset` mode: email-only field + "Send reset link" button → `requestPasswordReset(email)` → opens
the `confirm` scene with `confirmKind: 'recovery'`. The existing form shell/segmented control is
reused. The post-signup branch (`submit` when `isSignup`) **no longer** switches to the login tab
with a "now log in" notice — it defers to `AccountContext.signUp`, which opens the `confirm` scene.

**Fields per mode.** `signup` → Email + Password + **Confirm password**; `login` → Email +
Password; `reset` → Email only. In `signup`, submit is blocked with an inline "Passwords don't
match" message (and never calls `signUp`) unless the two password fields are equal; the confirm
field is cleared on mode switch alongside the existing password reset. The match check is a tiny
pure predicate so the mismatch path is unit-testable.

## 3. Service layer (`authService.ts`)

- `authSignUp(email, password)` — pass signup metadata for the credit rule (see §5):
  `supabase.auth.signUp({ email, password, options: { data: { used_free_scan: hasUsedFreeScan() } } })`.
  Returns a result distinguishing: **ok + confirmation pending** (`!data.session`), **ok + session**
  (defensive; shouldn't happen with confirm on), and **already-registered** (`data.user` present
  with `identities` empty → "That email already has an account — try logging in.").
- `authResend(email)` — `supabase.auth.resend({ type: 'signup', email })` (template builds the
  first-party link; no `emailRedirectTo` needed under Strategy A).
- `authResetPassword(email)` — `supabase.auth.resetPasswordForEmail(email)` (recovery template
  builds the link; Strategy A).
- `authVerifyOtp(token_hash, type)` — `supabase.auth.verifyOtp({ token_hash, type })`.
- `authUpdatePassword(password)` — `supabase.auth.updateUser({ password })`.
- `friendly(message)` — add cases: "email not confirmed" → "Please confirm your email first — check
  your inbox (and spam)."; reset/recovery errors → sensible copy. Keep returning safe, non-technical
  strings.
- Pure helpers (unit-tested, exported): `getSafeNextPath`, `isSupportedOtpType`.

## 4. Context (`AccountContext.tsx`)

- `Scene` union gains `'confirm'`.
- New state: `pendingEmail: string | null`, `confirmKind: 'signup' | 'recovery'`, and a resend
  cooldown timestamp.
- `signUp` — remove the `authSignOut()` hack and the "two deliberate steps" comment. On
  confirmation-pending: set `pendingEmail`, `confirmKind: 'signup'`, `scene: 'confirm'`. On
  already-registered: set `authError`. Returns success boolean.
- `logIn` — on "email not confirmed": set `pendingEmail` (from the just-entered login email),
  `confirmKind: 'signup'`, and open the `confirm` scene so the user sees the friendly "confirm
  first" copy and a Resend button (one resend path, no separate inline variant). Otherwise
  unchanged.
- New actions: `requestPasswordReset(email)` → `authResetPassword` then set `pendingEmail`,
  `confirmKind: 'recovery'`, `scene: 'confirm'`; `resendConfirmation()` → cooldown-guarded
  `authResend` / `authResetPassword` keyed by `confirmKind`.
- Existing `finishAuth` / session hydration (`onAuthChange`) is unchanged and already promotes the
  user to signed-in once `/auth/confirm` establishes the session — so the email-confirm path lands
  in `/vault` with no extra wiring beyond the redirect.

## 5. Registration credit grant (1, or 2 when registered before generating)

**Rule.**
- Base grant on a new account = **1 credit**. (Covers "register *after* a scan → 1".)
- If the user **registers before generating any image** = **2 credits**.

"Before generating any image" = the guest has **not consumed the free scan** on this device:
`!hasUsedFreeScan()` (the `fitaura.freeScanUsed` flag in `creditsService.ts`), cross-checked by an
empty generation `history`. The signup modal commonly appears *after* a guest's free scan (→ 1) or
*before* any scan from the landing/nav (→ 2), which matches the intent.

**Mechanism — metadata-driven trigger (server-side, atomic).**
- The client passes `options.data.used_free_scan: boolean` on `signUp` (§3).
- The existing `public.handle_new_user` `SECURITY DEFINER` trigger (today inserts the profile with
  `credits` default 3) is altered to grant: `2` when `new.raw_user_meta_data->>'used_free_scan'`
  is `'false'` (registered before generating), else `1`. Default when metadata is absent/anything
  else: **1** (conservative).
- There are **no committed `supabase/migrations/*.sql`** in the repo — schema lives in Supabase and
  is changed via the Supabase MCP `apply_migration` (or dashboard). This change is one migration
  redefining `handle_new_user` (and dropping the column `default 3`, or leaving it — the trigger
  sets the value explicitly).

**Why not a client top-up (+1 via `grantCredits`)?** That uses the owner-`update` path the credit
hardening cycle wants to remove and is non-atomic. The trigger keeps the grant in one place,
server-side.

**Known gap (accepted, deferred).** A user could forge `used_free_scan: false` to get 2 instead of
1 — a 1-credit abuse, consistent with the existing "credits not yet forgery-proof" posture. Real
hardening (reserve/consume RPC, server-authoritative grant) stays in the deferred Cycle 1.

## 6. Manual configuration (cannot be done in code)

**Supabase → Authentication → URL Configuration**
- Site URL: `https://fitaura.studio`.
- Redirect allow-list: add `https://fitaura.studio/**` and `http://localhost:5173/**`.

**Supabase → Authentication → Email Templates** (Strategy A — Site URL in template)
- *Confirm signup:* link → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/vault`.
- *Reset password:* link → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`.

**Resend**
- Keep sending enabled; sender `auth@fitaura.studio`.
- **Disable click-tracking / link-rewriting** for auth emails — one-time links break if rewritten.
- Do not alter the verified DKIM/SPF/DMARC DNS records.

**Database (via Supabase MCP)**
- Apply the `handle_new_user` grant change from §5.

## 7. Testing

**Unit (Vitest, existing `vi.hoisted` supabase mock):**
- Pure helpers: `getSafeNextPath` (incl. the three malicious values `https://evil.example`,
  `//evil.example`, `javascript:alert(1)` → fallback) and `isSupportedOtpType`.
- `authService` wrappers call the right Supabase methods with the right args (incl. `signUp`
  passing `used_free_scan`), and `friendly()` maps the not-confirmed error.
- `AccountContext`: `signUp` → `scene='confirm'` + `pendingEmail` + `confirmKind='signup'`;
  already-registered → `authError`; `logIn` not-confirmed → error + resend affordance;
  `requestPasswordReset` → `confirm`/recovery; resend cooldown blocks rapid re-clicks.
- `AuthGate` signup: mismatched passwords block submit with the inline error and do not call
  `signUp`; matching passwords proceed.

**Manual test report (per the reference doc checklist):**
- Signup: email arrives from `fitaura.studio`, link starts with `https://fitaura.studio/auth/confirm`
  (not `supabase.co`), click → verified → session → `/vault`; refresh keeps the session.
- Expired/reused link → friendly invalid state; no token in UI/logs.
- Recovery: forgot password → email → `/auth/confirm?type=recovery` → `/auth/update-password` →
  new password works, old fails.
- Credit grant: register before any scan → 2 credits; use free scan then register → 1 credit.
- Regression: normal login, logout, session refresh, guest free-scan flow, DB profile creation.

**Dev caveat:** Strategy A points the email link at the Site URL (`fitaura.studio`), so the
click-through cannot be exercised from `localhost`; confirmation/recovery are verified on prod.

## 8. Files (anticipated)

- New: `apps/web/src/features/auth/AuthConfirm.tsx`, `apps/web/src/features/auth/UpdatePassword.tsx`,
  `apps/web/src/lib/authRedirect.ts` (pure `getSafeNextPath`/`isSupportedOtpType`) + tests.
- Changed: `App.tsx` (2 routes), `services/authService.ts` (+tests), `features/account/AccountContext.tsx`,
  `features/account/AccountModals.tsx` (AuthGate reset mode + `EmailSentNotice`),
  `features/account/AccountOverlays.tsx` (confirm scene), `design/*.css` as needed for the new
  scene/pages.
- DB (via MCP): `handle_new_user` grant change.
- Manual: Supabase URL config + email templates; Resend tracking setting.
