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
  if (m.includes('should be different') || m.includes('same as the old') || m.includes('same_password'))
    return 'Your new password must be different from your current one.';
  if (m.includes('weak') || m.includes('pwned') || m.includes('breach'))
    return 'That password is too weak or has appeared in a data breach — pick another.';
  if (m.includes('unable to validate email')) return 'That email address looks invalid.';
  if (m.includes('email') && m.includes('valid')) return 'That email address looks invalid.';
  if (m.includes('expired') || m.includes('invalid')) return 'This link is invalid or has expired.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts — wait a minute and try again.';
  return 'Something went wrong. Please try again.';
}

export async function authSignUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
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

/** Begin the "Continue with Google" OAuth flow. On success the browser is
 * redirected to Google and never returns from this promise (Supabase navigates
 * away), so a resolved { ok: true } only means the handshake started. The
 * callback lands on `/auth/callback?code=…`; with flowType 'pkce' +
 * detectSessionInUrl, the client auto-exchanges the code for a session there.
 *
 * `redirectTo` is derived from window.location.origin so the SAME build works in
 * prod (https://fitaura.studio) and local dev (http://localhost:5173) — both must
 * be listed in Supabase → Auth → URL Configuration → Redirect URLs.
 * `prompt: 'select_account'` always shows Google's account chooser instead of
 * silently reusing the last-used Google account. */
export async function authSignInWithGoogle(): Promise<SimpleResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function authSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Permanently delete the caller's own account (profile + credit balance + auth
 * user) via the SECURITY DEFINER `delete_own_account` RPC. On success, revoke the
 * now-orphaned local session (best-effort — the user no longer exists server-side). */
export async function authDeleteAccount(): Promise<SimpleResult> {
  // `delete_own_account` is added by a migration applied out-of-band, so it isn't
  // in the generated `Database` types yet. Reach the rpc via a minimal shape until
  // the types are regenerated (this is the only client-side RPC so far).
  const rpc = (supabase as unknown as {
    rpc: (fn: string) => Promise<{ error: { message: string } | null }>;
  }).rpc;
  const { error } = await rpc('delete_own_account');
  if (error) return { ok: false, error: friendly(error.message) };
  await supabase.auth.signOut().catch(() => {});
  return { ok: true };
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
