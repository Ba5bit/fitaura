// apps/web/src/services/entitlementsService.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the lazy Supabase client. Each test installs its own fake.
const mockClient = { from: vi.fn(), rpc: vi.fn() };
vi.mock('../lib/supabase', () => ({ getSupabase: () => Promise.resolve(mockClient) }));

import { normalizeCode, getEntitlements, redeemCode } from './entitlementsService';

afterEach(() => vi.clearAllMocks());

describe('normalizeCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeCode('  nfactorial2026 ')).toBe('NFACTORIAL2026');
    expect(normalizeCode(undefined as unknown as string)).toBe('');
  });
});

describe('getEntitlements', () => {
  it('maps rows to a string[] of entitlement keys', async () => {
    mockClient.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ entitlement: 'theme:company-nfactorial' }], error: null }),
      }),
    });
    expect(await getEntitlements('u1')).toEqual(['theme:company-nfactorial']);
  });

  it('returns [] on error', async () => {
    mockClient.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'x' } }) }),
    });
    expect(await getEntitlements('u1')).toEqual([]);
  });
});

describe('redeemCode', () => {
  it('passes the normalized code to the RPC and returns its payload', async () => {
    mockClient.rpc.mockResolvedValue({ data: { status: 'ok', entitlements: ['theme:company-nfactorial'] }, error: null });
    const res = await redeemCode(' nfactorial2026 ');
    expect(mockClient.rpc).toHaveBeenCalledWith('redeem_code', { p_code: 'NFACTORIAL2026' });
    expect(res).toEqual({ status: 'ok', entitlements: ['theme:company-nfactorial'] });
  });

  it('maps a transport error to status invalid', async () => {
    mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await redeemCode('X')).status).toBe('invalid');
  });
});
