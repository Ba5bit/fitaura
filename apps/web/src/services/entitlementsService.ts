// apps/web/src/services/entitlementsService.ts
import { getSupabase } from '../lib/supabase';

export type RedeemStatus =
  | 'ok' | 'already_owned' | 'invalid' | 'expired' | 'exhausted' | 'unauthenticated';

export interface RedeemResult {
  status: RedeemStatus;
  /** Keys granted (present on ok / already_owned). */
  entitlements?: string[];
}

/** Codes are stored normalized (UPPER + trimmed); match that everywhere. */
export function normalizeCode(code: string): string {
  return (code ?? '').trim().toUpperCase();
}

/**
 * The new tables/RPC aren't in the generated `Database` types yet (the migration
 * is applied in a later, gated step). Narrow the client to the shape we use here
 * so this file typechecks before the tables exist. Regenerate database.types.ts
 * after the prod apply if you want to drop this.
 */
type EntClient = {
  from: (t: string) => {
    select: (c: string) => { eq: (col: string, v: string) => Promise<{ data: { entitlement: string }[] | null; error: unknown }> };
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

async function client(): Promise<EntClient> {
  return (await getSupabase()) as unknown as EntClient;
}

/** All entitlement keys the signed-in user owns ([] on any error / signed out). */
export async function getEntitlements(userId: string): Promise<string[]> {
  const sb = await client();
  const { data, error } = await sb.from('account_entitlements').select('entitlement').eq('user_id', userId);
  if (error || !data) return [];
  return data.map((r) => r.entitlement);
}

/** Redeem a code for the signed-in user. Returns the RPC's status payload. */
export async function redeemCode(code: string): Promise<RedeemResult> {
  const sb = await client();
  const { data, error } = await sb.rpc('redeem_code', { p_code: normalizeCode(code) });
  if (error || !data) return { status: 'invalid' };
  return data as RedeemResult;
}
