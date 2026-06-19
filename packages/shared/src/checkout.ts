import { CREDIT_PACKS } from './pricing.ts';

/** Origins allowed to open the embedded Polar checkout (used as embed_origin). */
export const ALLOWED_ORIGINS = ['https://fitaura.studio', 'http://localhost:5173'] as const;

/** True if `origin` is an exact match for an allowed origin. */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  return !!origin && (ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

/** Credit count for a pack id, or undefined if the id is unknown. */
export function creditsForPack(packId: string): number | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId)?.credits;
}
