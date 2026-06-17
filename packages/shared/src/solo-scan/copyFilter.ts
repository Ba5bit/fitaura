// packages/shared/src/solo-scan/copyFilter.ts
// Shared cliché/length/name filter for model-written copy. Keep CLICHE_PATTERNS in
// sync with the BANNED list in supabase/functions/solo-scan/gemini.ts.

const CLICHE_PATTERNS: RegExp[] = [
  /\bgiving\b/i,
  /it'?s giving/i,
  /\bvibes?\b/i,
  /\benergy\b/i,
  /\blore\b/i,
  /\bcertified\b/i,
  /cultural reset/i,
  /in human form/i,
  /\bserving\b/i,
  /\ba true\b/i,
  /-coded\b/i,
];

/** True when `text` contains a banned cliché. */
export function isCliche(text: string): boolean {
  return CLICHE_PATTERNS.some((re) => re.test(text));
}

/** Remove the literal icon name (whole-word, case-insensitive) and collapse spaces. */
export function scrubName(text: string, name: string | null): string {
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Accept a model-written display line, or null to signal "use the banked fallback".
 * Scrubs the icon name first, then rejects empty / too-long / cliché output.
 */
export function acceptWritten(
  written: string | null | undefined,
  maxLen: number,
  iconName: string | null,
): string | null {
  if (!written) return null;
  const cleaned = scrubName(written.trim(), iconName);
  if (!cleaned) return null;
  if (cleaned.length > maxLen) return null;
  if (isCliche(cleaned)) return null;
  return cleaned;
}
