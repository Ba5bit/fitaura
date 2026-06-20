import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { callGemini } from '../gemini.ts';
import { soloScanSchema } from 'shared/solo-scan/schema.ts';
import { assembleResult } from 'shared/solo-scan/assemble.ts';
import { SOLO_SCAN_PROMPT_VERSION } from 'shared/solo-scan/constants.ts';
import { soloScanV4Schema, type SoloScanV4Output } from 'shared/solo-scan/v4/schema.ts';
import { V4_SYSTEM_INSTRUCTION, V4_RESPONSE_SCHEMA } from 'shared/solo-scan/v4/prompt.ts';
import { shapeV4Result } from 'shared/solo-scan/v4/shape.ts';
import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';
import { MODELS, resolveKey, estimateCost } from './models.ts';
import { discoverCases } from './cases.ts';
import { renderReport, summarizeCost } from './report.ts';
import { loadEnvFile } from './env.ts';
import type { CaseResult, ModelConfig, ModelOutcome, RunResult, ScanInput } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Run one target (model + contract) against one case input. */
export async function runModel(cfg: ModelConfig, input: ScanInput, apiKey: string): Promise<ModelOutcome> {
  const started = Date.now();
  const isV4 = cfg.contract === 'v4';
  const parts = { face: !!input.face, outfit: !!input.outfit };
  const base = { modelId: cfg.id, label: cfg.label, contract: cfg.contract };
  try {
    const { raw, usage } = await callGemini({
      apiKey,
      model: cfg.id,
      face: input.face,
      outfit: input.outfit,
      thinkingConfig: cfg.thinkingConfig,
      maxOutputTokens: cfg.maxOutputTokens,
      systemInstruction: isV4 ? V4_SYSTEM_INSTRUCTION : undefined,
      responseSchema: isV4 ? V4_RESPONSE_SCHEMA : undefined,
    });
    const latencyMs = Date.now() - started;
    // Validate with the matching contract's schema, then shape with the matching
    // pipeline. Both shapers seed off the case name → fair, seed-stable compare.
    const parsed = isV4 ? soloScanV4Schema.safeParse(raw) : soloScanSchema.safeParse(raw);
    let assembled = null as ModelOutcome['assembled'];
    let assembleError: string | undefined;
    if (parsed.success) {
      try {
        assembled = isV4
          ? shapeV4Result(parsed.data as SoloScanV4Output, input.name, parts)
          : assembleResult(parsed.data as SoloScanAIOutput, input.name, SOLO_SCAN_PROMPT_VERSION, parts);
      } catch (e) {
        assembleError = e instanceof Error ? e.message : String(e);
      }
    }
    return {
      ...base,
      ok: true,
      raw,
      parsed: parsed.success ? parsed.data : null,
      schemaValid: parsed.success,
      schemaErrors: parsed.success ? undefined : parsed.error.issues.map((i) => i.path.join('.')),
      assembled,
      assembleError,
      latencyMs,
      usage,
      costUsd: estimateCost(usage, cfg),
    };
  } catch (e) {
    return {
      ...base,
      ok: false,
      raw: null,
      parsed: null,
      schemaValid: false,
      error: e instanceof Error ? e.message : String(e),
      assembled: null,
      latencyMs: Date.now() - started,
      usage: { input: 0, output: 0, total: 0 },
      costUsd: 0,
    };
  }
}

export interface RunCompareOpts {
  casesDir: string;
  outDir: string;
  env: Record<string, string | undefined>;
}

/** Discover cases, run every model per case, write report.html + results.json. */
export async function runCompare(opts: RunCompareOpts): Promise<{ dir: string; run: RunResult }> {
  const inputs = discoverCases(opts.casesDir);
  if (inputs.length === 0) {
    throw new Error(`No cases found in ${opts.casesDir}. Add <case>/face.jpg and/or outfit.jpg.`);
  }
  for (const cfg of MODELS) {
    if (!resolveKey(cfg, opts.env)) {
      throw new Error(`Missing API key for ${cfg.id}: set ${cfg.keyEnv} (or GEMINI_API_KEY).`);
    }
  }

  const cases: CaseResult[] = [];
  for (const input of inputs) {
    const outcomes: ModelOutcome[] = [];
    for (const cfg of MODELS) {
      const apiKey = resolveKey(cfg, opts.env)!;
      const outcome = await runModel(cfg, input, apiKey);
      console.log(
        `· ${input.name} → ${cfg.label} : ${outcome.ok ? `${outcome.latencyMs}ms ${outcome.schemaValid ? 'valid' : 'INVALID'}` : `FAILED ${outcome.error}`}`,
      );
      outcomes.push(outcome);
    }
    cases.push({ name: input.name, hasFace: !!input.face, hasOutfit: !!input.outfit, outcomes });
  }

  const run: RunResult = { startedAt: new Date().toISOString(), models: MODELS.map((m) => m.label), cases };
  const dir = join(opts.outDir, run.startedAt.replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'results.json'), JSON.stringify(run, null, 2));
  writeFileSync(join(dir, 'report.html'), renderReport(run, inputs));

  console.log('\n  Cost totals:');
  for (const t of summarizeCost(run)) {
    const perGen = t.costUsd / Math.max(t.generations, 1);
    console.log(`  ${t.modelId}: ${t.generations} gen · ${t.tokens} tok · $${t.costUsd.toFixed(4)} (≈ $${perGen.toFixed(4)}/gen)`);
  }
  return { dir, run };
}

// CLI entry — only runs when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnvFile(join(HERE, '.env'));
  runCompare({ casesDir: join(HERE, 'cases'), outDir: join(HERE, 'out'), env: process.env })
    .then(({ dir }) => console.log(`\nReport: ${join(dir, 'report.html')}`))
    .catch((e) => {
      console.error(String(e instanceof Error ? e.message : e));
      process.exit(1);
    });
}
