// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable supabase query mock.
const { single, eqUpdate, update, from } = vi.hoisted(() => {
  const single = vi.fn();
  const eqSelect = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq: eqSelect }));
  const eqUpdate = vi.fn();
  const update = vi.fn(() => ({ eq: eqUpdate }));
  const from = vi.fn(() => ({ select, update }));
  return { single, eqUpdate, update, from };
});

vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { getBalance, spendCredit, grantCredits, refundCredit, hasUsedFreeScan, markFreeScanUsed, FREE_SCAN_KEY } from './creditsService';

beforeEach(() => {
  single.mockReset();
  eqUpdate.mockReset();
  update.mockClear();
  localStorage.clear();
});

describe('getBalance', () => {
  it('returns the credits for the user', async () => {
    single.mockResolvedValue({ data: { credits: 3 }, error: null });
    expect(await getBalance('u1')).toBe(3);
  });

  it('returns 0 when the row is missing or errors', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'no row' } });
    expect(await getBalance('u1')).toBe(0);
  });
});

describe('spendCredit', () => {
  it('decrements and returns ok when balance is positive', async () => {
    single.mockResolvedValue({ data: { credits: 2 }, error: null });
    eqUpdate.mockResolvedValue({ error: null });
    const res = await spendCredit('u1');
    expect(update).toHaveBeenCalledWith({ credits: 1 });
    expect(res).toEqual({ ok: true, balance: 1 });
  });

  it('refuses when balance is zero', async () => {
    single.mockResolvedValue({ data: { credits: 0 }, error: null });
    const res = await spendCredit('u1');
    expect(res).toEqual({ ok: false, balance: 0 });
    expect(update).not.toHaveBeenCalled();
  });

  it('spends the given amount when the balance covers it', async () => {
    single.mockResolvedValue({ data: { credits: 3 }, error: null });
    eqUpdate.mockResolvedValue({ error: null });
    const res = await spendCredit('u1', 2);
    expect(update).toHaveBeenCalledWith({ credits: 1 });
    expect(res).toEqual({ ok: true, balance: 1 });
  });

  it('refuses when the balance is short of the amount', async () => {
    single.mockResolvedValue({ data: { credits: 1 }, error: null });
    const res = await spendCredit('u1', 2);
    expect(res).toEqual({ ok: false, balance: 1 });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('grantCredits', () => {
  it('adds n credits to the current balance', async () => {
    single.mockResolvedValue({ data: { credits: 1 }, error: null });
    eqUpdate.mockResolvedValue({ error: null });
    const res = await grantCredits('u1', 5);
    expect(update).toHaveBeenCalledWith({ credits: 6 });
    expect(res).toBe(6);
  });
});

describe('refundCredit', () => {
  it('grants the given amount back to the current balance', async () => {
    single.mockResolvedValue({ data: { credits: 4 }, error: null });
    eqUpdate.mockResolvedValue({ error: null });
    const res = await refundCredit('u1', 2);
    expect(update).toHaveBeenCalledWith({ credits: 6 });
    expect(res).toBe(6);
  });
});

describe('guest free-scan flag', () => {
  it('is false until marked, true after', () => {
    expect(hasUsedFreeScan()).toBe(false);
    markFreeScanUsed();
    expect(hasUsedFreeScan()).toBe(true);
    expect(localStorage.getItem(FREE_SCAN_KEY)).toBe('1');
  });
});
