import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sampleAIOutput, sampleV4Output } from './fixtures.ts';

const { callGemini } = vi.hoisted(() => ({ callGemini: vi.fn() }));
vi.mock('../gemini.ts', () => ({ callGemini }));

import { runCompare } from './compare.ts';

const usage = { input: 1000, output: 500, total: 1500 };

beforeEach(() => {
  callGemini.mockReset();
  // The v4 target sends a systemInstruction override; return the matching shape.
  callGemini.mockImplementation((opts: { systemInstruction?: string }) =>
    Promise.resolve({ raw: opts?.systemInstruction != null ? sampleV4Output() : sampleAIOutput(), usage }),
  );
});

function makeCases(): string {
  const root = mkdtempSync(join(tmpdir(), 'cmp-'));
  mkdirSync(join(root, 'bob'));
  writeFileSync(join(root, 'bob', 'face.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  return root;
}

const KEYS = { GEMINI_API_KEY_35: 'k35', GEMINI_API_KEY: 'k' };

describe('runCompare', () => {
  it('runs both contracts per case and writes report.html + results.json', async () => {
    const casesDir = makeCases();
    const outDir = mkdtempSync(join(tmpdir(), 'out-'));

    const { dir, run } = await runCompare({ casesDir, outDir, env: KEYS });

    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(run.cases).toHaveLength(1);
    expect(run.cases[0].outcomes.map((o) => o.label)).toEqual(['3.5 · current (v3.5)', '3.5 · rebuild (v4)']);
    expect(run.cases[0].outcomes.every((o) => o.schemaValid)).toBe(true);

    expect(existsSync(join(dir, 'report.html'))).toBe(true);
    expect(existsSync(join(dir, 'results.json'))).toBe(true);
    expect(readFileSync(join(dir, 'report.html'), 'utf8')).toContain('DENIM ARMORY');
  });

  it('captures a per-target failure without sinking the other', async () => {
    callGemini.mockImplementation((opts: { systemInstruction?: string }) =>
      opts?.systemInstruction != null
        ? Promise.reject(new Error('gemini_http_400'))
        : Promise.resolve({ raw: sampleAIOutput(), usage }),
    );
    const { run } = await runCompare({ casesDir: makeCases(), outDir: mkdtempSync(join(tmpdir(), 'out-')), env: KEYS });

    const v4 = run.cases[0].outcomes.find((o) => o.contract === 'v4');
    const v35 = run.cases[0].outcomes.find((o) => o.contract === 'v3_5');
    expect(v4?.ok).toBe(false);
    expect(v4?.error).toBe('gemini_http_400');
    expect(v35?.schemaValid).toBe(true);
  });

  it('throws when a target has no resolvable key', async () => {
    await expect(
      runCompare({ casesDir: makeCases(), outDir: mkdtempSync(join(tmpdir(), 'out-')), env: {} }),
    ).rejects.toThrow(/API key/);
  });

  it('throws when there are no cases', async () => {
    await expect(
      runCompare({ casesDir: mkdtempSync(join(tmpdir(), 'empty-')), outDir: mkdtempSync(join(tmpdir(), 'out-')), env: KEYS }),
    ).rejects.toThrow(/No cases/);
  });
});
