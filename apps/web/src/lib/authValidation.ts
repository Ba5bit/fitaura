/** Client-side signup password check. Returns an error string, or null when valid.
 * Length/strength is enforced by Supabase; this only guards the confirm field. */
export function signupPasswordError(password: string, confirm: string): string | null {
  if (password.length === 0) return 'Enter a password.';
  if (password !== confirm) return "Passwords don't match.";
  return null;
}
