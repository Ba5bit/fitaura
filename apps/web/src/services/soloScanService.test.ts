// apps/web/src/services/soloScanService.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { runSoloScan, dataUrlToInline } from './soloScanService';

beforeEach(() => invoke.mockReset());

describe('dataUrlToInline', () => {
  it('splits a data URL into mime + base64', () => {
    const out = dataUrlToInline('data:image/webp;base64,AAAB');
    expect(out).toEqual({ mimeType: 'image/webp', data: 'AAAB' });
  });
  it('throws on a non-data URL', () => {
    expect(() => dataUrlToInline('https://x/y.png')).toThrow();
  });
});

describe('runSoloScan', () => {
  it('returns the result on success', async () => {
    invoke.mockResolvedValue({ data: { ok: true, result: { verdict: 'normie' } }, error: null });
    const out = await runSoloScan('data:image/webp;base64,A', 'data:image/webp;base64,B');
    expect(out.kind).toBe('result');
    if (out.kind === 'result') expect(out.result.verdict).toBe('normie');
  });

  it('maps a retake response', async () => {
    invoke.mockResolvedValue({ data: { ok: false, kind: 'retake', faceUsable: true, outfitUsable: false, instruction: 'redo outfit' }, error: null });
    const out = await runSoloScan('data:image/webp;base64,A', 'data:image/webp;base64,B');
    expect(out.kind).toBe('retake');
    if (out.kind === 'retake') expect(out.outfitUsable).toBe(false);
  });

  it('maps a transport error to an error outcome', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const out = await runSoloScan('data:image/webp;base64,A', 'data:image/webp;base64,B');
    expect(out.kind).toBe('error');
  });
});
