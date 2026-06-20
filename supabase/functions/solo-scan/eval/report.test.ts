import { describe, it, expect } from 'vitest';
import { renderReport } from './report.ts';
import { sampleAIOutput } from './fixtures.ts';
import { assembleResult } from 'shared/solo-scan/assemble.ts';
import { SOLO_SCAN_PROMPT_VERSION } from 'shared/solo-scan/constants.ts';
import type { ModelOutcome, RunResult, ScanInput } from './types.ts';

function outcome(modelId: string, over: Partial<ModelOutcome> = {}): ModelOutcome {
  const parsed = sampleAIOutput();
  const assembled = assembleResult(parsed, 'bob', SOLO_SCAN_PROMPT_VERSION, { face: true, outfit: true });
  return {
    modelId,
    ok: true,
    raw: parsed,
    parsed,
    schemaValid: true,
    assembled,
    latencyMs: 1234,
    usage: { input: 1000, output: 500, total: 1500 },
    costUsd: 0.0015,
    ...over,
  };
}

const run: RunResult = {
  startedAt: '2026-06-20T00:00:00.000Z',
  models: ['gemini-2.5-flash', 'gemini-3.5-flash'],
  cases: [
    {
      name: 'bob',
      hasFace: true,
      hasOutfit: true,
      outcomes: [outcome('gemini-2.5-flash'), outcome('gemini-3.5-flash', { latencyMs: 800 })],
    },
  ],
};

const inputs: ScanInput[] = [
  { name: 'bob', face: { mimeType: 'image/jpeg', data: 'AAAA' }, outfit: { mimeType: 'image/png', data: 'BBBB' } },
];

describe('renderReport', () => {
  it('renders both model columns', () => {
    const html = renderReport(run, inputs);
    expect(html).toContain('gemini-2.5-flash');
    expect(html).toContain('gemini-3.5-flash');
  });

  it('renders face verdict, outfit nameplate, and the banks rows', () => {
    const html = renderReport(run, inputs);
    expect(html).toContain('THE TALKING'); // face verdictLine.punch
    expect(html).toContain('DENIM ARMORY'); // nameplate.name
    expect(html).toContain('faceArchetypeCandidates'); // banks label
    expect(html).toContain('face_archetype.goat'); // banks value
    expect(html).toContain('NO CAP DETECTED'); // receipt punchlineText
  });

  it('renders the assembled final result (verdict chip + receipt rows)', () => {
    const html = renderReport(run, inputs);
    expect(html).toContain('VERDICT'); // assembled verdict chip
    expect(html).toContain('Dating Score'); // receipt row from assembleResult
    expect(html).toContain('Aura Gained'); // receipt row from assembleResult
    expect(html).toContain('Final result'); // the assembled section heading
  });

  it('embeds input images as data URIs', () => {
    const html = renderReport(run, inputs);
    expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).toContain('data:image/png;base64,BBBB');
  });

  it('escapes HTML in copy fields', () => {
    const evil = outcome('gemini-2.5-flash', {
      parsed: sampleAIOutput({
        faceCopy: {
          strongestPoint: '<script>x</script>',
          improvement: 'a',
          summary: 'b',
          verdictLine: { lead: 'l', punch: 'p' },
        },
      }),
    });
    const html = renderReport({ ...run, cases: [{ name: 'x', hasFace: true, hasOutfit: false, outcomes: [evil] }] }, []);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows schema ✗ and the error for a failed outcome', () => {
    const failed = outcome('gemini-2.5-flash', { ok: false, raw: null, parsed: null, schemaValid: false, assembled: null, error: 'gemini_http_400' });
    const html = renderReport({ ...run, cases: [{ name: 'x', hasFace: true, hasOutfit: false, outcomes: [failed] }] }, []);
    expect(html).toContain('✗');
    expect(html).toContain('gemini_http_400');
  });
});
