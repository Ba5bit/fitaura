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
