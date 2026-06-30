// apps/web/src/lib/redeemMessages.ts
//
// Shared status→copy for every promo-code redeem surface — the `/unlock/:code`
// deep-link (Unlock), the Vault announcement (UnlockBanner) and the header
// control (RedeemPill) — so the wording stays consistent in one place.
import type { RedeemStatus } from '../services/entitlementsService';

export const REDEEM_MESSAGE: Record<RedeemStatus, string> = {
  ok: 'Redeemed! Your unlock is now on your account.',
  already_owned: "You already own this — it's on your account.",
  invalid: "That code isn't valid.",
  expired: 'That code has expired.',
  exhausted: 'That code has reached its redemption limit.',
  unauthenticated: 'Please sign in to redeem your code.',
};

/** CSS colour var per status, for the inline note on the Vault banner. */
export const REDEEM_TONE: Record<RedeemStatus, string> = {
  ok: 'var(--lime)',
  already_owned: 'var(--lime)',
  invalid: 'var(--red)',
  expired: 'var(--red)',
  exhausted: 'var(--red)',
  unauthenticated: 'var(--gold)',
};
