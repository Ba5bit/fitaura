import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthUser = Pick<User, 'id' | 'email'>;
export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

/** Translate raw Supabase auth errors into copy we can show a user. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered')) return 'That email already has an account — try logging in.';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('password should be at least')) return 'Password is too short (minimum 6 characters).';
  if (m.includes('unable to validate email')) return 'That email address looks invalid.';
  if (m.includes('email') && m.includes('valid')) return 'That email address looks invalid.';
  return 'Something went wrong. Please try again.';
}

export async function authSignUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) return { ok: false, error: friendly(error?.message ?? 'no user') };
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? email } };
}

export async function authSignIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: friendly(error?.message ?? 'no user') };
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? email } };
}

export async function authSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
