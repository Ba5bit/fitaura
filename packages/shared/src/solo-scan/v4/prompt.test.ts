import { describe, it, expect } from 'vitest';
import { V4_SYSTEM_INSTRUCTION, V4_RESPONSE_SCHEMA } from './prompt.ts';
import { STICKER_BANK } from '../../sticker-bank.ts';

describe('V4_RESPONSE_SCHEMA', () => {
  it('requires the direct-output blocks', () => {
    expect(V4_RESPONSE_SCHEMA.required).toEqual(
      expect.arrayContaining(['verdict', 'face', 'outfit', 'receipt', 'faceAnalysis', 'outfitAnalysis']),
    );
  });

  it('constrains the verdict to the three categories', () => {
    expect(V4_RESPONSE_SCHEMA.properties.verdict.enum).toEqual(['green_flag', 'normie', 'red_flag']);
  });
});

describe('V4_SYSTEM_INSTRUCTION', () => {
  it('emits the v4 schema version', () => {
    expect(V4_SYSTEM_INSTRUCTION).toContain('solo_scan_v4');
  });

  it('interpolates real sticker ids the model can pick from', () => {
    const someFaceId = STICKER_BANK.face[0].id;
    expect(V4_SYSTEM_INSTRUCTION).toContain(someFaceId);
  });

  it('keeps the bank as inspiration, not a pickable allowlist', () => {
    expect(V4_SYSTEM_INSTRUCTION).toContain('house lexicon');
    expect(V4_SYSTEM_INSTRUCTION).not.toContain('faceArchetypeCandidates');
    expect(V4_SYSTEM_INSTRUCTION).not.toContain('contentSelection');
  });

  it('carries over the core safety guard', () => {
    expect(V4_SYSTEM_INSTRUCTION).toContain('NEVER attempt to identify a private or ordinary individual');
    expect(V4_SYSTEM_INSTRUCTION).toContain('Do not infer ethnicity');
  });

  it('includes the added slang in lexicon + selectable stickers', () => {
    // lexicon (the words the model can write), with the gender split
    for (const term of ['LARPER', 'PICK ME', 'EMO BOY', 'PICK ME GIRL', 'EMO GIRL']) {
      expect(V4_SYSTEM_INSTRUCTION).toContain(term);
    }
    // pickable sticker ids (interpolated from the bank)
    for (const id of ['larper', 'emo', 'pick-me']) {
      expect(V4_SYSTEM_INSTRUCTION).toContain(id);
    }
  });
});
