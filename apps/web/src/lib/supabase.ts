import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)');
}

let clientPromise: Promise<SupabaseClient<Database>> | null = null;

/**
 * Lazily create the one Supabase client, **dynamically importing** the heavy
 * `@supabase/supabase-js` library so it is NOT part of the initial bundle. The
 * public Landing paints and becomes interactive without paying to parse it; the
 * first auth/data call (AccountContext's post-mount session check) triggers the
 * async load, and every caller shares the single cached client.
 *
 * Auth options are unchanged from the old eager client:
 * - `persistSession` + `autoRefreshToken`: returning visitors stay signed in and
 *   the access token silently refreshes (critical on iOS/Safari backgrounded tabs).
 * - `detectSessionInUrl` + `flowType: 'pkce'`: the OAuth/confirm redirect returns a
 *   one-time `?code=…` that the client exchanges for a session. The client is
 *   created on mount (still on the callback URL), so the exchange still happens.
 * - default `storageKey` (`sb-<ref>-auth-token`) kept, so existing users are not
 *   signed out on deploy.
 */
export function getSupabase(): Promise<SupabaseClient<Database>> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient<Database>(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }),
    );
  }
  return clientPromise;
}
