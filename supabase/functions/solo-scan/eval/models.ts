import type { ModelConfig } from './types.ts';

// 3.5-flash pricing (Google pricing page, verified 2026-06-20): $1.50/1M in, $9.00/1M out.
// Same model on both targets isolates the v3.5→v4 generation change.
const FLASH_35 = {
  id: 'gemini-3.5-flash',
  keyEnv: 'GEMINI_API_KEY_35',
  // Gemini 3.x uses thinking_level (minimal|low|medium|high), not thinkingBudget.
  thinkingConfig: { thinkingLevel: 'low' },
  maxOutputTokens: 4096,
  priceIn: 1.5,
  priceOut: 9.0,
} as const;

export const MODELS: ModelConfig[] = [
  { ...FLASH_35, label: '3.5 · current (v3.5)', contract: 'v3_5' },
  { ...FLASH_35, label: '3.5 · rebuild (v4)', contract: 'v4' },
];

/** Resolve a model's API key: its own env var first, then GEMINI_API_KEY fallback. */
export function resolveKey(
  cfg: ModelConfig,
  env: Record<string, string | undefined>,
): string | undefined {
  return env[cfg.keyEnv] || env.GEMINI_API_KEY;
}

/** Estimate USD cost from token usage and the model's per-Mtok prices. */
export function estimateCost(
  usage: { input: number; output: number },
  cfg: ModelConfig,
): number {
  const cost = (usage.input / 1e6) * cfg.priceIn + (usage.output / 1e6) * cfg.priceOut;
  return Number(cost.toFixed(6));
}
