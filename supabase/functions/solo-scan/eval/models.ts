import type { ModelConfig } from './types.ts';

export const MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-flash',
    keyEnv: 'GEMINI_API_KEY',
    thinkingConfig: { thinkingBudget: 0 },
    priceIn: 0.3,
    priceOut: 2.5,
  },
  {
    id: 'gemini-3.5-flash',
    keyEnv: 'GEMINI_API_KEY_35',
    // Gemini 3.x replaces thinkingBudget with thinking_level (minimal|low|medium|high).
    // If the API 400s on this value, adjust per the model's current docs.
    thinkingConfig: { thinkingLevel: 'low' },
    // Thinking can consume output budget; give 3.5 a little more headroom than 2.5's 2900.
    maxOutputTokens: 4096,
    // TODO: confirm gemini-3.5-flash pricing; using 2.5 rates as a placeholder estimate.
    priceIn: 0.3,
    priceOut: 2.5,
  },
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
