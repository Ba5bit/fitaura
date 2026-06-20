import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';
import type { FullGenerationResult } from 'shared/result.ts';

/** A base64 image part, matching gemini.ts InlineImage. */
export interface InlineImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface ModelConfig {
  id: string;
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
  modelId: string;
  ok: boolean; // the API call returned without throwing
  raw: unknown; // parsed JSON from Gemini (null on hard failure)
  parsed: SoloScanAIOutput | null; // present iff schema valid
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
