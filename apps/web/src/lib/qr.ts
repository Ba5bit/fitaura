import qrcode from 'qrcode-generator';

/** The homepage the receipt QR links to. */
export const SITE_URL = 'https://fitaura.studio/';

/**
 * Encode `text` as a QR code and return its module grid (`true` = dark module).
 * Type number 0 = auto-size; error-correction level "M" is a good balance for a
 * short URL printed/shared at card scale.
 */
export function qrMatrix(text: string): boolean[][] {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const grid: boolean[][] = [];
    for (let r = 0; r < n; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      grid.push(row);
    }
    return grid;
  } catch {
    // Oversized/invalid input — `qr.make()` throws past type-40 capacity. Return
    // an empty grid; QrCode renders nothing rather than crashing the tree.
    return [];
  }
}
