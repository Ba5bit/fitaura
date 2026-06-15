import { describe, expect, it } from 'vitest';
import {
  accountKeyFor, isExpired, trimToCap, mergeGuestIntoAccount,
  MAX_AGE_DAYS, type GenerationResult, type AccountData,
} from './generationDb';

const DAY = 86_400_000;
// Minimal GenerationResult stub — only the fields the helpers touch.
const res = (id: string, producedAt: string, name?: string): GenerationResult =>
  ({ receipt: { generationId: id }, producedAt, name } as unknown as GenerationResult);
const acct = (key: string, results: GenerationResult[], face: { url: string } | null = null, outfit: { url: string } | null = null, currentResultId: string | null = null): AccountData =>
  ({ session: { accountKey: key, face, outfit, currentResultId }, results });

describe('generationDb helpers', () => {
  it('accountKeyFor falls back to guest', () => {
    expect(accountKeyFor('u1')).toBe('u1');
    expect(accountKeyFor(null)).toBe('guest');
  });

  it('isExpired uses created-time and the 14-day window', () => {
    const now = Date.parse('2026-06-15T00:00:00.000Z');
    expect(isExpired('2026-06-15T00:00:00.000Z', now)).toBe(false);
    expect(isExpired(new Date(now - 13 * DAY).toISOString(), now)).toBe(false);
    expect(isExpired(new Date(now - 15 * DAY).toISOString(), now)).toBe(true);
    expect(MAX_AGE_DAYS).toBe(14);
    // Unparseable timestamps are kept (not expired).
    expect(isExpired('not-a-date', now)).toBe(false);
  });

  it('trimToCap keeps the newest N by producedAt', () => {
    const list = [res('a', '2026-06-01T00:00:00Z'), res('b', '2026-06-03T00:00:00Z'), res('c', '2026-06-02T00:00:00Z')];
    expect(trimToCap(list, 2).map((r) => r.receipt.generationId)).toEqual(['b', 'c']);
  });

  it('mergeGuestIntoAccount: guest scan overrides current, history merges + de-dupes', () => {
    const account = acct('u1', [res('old', '2026-06-01T00:00:00Z')], { url: 'acctFace' }, null, 'old');
    const guest = acct('guest', [res('g1', '2026-06-10T00:00:00Z')], { url: 'guestFace' }, { url: 'guestFit' }, 'g1');
    const merged = mergeGuestIntoAccount(account, guest);
    expect(merged.session.face).toEqual({ url: 'guestFace' }); // guest overrides
    expect(merged.session.outfit).toEqual({ url: 'guestFit' });
    expect(merged.session.currentResultId).toBe('g1');
    expect(merged.session.accountKey).toBe('u1');
    expect(merged.results.map((r) => r.receipt.generationId)).toEqual(['g1', 'old']); // newest first, both kept
  });

  it('mergeGuestIntoAccount keeps account values when guest is empty', () => {
    const account = acct('u1', [res('old', '2026-06-01T00:00:00Z')], { url: 'acctFace' }, null, 'old');
    const guest = acct('guest', []);
    const merged = mergeGuestIntoAccount(account, guest);
    expect(merged.session.face).toEqual({ url: 'acctFace' });
    expect(merged.session.currentResultId).toBe('old');
    expect(merged.results.map((r) => r.receipt.generationId)).toEqual(['old']);
  });
});
