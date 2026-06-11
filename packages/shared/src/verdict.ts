/**
 * The single, mutually-exclusive categorical dating verdict.
 *
 * Per the product spec this is ALWAYS one enum value — never three separate
 * scores, and never mixed with the final viral punchline.
 */
export type DatingVerdict = 'green_flag' | 'normie' | 'red_flag';

export const DATING_VERDICTS: readonly DatingVerdict[] = [
  'green_flag',
  'normie',
  'red_flag',
] as const;

/** Human-readable label shown on cards, receipts and chips. */
export const VERDICT_LABEL: Record<DatingVerdict, string> = {
  green_flag: 'GREEN FLAG',
  normie: 'NORMIE',
  red_flag: 'RED FLAG',
};

/**
 * CSS custom-property reference each verdict maps to. The design drives the
 * `--verdict` token from this so accents stay consistent across every surface.
 */
export const VERDICT_COLOR_VAR: Record<DatingVerdict, string> = {
  green_flag: 'var(--lime)',
  normie: 'var(--cyan)',
  red_flag: 'var(--red)',
};

export function isDatingVerdict(value: unknown): value is DatingVerdict {
  return (
    value === 'green_flag' || value === 'normie' || value === 'red_flag'
  );
}
