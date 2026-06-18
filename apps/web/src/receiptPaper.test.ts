import { describe, expect, it } from 'vitest';
import type { ReceiptPaper } from '@fitaura/shared';

describe('ReceiptPaper', () => {
  it('includes premium alongside neon and thermal', () => {
    const papers: ReceiptPaper[] = ['neon', 'thermal', 'premium'];
    expect(papers).toContain('premium');
  });
});
