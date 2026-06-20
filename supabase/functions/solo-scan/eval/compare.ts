import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { callGemini } from '../gemini.ts';
import { soloScanSchema } from 'shared/solo-scan/schema.ts';
import { MODELS, resolveKey, estimateCost } from './models.ts';
import { discoverCases } from './cases.ts';
import { renderReport } from './report.ts';
import type { CaseResult, ModelConfig, ModelOutcome, RunResult, ScanInput } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Run one model against one case input, capturing timing, schema validity, cost. */
async function runModel(cfg: ModelConfig, input: ScanInput, apiKey: string): Promise<ModelOutcome> {
  const started = Date.now();
  try {
    const { raw, usage } = await callGemini({
      apiKey,
      model: cfg.id,
      face: input.face,
      outfit: input.outfit,
      thinkingConfig: cfg.thinkingConfig,
      maxOutputTokens: cfg.maxOutputTokens,
    });
    const latencyMs = Date.now() - started;
    const parsed = soloScanSchema.safeParse(raw);
    return {
      modelId: cfg.id,
      ok: true,
      raw,
      parsed: parsed.success ? parsed.data : null,
      schemaValid: parsed.success,
      schemaErrors: parsed.success ? undefined : parsed.error.issues.map((i) => i.path.join('.')),
      latencyMs,
      usage,
      costUsd: estimateCost(usage, cfg),
    };
  } catch (e) {
    return {
      modelId: cfg.id,
      ok: false,
      raw: null,
      parsed: null,
      schemaValid: false,
      error: e instanceof Error ? e.message : String(e),
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
        `· ${input.name} → ${cfg.id} : ${outcome.ok ? `${outcome.latencyMs}ms ${outcome.schemaValid ? 'valid' : 'INVALID'}` : `FAILED ${outcome.error}`}`,
      );
      outcomes.push(outcome);
    }
    cases.push({ name: input.name, hasFace: !!input.face, hasOutfit: !!input.outfit, outcomes });
  }

  const run: RunResult = { startedAt: new Date().toISOString(), models: MODELS.map((m) => m.id), cases };
  const dir = join(opts.outDir, run.startedAt.replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'results.json'), JSON.stringify(run, null, 2));
  writeFileSync(join(dir, 'report.html'), renderReport(run, inputs));
  return { dir, run };
}

// CLI entry — only runs when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCompare({ casesDir: join(HERE, 'cases'), outDir: join(HERE, 'out'), env: process.env })
    .then(({ dir }) => console.log(`\nReport: ${join(dir, 'report.html')}`))
    .catch((e) => {
      console.error(String(e instanceof Error ? e.message : e));
      process.exit(1);
    });
}
