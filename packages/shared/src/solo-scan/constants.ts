// packages/shared/src/solo-scan/constants.ts
/** AI response contract version (rules doc §15). Bump on schema changes. */
export const SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v3_4' as const;

/** Prompt/scoring version — feeds the seeded display jitter so a saved result
 * stays stable, and lets us re-calibrate later. Bump when the system
 * instruction or scoring weights change. */
export const SOLO_SCAN_PROMPT_VERSION = 'v3_5' as const;
