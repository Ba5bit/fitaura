import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sampleAIOutput } from './fixtures.ts';

const { callGemini } = vi.hoisted(() => ({ callGemini: vi.fn() }));
vi.mock('../gemini.ts', () => ({ callGemini }));

import { runCompare } from './compare.ts';

beforeEach(() => {
  callGemini.mockReset();
  callGemini.mockImplementation(({ model }: { model: string }) => {
    if (model === 'gemini-3.5-flash') {
      return Promise.reject(new Error('gemini_http_400'));
    }
    return Promise.resolve({ raw: sampleAIOutput(), usage: { input: 1000, output: 500, total: 1500 } });
  });
});

function makeCases(): string {
  const root = mkdtempSync(join(tmpdir(), 'cmp-'));
  mkdirSync(join(root, 'bob'));
  writeFileSync(join(root, 'bob', 'face.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  return root;
}

describe('runCompare', () => {
  it('calls every model per case and writes report.html + results.json', async () => {
    const casesDir = makeCases();
    const outDir = mkdtempSync(join(tmpdir(), 'out-'));
    const env = { GEMINI_API_KEY: 'k', GEMINI_API_KEY_35: 'k35' };

    const { dir, run } = await runCompare({ casesDir, outDir, env });

    // both models attempted for the one case
    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(run.cases).toHaveLength(1);
    expect(run.cases[0].outcomes.map((o) => o.modelId)).toEqual(['gemini-2.5-flash', 'gemini-3.5-flash']);
    expect(run.cases[0].outcomes[0].schemaValid).toBe(true);
    expect(run.cases[0].outcomes[1].ok).toBe(false);
    expect(run.cases[0].outcomes[1].error).toBe('gemini_http_400');

    // files exist
    expect(existsSync(join(dir, 'report.html'))).toBe(true);
    expect(existsSync(join(dir, 'results.json'))).toBe(true);
    const html = readFileSync(join(dir, 'report.html'), 'utf8');
    expect(html).toContain('DENIM ARMORY'); // valid column rendered
    expect(html).toContain('gemini_http_400'); // failed column surfaced
  });

  it('throws when a model has no resolvable key', async () => {
    const casesDir = makeCases();
    const outDir = mkdtempSync(join(tmpdir(), 'out-'));
    await expect(runCompare({ casesDir, outDir, env: {} })).rejects.toThrow(/API key/);
  });

  it('throws when there are no cases', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'out-'));
    const emptyCases = mkdtempSync(join(tmpdir(), 'empty-'));
    await expect(
      runCompare({ casesDir: emptyCases, outDir, env: { GEMINI_API_KEY: 'k', GEMINI_API_KEY_35: 'k' } }),
    ).rejects.toThrow(/No cases/);
  });
});
