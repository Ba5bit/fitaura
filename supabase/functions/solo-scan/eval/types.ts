import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';
import type { SoloScanV4Output } from 'shared/solo-scan/v4/schema.ts';
import type { FullGenerationResult } from 'shared/result.ts';

/** Which generation contract a run target uses. */
export type Contract = 'v3_5' | 'v4';

/** A base64 image part, matching gemini.ts InlineImage. */
export interface InlineImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface ModelConfig {
  id: string; // gemini model id used for the API call
  label: string; // unique display/column key (model + contract differ)
  contract: Contract; // which generation contract to run
  keyEnv: string; // env var holding this model's API key
  thinkingConfig: Record<string, unknown>; // generationConfig.thinkingConfig payload
  maxOutputTokens?: number;
  priceIn: number; // USD per 1M input tokens
  priceOut: number; // USD per 1M output tokens
}

export interface ScanInput {
  name: string; // case folder name
  face?: InlineImage;
  outfit?: InlineImage;
}

export interface ModelOutcome {
  modelId: string; // gemini model id
  label?: string; // unique display/column key (falls back to modelId)
  contract?: Contract; // generation contract (falls back to 'v3_5')
  ok: boolean; // the API call returned without throwing
  raw: unknown; // parsed JSON from Gemini (null on hard failure)
  parsed: SoloScanAIOutput | SoloScanV4Output | null; // present iff schema valid
  schemaValid: boolean;
  schemaErrors?: string[]; // zod issue paths when invalid
  error?: string; // GeminiError code on call failure
  // Production assembleResult() output — the final system result. null when schema
  // was invalid or assembly threw (see assembleError).
  assembled: FullGenerationResult | null;
  assembleError?: string; // e.g. 'insufficient_signal' when assembleResult throws
  latencyMs: number;
  usage: { input: number; output: number; total: number };
  costUsd: number;
}

export interface CaseResult {
  name: string;
  hasFace: boolean;
  hasOutfit: boolean;
  outcomes: ModelOutcome[]; // one per model, in MODELS order
}

export interface RunResult {
  startedAt: string; // ISO timestamp
  models: string[]; // model ids in column order
  cases: CaseResult[];
}
