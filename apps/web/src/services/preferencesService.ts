import type { ReceiptPaper } from '@fitaura/shared';
import { supabase } from '../lib/supabase';

/**
 * Account preferences that follow the user across devices. Stored on the same
 * per-account `profiles` row as the credit balance (RLS: owner-only read/write),
 * so they sync wherever the user signs in. Guests fall back to device-local
 * storage — see PreferencesContext.
 */
export interface AccountPreferences {
  /** Default Dating Score Receipt paper new scans use. */
  receiptPaper: ReceiptPaper;
  /** Tone down scanner sweeps, count-ups and sticker pops. */
  reduceMotion: boolean;
}

export const DEFAULT_PREFERENCES: AccountPreferences = {
  receiptPaper: 'neon',
  reduceMotion: false,
};

const PAPERS: readonly ReceiptPaper[] = ['neon', 'thermal', 'premium', 'white'];
const asPaper = (v: unknown): ReceiptPaper =>
  PAPERS.includes(v as ReceiptPaper) ? (v as ReceiptPaper) : DEFAULT_PREFERENCES.receiptPaper;

/** Read the signed-in user's saved preferences (null on any error / missing row). */
export async function getPreferences(userId: string): Promise<AccountPreferences | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('receipt_paper, reduce_motion')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    receiptPaper: asPaper(data.receipt_paper),
    reduceMotion: !!data.reduce_motion,
  };
}

/** Persist a partial preference change to the user's account. Best-effort. */
export async function savePreferences(userId: string, patch: Partial<AccountPreferences>): Promise<void> {
  const row: { receipt_paper?: ReceiptPaper; reduce_motion?: boolean } = {};
  if (patch.receiptPaper !== undefined) row.receipt_paper = patch.receiptPaper;
  if (patch.reduceMotion !== undefined) row.reduce_motion = patch.reduceMotion;
  if (Object.keys(row).length === 0) return;
  await supabase.from('profiles').update(row).eq('id', userId);
}
