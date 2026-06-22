import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Persist the session to localStorage so a returning visitor stays signed in
    // across reloads and tabs (the source of truth for our AccountContext).
    persistSession: true,
    // Silently refresh the access token before it expires. Critical on
    // iOS/Safari, where a backgrounded tab can sit past the token's short TTL;
    // supabase-js re-arms this timer on focus/visibility so the session survives.
    autoRefreshToken: true,
    // Required for the OAuth/email return: after Google (or a magic/confirm link)
    // redirects back with `?code=…` (or a hash), the client reads the URL and
    // exchanges it for a session automatically. Without this, /auth/callback
    // would never get a session.
    detectSessionInUrl: true,
    // PKCE is the secure browser flow and is what makes the OAuth redirect come
    // back as a one-time `?code=…` (exchanged via the code_verifier this client
    // stashed). Our email confirm/reset uses verifyOtp(token_hash), which is
    // independent of flowType, so this doesn't affect those links.
    flowType: 'pkce',
    // NB: we deliberately keep supabase-js's default storageKey
    // (`sb-<ref>-auth-token`). It already sits outside the `fitaura.` prefix the
    // delete-account flow wipes, and changing it would sign every existing user
    // out once on deploy — the opposite of fixing the persistence complaint.
  },
});
