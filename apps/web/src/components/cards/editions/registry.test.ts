// apps/web/src/components/cards/editions/registry.test.ts
import { describe, expect, it } from 'vitest';
import { EDITIONS, entitledEditions, NFACTORIAL_ENTITLEMENT } from './registry';

describe('editions registry', () => {
  it('always includes the default edition first', () => {
    expect(EDITIONS[0].id).toBe('default');
    expect(EDITIONS[0].entitlement).toBeUndefined();
  });

  it('nfactorial is gated by the company entitlement', () => {
    const nf = EDITIONS.find((e) => e.id === 'nfactorial')!;
    expect(nf.entitlement).toBe(NFACTORIAL_ENTITLEMENT);
  });

  it('entitledEditions returns default-only without the entitlement', () => {
    expect(entitledEditions([]).map((e) => e.id)).toEqual(['default']);
  });

  it('entitledEditions adds nfactorial once owned', () => {
    expect(entitledEditions([NFACTORIAL_ENTITLEMENT]).map((e) => e.id)).toEqual(['default', 'nfactorial']);
  });
});
