import { snapdom } from '@zumer/snapdom';
import { type DatingVerdict } from '@fitaura/shared';

/**
 * Card export — rasterizes the actual on-screen card (WYSIWYG) and centers it on
 * a branded 9:16 (1080×1920) poster, then downloads or shares it.
 *
 * Rasterized with snapdom. We used to use html-to-image, but its SVG
 * `<foreignObject>` pipeline renders advanced CSS wrong on Safari/WebKit:
 * `<img>` photos came out blank, frosted-glass badges turned into black boxes,
 * glows/box-shadows became stray circles, and gradient score bars miscoloured.
 * snapdom reproduces backdrop-filter, shadows and gradients faithfully across
 * Chrome and Safari, so the old glass-neutralizing / font-inlining / multi-pass
 * workarounds are gone — we just capture and composite onto the poster.
 */

const VERDICT_HEX: Record<DatingVerdict, string> = {
  red_flag: '#ff3b49',
  normie: '#54e6f0',
  green_flag: '#b6ff3c',
};

export interface ExportArgs {
  /** The full-scale card element to capture (no CSS scale transform on it). */
  el: HTMLElement;
  kind: 'face' | 'outfit' | 'receipt';
  verdict: DatingVerdict;
  /** Accent hex driving the poster glow (defaults to the brand accent, icy blue). */
  accentHex?: string;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  filename: string;
  bytes: number;
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('400 80px "Anton"'),
      document.fonts.load('800 40px "Hanken Grotesk"'),
      document.fonts.load('700 30px "Space Mono"'),
      document.fonts.ready,
    ]);
  } catch {
    /* fonts may already be cached */
  }
}

/** Force every `<img>` in the subtree to fully decode before capture. */
async function decodeAllImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if (!img.complete) {
          await new Promise<void>((res) => {
            img.onload = img.onerror = () => res();
          });
        }
        if (typeof img.decode === 'function') await img.decode();
      } catch {
        /* broken image — capture will show its placeholder */
      }
    }),
  );
}

/** Render the given card element to a 9:16 PNG blob. */
export async function renderCardBlob(args: ExportArgs): Promise<ExportResult> {
  const { el, kind, verdict, accentHex = '#83b4ff' } = args;
  await ensureFonts();
  await decodeAllImages(el);

  const verdictHex = VERDICT_HEX[verdict] ?? '#ff3b49';
  const base = { w: 1080, h: 1920 };

  const cv = document.createElement('canvas');
  cv.width = base.w;
  cv.height = base.h;
  const ctx = cv.getContext('2d')!;

  // Backdrop — matches the app's dark glow (no text/watermark).
  const bg = ctx.createLinearGradient(0, 0, 0, base.h);
  bg.addColorStop(0, '#0c0e13');
  bg.addColorStop(1, '#06070a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, base.w, base.h);
  let g = ctx.createRadialGradient(base.w / 2, 250, 0, base.w / 2, 250, 820);
  g.addColorStop(0, accentHex + '2b');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, base.w, base.h);
  g = ctx.createRadialGradient(base.w, base.h, 0, base.w, base.h, 900);
  g.addColorStop(0, verdictHex + '1f');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, base.w, base.h);

  // Rasterize the card 1:1 with snapdom. Transparent background so the card's
  // rounded corners reveal the poster glow behind it. Edit-only overlays are
  // dropped from the snapshot.
  const cardCanvas = await snapdom.toCanvas(el, {
    scale: 3,
    embedFonts: true,
    backgroundColor: 'transparent',
    exclude: ['.st-overlay', '.st-edithint'],
    excludeMode: 'remove',
  });

  // Center the card with a small uniform margin + a soft shadow.
  const margin = base.h * 0.04;
  const availH = base.h - margin * 2;
  const ar = cardCanvas.width / cardCanvas.height;
  const drawH = availH;
  const drawW = drawH * ar;
  const dx = (base.w - drawW) / 2;
  const dy = margin;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.66)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 28;
  ctx.drawImage(cardCanvas, dx, dy, drawW, drawH);
  ctx.restore();

  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Failed to encode PNG');
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `fitaura-${kind}-${verdict}.png`,
    bytes: blob.size,
  };
}

/** Trigger a browser download for an export result. */
export function downloadResult(out: ExportResult) {
  const a = document.createElement('a');
  a.href = out.url;
  a.download = out.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Can the browser share image files natively? */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  try {
    const f = new File([new Blob(['x'])], 't.png', { type: 'image/png' });
    return navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

/**
 * Share the rendered card. Returns 'shared' if the native sheet handled it,
 * 'downloaded' if we fell back to a download, or 'cancelled'.
 */
export async function shareResult(out: ExportResult): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (canShareFiles()) {
    try {
      const file = new File([out.blob], out.filename, { type: 'image/png' });
      await navigator.share({ files: [file], title: 'FITAURA', text: 'My FITAURA verdict 💅' });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      /* fall through to download */
    }
  }
  downloadResult(out);
  return 'downloaded';
}
