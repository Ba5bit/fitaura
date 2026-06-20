import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sampleAIOutput } from './fixtures.ts';

const { callGemini } = vi.hoisted(() => ({ callGemini: vi.fn() }));
vi.mock('../gemini.ts', () => ({ callGemini }));

import { handleCompare } from './server.ts';
import { loadEnvFile } from './env.ts';

beforeEach(() => {
  callGemini.mockReset();
  callGemini.mockResolvedValue({ raw: sampleAIOutput(), usage: { input: 1000, output: 500, total: 1500 } });
});

describe('handleCompare', () => {
  it('runs every model on the uploaded image and returns report HTML', async () => {
    const html = await handleCompare(
      { name: 'web', face: { mimeType: 'image/jpeg', data: 'AAAA' } },
      { GEMINI_API_KEY: 'k' },
    );
    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(html).toContain('gemini-2.5-flash');
    expect(html).toContain('gemini-3.5-flash');
    expect(html).toContain('DENIM ARMORY');
  });

  it('rejects when no image is provided', async () => {
    await expect(handleCompare({}, { GEMINI_API_KEY: 'k' })).rejects.toThrow(/face and\/or outfit/i);
  });

  it('rejects when the key is missing', async () => {
    await expect(
      handleCompare({ face: { mimeType: 'image/jpeg', data: 'A' } }, {}),
    ).rejects.toThrow(/API key/);
  });
});

describe('loadEnvFile', () => {
  it('loads KEY=VALUE lines (stripping quotes) without overriding existing env', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'env-')), '.env');
    writeFileSync(f, '# comment\nGEMINI_API_KEY=abc123\nGEMINI_API_KEY_35="def456"\n');
    const env: Record<string, string | undefined> = { GEMINI_API_KEY: 'existing' };
    loadEnvFile(f, env);
    expect(env.GEMINI_API_KEY).toBe('existing'); // pre-set value not overridden
    expect(env.GEMINI_API_KEY_35).toBe('def456'); // quotes stripped
  });

  it('does nothing when the file is missing', () => {
    const env: Record<string, string | undefined> = {};
    loadEnvFile(join(tmpdir(), 'definitely-missing-xyz', '.env'), env);
    expect(env).toEqual({});
  });
});
