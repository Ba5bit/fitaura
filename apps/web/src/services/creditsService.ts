import { supabase } from '../lib/supabase';

export const FREE_SCAN_KEY = 'fitaura.freeScanUsed';

export type SpendResult = { ok: boolean; balance: number };

/** Current server credit balance for a signed-in user (0 on any error). */
export async function getBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.from('profiles').select('credits').eq('id', userId).single();
  if (error || !data) return 0;
  return data.credits;
}

/** Spend one credit. Refuses (without writing) when the balance is empty. */
export async function spendCredit(userId: string): Promise<SpendResult> {
  const balance = await getBalance(userId);
  if (balance <= 0) return { ok: false, balance: 0 };
  const next = balance - 1;
  const { error } = await supabase.from('profiles').update({ credits: next }).eq('id', userId);
  if (error) return { ok: false, balance };
  return { ok: true, balance: next };
}

/** Add n credits (used by the mock checkout). Returns the new balance. */
export async function grantCredits(userId: string, n: number): Promise<number> {
  const balance = await getBalance(userId);
  const next = balance + n;
  await supabase.from('profiles').update({ credits: next }).eq('id', userId);
  return next;
}

/** Guest free-scan flag — device-local, never server-bound. */
export function hasUsedFreeScan(): boolean {
  return localStorage.getItem(FREE_SCAN_KEY) === '1';
}

export function markFreeScanUsed(): void {
  localStorage.setItem(FREE_SCAN_KEY, '1');
}

/** Refund one credit (used when a scan fails after spending). Returns new balance.
 * NOTE: reuses grantCredits' read-modify-write, so it is NOT concurrency-safe — a
 * double-call could over-grant. Cycle 1 replaces this with a reserve/release RPC. */
export async function refundCredit(userId: string): Promise<number> {
  return grantCredits(userId, 1);
}

/** Restore the guest free-scan eligibility (used to refund a failed free scan). */
export function clearFreeScanUsed(): void {
  localStorage.removeItem(FREE_SCAN_KEY);
}
