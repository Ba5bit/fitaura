import { type DatingVerdict } from '@fitaura/shared';

/**
 * Card export — rasterizes the actual on-screen card (WYSIWYG) onto a 9:16
 * (1080×1920) frame, then downloads or shares it. Every card exports full-bleed
 * — edge-to-edge with squared corners — so it fills the whole frame, story-ready.
 * The 360×640 cards (face / outfit / premium receipt) already match the frame, so
 * they're drawn 1:1. The narrower 340×640 thermal/neon receipt strip is widened
 * to a true 9:16 for the capture (no distortion — its QR and type keep their
 * size, it just gains a little side breathing room) so it fills the frame too.
 * The on-screen cards keep their rounded corners and their width; only the export
 * squares the corners and widens the receipt.
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
  const frameAr = base.w / base.h; // 9:16

  // A card whose own aspect ratio already matches the story frame exports
  // full-bleed as-is. The narrower receipt strip is widened to a true 9:16 for
  // its capture so it fills the frame too (see header doc), then handled like any
  // full-bleed card.
  const elAr = el.offsetWidth / el.offsetHeight;
  const isNarrowReceipt = kind === 'receipt' && elAr < frameAr - 0.005;
  const fullBleed = Math.abs(elAr - frameAr) < 0.02 || isNarrowReceipt;

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

  // Rasterize the card 1:1 with snapdom. Transparent background so a centered
  // card's rounded corners reveal the poster glow behind it. Edit-only overlays
  // are dropped from the snapshot. snapdom is loaded on demand (only when a user
  // actually exports) so it stays out of the initial bundle.
  //
  // Full-bleed prep, all on the offscreen capture target (the on-screen card is
  // untouched): square the card's rounded corners — the `.asset` root carries the
  // radius — and, for the narrow receipt strip, widen the capture box + the
  // receipt to a true 9:16 so it fills the frame. Every override is inline +
  // `!important` and undone in the `finally`.
  const assetEl = fullBleed ? el.querySelector<HTMLElement>('.asset') : null;
  const restore: Array<() => void> = [];
  const force = (node: HTMLElement, prop: string, value: string) => {
    const prev = node.style.getPropertyValue(prop);
    const prevPriority = node.style.getPropertyPriority(prop);
    restore.push(() => node.style.setProperty(prop, prev, prevPriority));
    node.style.setProperty(prop, value, 'important');
  };

  if (assetEl) {
    force(assetEl, 'border-radius', '0');
    // An inline `border-radius` can't reach the `.asset::after` top-sheen
    // pseudo-element, whose own 26px radius leaves dark rounded wedges in the
    // squared top corners (the "circled corner" artifact on full-bleed exports).
    // This reversible class squares the element AND its pseudo-elements for the
    // capture; it's removed in the `finally` via `restore`.
    assetEl.classList.add('is-squared-export');
    restore.push(() => assetEl.classList.remove('is-squared-export'));
  }
  if (isNarrowReceipt && assetEl) {
    const targetW = `${Math.round(el.offsetHeight * frameAr)}px`; // 640 → 360
    force(el, 'width', targetW);
    force(assetEl, 'width', targetW);
    force(assetEl, 'left', '0');
    force(assetEl, 'right', 'auto');
    force(assetEl, 'transform', 'none');
  }

  const { snapdom } = await import('@zumer/snapdom');
  let cardCanvas: HTMLCanvasElement;
  try {
    cardCanvas = await snapdom.toCanvas(el, {
      scale: 3,
      embedFonts: true,
      backgroundColor: 'transparent',
      exclude: ['.st-overlay', '.st-edithint'],
      excludeMode: 'remove',
    });
  } finally {
    restore.forEach((fn) => fn());
  }

  if (fullBleed) {
    // The card AR matches the frame exactly, so it fills 1080×1920 with no
    // distortion and no margin — a clean, story-ready full frame.
    ctx.drawImage(cardCanvas, 0, 0, base.w, base.h);
  } else {
    // Center the strip with a small uniform margin + a soft shadow.
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
  }

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
function canShareFiles(): boolean {
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
