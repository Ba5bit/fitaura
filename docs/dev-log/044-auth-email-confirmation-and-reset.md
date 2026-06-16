# 044 — Email confirmation, password reset & registration credit grant

Email confirmation was turned **on** in Supabase (auth emails delivered via Resend SMTP,
sender `auth@fitaura.studio`). The app was built for confirm-email **off**, so this pass
reworks the auth flow to: prompt users to confirm, verify the link on a **first-party**
route, add a **password-reset** flow, require a **confirm-password** field on signup, and
change the **registration credit grant**. Built subagent-driven from a spec + plan:

- Spec: `docs/superpowers/specs/2026-06-16-confirm-email-password-reset-design.md`
- Plan: `docs/superpowers/plans/2026-06-16-confirm-email-password-reset.md`
- Setup reference (user-supplied): `~/Downloads/FITAURA_SUPABASE_RESEND_AUTH.md`

`tsc` + `vite build` clean; 87 unit tests pass. Branch `feat/auth-email-confirmation`.

## The core decision: verify on a first-party `/auth/confirm` (token_hash + verifyOtp)
The default Supabase template uses `{{ .ConfirmationURL }}`, which points the email link at
`https://<ref>.supabase.co/auth/v1/verify`. Since the email is *sent* from `fitaura.studio`,
Resend flags the link-domain ≠ sending-domain mismatch (a deliverability warning). The fix —
and the reason the flow looks the way it does — is to make the link first-party:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/vault
```

`/auth/confirm` (a public SPA route) reads `token_hash`/`type`/`next`, calls
`supabase.auth.verifyOtp({ token_hash, type })`, and on success the session is established;
`AccountContext`'s existing `onAuthChange` listener promotes the user to signed-in, and the
page navigates to the sanitized `next` (default `/vault`). **This is "Strategy A"** from the
reference doc: the template hard-codes `{{ .SiteURL }}`, so `signUp` does NOT pass
`emailRedirectTo`. Consequence worth remembering: **the link always targets the Site URL
(`fitaura.studio`), so confirmation/recovery can't be click-tested from `localhost`** — verify
on prod. (Strategy B — dynamic `emailRedirectTo` + `{{ .RedirectTo }}` — is possible later but
the doc advises against it unless multi-env email is actually needed.)

Recovery uses the same route: `type=recovery&next=/auth/update-password`. `verifyOtp` with
`recovery` establishes a recovery session; `/auth/update-password` is **gated** on that session
(`getCurrentSession()` → if none, "request a new link") before calling
`supabase.auth.updateUser({ password })`.

## Flow rework (was built for confirm-email OFF)
- **`AccountContext.signUp`** previously relied on Supabase auto-creating a session on signup,
  then called `authSignOut()` and told the user to "now log in" (a deliberate two-step). With
  confirmation on, signUp creates **no** session, so that hack is gone. `signUp` now opens a new
  **`confirm` scene** (`scene: 'confirm'`) showing "check your email" with `pendingEmail`.
  (A defensive `status === 'session'` branch still calls `finishAuth` so the app doesn't strand a
  user if confirmation is ever turned back off.)
- **`logIn`** maps Supabase's "Email not confirmed" error (via `authSignIn`'s `needsConfirm`
  flag) to the same `confirm` scene so the user can resend — instead of the old generic
  "Something went wrong."
- **Resend** (`supabase.auth.resend({ type: 'signup' })` / `resetPasswordForEmail` for recovery)
  is cooldown-guarded (~45s) in the context, surfaced on the `EmailSentNotice` modal.
- **`AuthGate`** gained a third `reset` mode (a "Forgot password?" link on the login tab →
  email-only form → `requestPasswordReset`) and a **confirm-password** field on signup
  (`signupPasswordError` blocks submit on mismatch — user feedback: typos were silently locking
  people out of accounts they then couldn't confirm).

## Gotchas worth keeping
- **`friendly()` ordering bug (caught in review).** Supabase returns "Unable to validate email
  address: invalid format" for a mistyped email. The `expired || invalid` catch-all (for bad
  links) contains "invalid" and was positioned *above* the email-validation cases, so a typo'd
  email showed "This link is invalid or has expired." Fix: email-validation checks must come
  **before** the generic `expired || invalid` line in `authService.ts`. Order matters in this
  function — add new cases with that in mind.
- **StrictMode double-invoke on `/auth/confirm`.** The verify effect is guarded by a `ran` ref:
  the OTP token is single-use, so a second dev-StrictMode invocation would fail and wrongly show
  the error state.
- **"Back to log in" tab.** `openAuth()` defaults the modal to the *signup* tab. `EmailSentNotice`
  and `AuthConfirm`'s error state pass `openAuth(undefined, 'login')` (a new `mode` arg →
  `authInitialMode` → `AuthGate`'s initial mode) so "Back to log in" actually lands on login.
- **Security (from the reference doc):** `type` is validated against an allowlist
  (`isSupportedOtpType`), `next` is sanitized against open redirects (`getSafeNextPath` — rejects
  `//`, `https://`, `javascript:`), and `token_hash` is never logged or rendered. Both helpers are
  pure + unit-tested.

## Registration credit grant — flat 1 credit
A new account gets a flat **1 credit** (was a default of 3), granted server-side by the
`public.handle_new_user` trigger. The first scan spends it (1→0), regardless of entry path
(scan-from-landing or register-then-scan).

We briefly designed — and built — a "2 credits if you register **before** generating any image"
bonus, to equalize the scan-first path (free guest scan + 1 granted credit) against the
register-first path (1 credit only). It was implemented by sending a `used_free_scan` flag as
signup metadata and branching in the trigger. **We dropped it for simplicity** (user call): every
new account just gets 1. That's why `authSignUp` takes no metadata arg and the trigger is
unconditional — if you find references to `used_free_scan` anywhere, they're leftovers to remove.

## NOT done in this branch — required to actually ship (deploy-time / manual)
The frontend is complete and merged, but the feature is **not fully live** until:
1. **DB trigger migration** (plan Task 9) — redefine `handle_new_user` to grant a flat **1**
   credit (was default 3). Applied via the Supabase MCP `apply_migration` at deploy time. Note:
   this drops new signups from 3 → 1 credit the moment it's applied, so coordinate it with the
   frontend deploy. SQL is in the plan.
2. **Supabase dashboard** (plan Task 10) — Site URL `https://fitaura.studio`; redirect allow-list
   `https://fitaura.studio/**` + `http://localhost:5173/**`; edit the **Confirm signup** and
   **Reset password** email templates to the first-party `/auth/confirm` links above.
3. **Resend** — disable click-tracking / link-rewriting for auth emails (one-time links break if
   rewritten).
4. **Manual prod test** — Strategy A means the click-through can only be exercised on prod; see
   the plan's Task 11 checklist (signup confirm, expired link, recovery, mistyped-email message,
   credits 1-vs-2).
