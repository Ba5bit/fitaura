// apps/web/src/lib/redeemMessages.test.ts
import { describe, expect, it } from 'vitest';
import { REDEEM_MESSAGE, REDEEM_TONE } from './redeemMessages';

// Every status the redeem RPC can return must have copy + a tone, so no surface
// (Unlock deep-link, Vault banner, header RedeemPill) ever shows `undefined`.
const STATUSES = ['ok', 'already_owned', 'invalid', 'expired', 'exhausted', 'unauthenticated'] as const;

describe('redeem messages', () => {
  it('has a non-empty message for every redeem status', () => {
    for (const s of STATUSES) {
      expect(REDEEM_MESSAGE[s]).toBeTruthy();
    }
  });

  it('has a tone for every redeem status', () => {
    for (const s of STATUSES) {
      expect(REDEEM_TONE[s]).toMatch(/^var\(--/);
    }
  });
});
