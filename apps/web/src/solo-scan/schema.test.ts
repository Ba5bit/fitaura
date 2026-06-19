// apps/web/src/solo-scan/schema.test.ts
import { describe, expect, it } from 'vitest';
import { soloScanSchema, sampleAIOutput, SOLO_SCAN_SCHEMA_VERSION } from '@fitaura/shared';

describe('soloScanSchema', () => {
  it('accepts a well-formed solo_scan_v3_1 object', () => {
    const parsed = soloScanSchema.safeParse(sampleAIOutput());
    expect(parsed.success).toBe(true);
  });

  it('rejects an out-of-range rating', () => {
    const bad = sampleAIOutput();
    bad.faceAnalysis.jawPresence.rating = 150 as never;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects confidence above 1', () => {
    const bad = sampleAIOutput();
    bad.faceAnalysis.jawPresence.confidence = 1.4;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });

  it('requires retakeInstruction when not usable', () => {
    const bad = sampleAIOutput();
    bad.inputQuality.usable = false;
    bad.inputQuality.retakeInstruction = null;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });

  it('requires the presentation object', () => {
    const bad = sampleAIOutput() as Record<string, unknown>;
    delete bad.presentation;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an invalid gender enum', () => {
    const bad = sampleAIOutput();
    bad.presentation.gender = 'male' as never;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });
});

describe('soloScanSchema v3_5', () => {
  it('the fixture parses and carries the new written fields', () => {
    const parsed = soloScanSchema.parse(sampleAIOutput());
    expect(SOLO_SCAN_SCHEMA_VERSION).toBe('solo_scan_v3_5');
    expect(parsed.faceCopy.verdictLine).toEqual({ lead: 'JAW DID', punch: 'THE TALKING' });
    expect(parsed.outfitCopy.captionLine).toBe('STRUCTURE OVER FLASH');
    expect(parsed.receiptContent.punchlineText).toBe('QUIET CONFIDENCE');
  });
});
