import { describe, expect, it } from 'vitest';
import type { ReceiptPaper } from '@fitaura/shared';

describe('ReceiptPaper', () => {
  it('includes premium and white alongside neon and thermal', () => {
    const papers: ReceiptPaper[] = ['neon', 'thermal', 'premium', 'white'];
    expect(papers).toContain('premium');
    expect(papers).toContain('white');
  });
});
