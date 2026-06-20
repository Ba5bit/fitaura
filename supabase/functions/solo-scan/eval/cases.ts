import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { InlineImage, ScanInput } from './types.ts';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** First matching `<base>.<ext>` in `dir`, loaded as a base64 InlineImage. */
function findImage(dir: string, base: string): InlineImage | undefined {
  for (const ext of Object.keys(MIME)) {
    const p = join(dir, base + ext);
    if (existsSync(p)) {
      return { mimeType: MIME[ext], data: readFileSync(p).toString('base64') };
    }
  }
  return undefined;
}

/** Discover every case subfolder under `casesDir`, loading face/outfit as base64. */
export function discoverCases(casesDir: string): ScanInput[] {
  if (!existsSync(casesDir)) return [];
  const out: ScanInput[] = [];
  for (const name of readdirSync(casesDir).sort()) {
    const dir = join(casesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const face = findImage(dir, 'face');
    const outfit = findImage(dir, 'outfit');
    if (!face && !outfit) continue; // skip folders with no usable image
    out.push({ name, face, outfit });
  }
  return out;
}
