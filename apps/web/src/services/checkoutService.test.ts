import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => Promise.resolve({ functions: { invoke } }) }));

import { createCheckout, pollBalanceUntilChange } from './checkoutService';

beforeEach(() => invoke.mockReset());

describe('createCheckout', () => {
  it('invokes the edge function with the packId and returns the url', async () => {
    invoke.mockResolvedValue({ data: { ok: true, url: 'https://polar/c/abc' }, error: null });
    const url = await createCheckout('regular');
    expect(invoke).toHaveBeenCalledWith('create-checkout', { body: { packId: 'regular' } });
    expect(url).toBe('https://polar/c/abc');
  });

  it('throws when the edge function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(createCheckout('regular')).rejects.toThrow();
  });

  it('throws when the payload is not ok', async () => {
    invoke.mockResolvedValue({ data: { ok: false, message: 'unknown_pack' }, error: null });
    await expect(createCheckout('regular')).rejects.toThrow();
  });
});

describe('pollBalanceUntilChange', () => {
  it('returns immediately when the balance is already higher', async () => {
    const getBalanceFn = vi.fn().mockResolvedValue(15);
    const next = await pollBalanceUntilChange('u1', 5, { getBalanceFn, intervalMs: 1 });
    expect(next).toBe(15);
    expect(getBalanceFn).toHaveBeenCalledTimes(1);
  });

  it('polls until the balance increases', async () => {
    const getBalanceFn = vi.fn()
      .mockResolvedValueOnce(5).mockResolvedValueOnce(5).mockResolvedValueOnce(35);
    const next = await pollBalanceUntilChange('u1', 5, { getBalanceFn, intervalMs: 1 });
    expect(next).toBe(35);
    expect(getBalanceFn).toHaveBeenCalledTimes(3);
  });

  it('returns the last reading after exhausting attempts', async () => {
    const getBalanceFn = vi.fn().mockResolvedValue(5);
    const next = await pollBalanceUntilChange('u1', 5, { getBalanceFn, attempts: 3, intervalMs: 1 });
    expect(next).toBe(5);
    expect(getBalanceFn).toHaveBeenCalledTimes(3);
  });
});
