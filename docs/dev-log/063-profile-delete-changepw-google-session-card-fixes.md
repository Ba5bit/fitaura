# 063 — Known-issue batch: delete account, change password, Google sign-in, session hardening, card export fixes

**Date:** 2026-06-22
**Scope:** Five reported issues fixed in one pass, dispatched across parallel/sequential agents.

## What & why

### 1. Delete account (replaced "Export account data")
The Account Info page (`features/vault/AccountInfo.tsx`) had a non-functional "Export account data" row. Replaced it with a real, destructive **Delete account** flow.

- `services/authService.ts` → `authDeleteAccount()` calls a new `delete_own_account` RPC, then best-effort `signOut()`.
- `AccountContext.confirmDeleteAccount()` is **server-first**: if the RPC fails, local data is kept. On success it wipes the device — IndexedDB scan history/session via `clearAccount(accountKeyFor(userId))` **and** every `fitaura.*` localStorage key — then resets account state, navigates `/`, flashes "Account deleted."
- New `DeleteAccountConfirm` modal (mirrors `LogoutConfirm`; non-closeable while deleting).
- **Migration** `supabase/migrations/20260622120000_delete_own_account.sql`: `SECURITY DEFINER` function deleting only `auth.uid()` (profiles row first, then `auth.users`; `profiles` FK is `ON DELETE CASCADE`). `EXECUTE` granted to `authenticated` only. **Applied to prod via MCP** (verified: `prosecdef=true`, execute not granted to anon/public).

### 2. Change password (the "Manage" button)
"Manage" next to "Password & sign-in" was a placeholder flash. Now opens a `ChangePassword` modal that calls the existing `authUpdatePassword` directly (the user has a live session — no email round-trip).

### 3. Google sign-in (scaffold)
- `authSignInWithGoogle()` → `signInWithOAuth({ provider:'google', redirectTo: ${origin}/auth/callback, queryParams:{ prompt:'select_account' } })`.
- New `/auth/callback` route → `features/auth/AuthCallback.tsx` (relies on `detectSessionInUrl` + PKCE to auto-exchange the code; dual session detection via `onAuthChange` + `getCurrentSession`; 8s safety timeout → friendly error).
- "Continue with Google" button added to `AuthGate` (reuses pre-existing unused `.aw-oauth`/`.aw-or` CSS + `Icon.google`).
- **Gated:** `GOOGLE_AUTH_ENABLED = import.meta.env.DEV || VITE_ENABLE_GOOGLE_AUTH === 'true'`. The Google OAuth app is still in "Testing" mode, so the button is **hidden on production** (would block non-test users) and shown in local dev. Flip it on later by publishing the Google app + setting `VITE_ENABLE_GOOGLE_AUTH=true` in Vercel. Verified working end-to-end on localhost.

### 4. Session persistence hardening
Reported: logged out the same day on iPhone/macOS. Code audit found nothing dropping the session (no stray `signOut`; the delete-account wipe targets `fitaura.*`, not the `sb-*` auth token). Hardened `lib/supabase.ts` with explicit `persistSession`/`autoRefreshToken`/`detectSessionInUrl` + `flowType:'pkce'`. **Deliberately did NOT set a custom `storageKey`** — the default already sits outside the `fitaura.` wipe prefix, and changing it would sign every existing user out once on deploy. **Most-likely true cause is server-side** (Supabase → Auth → Sessions: time-box/inactivity/single-session/refresh-reuse) — pending dashboard verification by the owner.

### 5. Card export visual bugs
- **"VERIFIED PASS" pill wrapped** in the exported PNG (Desktop) but not iPhone: `.rcp-passtag` is a `space-between` flex child with no `white-space:nowrap`; snapdom's scale-3 raster rounds its width down a fraction → wrap. Fix: `white-space:nowrap; flex:none;`.
- **Rounded "circled" corner artifact** at top-left/right of every full-bleed export: export squares `.asset` but an inline style can't reach the `.asset::after` top-sheen pseudo, which kept its 26px radius → `mix-blend-mode:screen` sheen left dark wedges at the squared corners. Fix: `exportCard.ts` adds a reversible `is-squared-export` class to the capture target; `.asset.is-squared-export::after { border-radius:0 !important }` in `fitaura.css`. Export-only — on-screen cards stay rounded.

## Verification
- `npm --prefix apps/web run build` clean (tsc + vite); `vitest` 134/134 pass (incl. new `authDeleteAccount` + `authSignInWithGoogle` tests).
- Card fixes are root-cause-confirmed + build-green; not yet pixel-verified in an actual export render.

## Follow-ups
- Verify the Supabase session/dashboard settings (the real fix for #4).
- Publish the Google OAuth app + verify the `fitaura.studio` domain (Search Console) before exposing Google publicly; then enable `VITE_ENABLE_GOOGLE_AUTH` on prod.
- Optional: regenerate `database.types.ts` to drop the `supabase.rpc` cast in `authDeleteAccount`.
- Optional: pixel-verify the card export via the DEV `/dev/cards` route.
