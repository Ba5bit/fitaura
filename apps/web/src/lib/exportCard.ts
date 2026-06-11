import { toCanvas } from 'html-to-image';
import { type DatingVerdict } from '@fitaura/shared';

/**
 * Card export — rasterizes the actual on-screen card (WYSIWYG) and centers it on
 * a branded 9:16 (1080×1920) poster, then downloads or shares it. Ported from the
 * Card Studio's `renderAssetBlob`, simplified for in-app use (fonts are already
 * loaded, so we just await `document.fonts.ready`).
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
  /** Accent hex driving the poster glow (defaults to cyan). */
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

/**
 * Build a self-contained `@font-face` stylesheet for the export snapshot.
 *
 * html-to-image rasterizes the card through an SVG `<foreignObject>`, which
 * renders in an isolated context with no access to the document's loaded fonts.
 * We can't let the library inline them itself because they live in a
 * cross-origin Google Fonts `<link>` (reading its `cssRules` throws a
 * SecurityError). So we fetch that stylesheet ourselves — Google serves both
 * the CSS API and gstatic woff2 files with permissive CORS — and rewrite every
 * `url(...)` into a base64 data URI. The result is passed via `fontEmbedCSS`
 * so the snapshot carries the actual font data and renders Anton/Hanken
 * Grotesk/Space Mono exactly as on screen. Cached after the first build.
 */
let fontEmbedCSSPromise: Promise<string> | null = null;

function getFontStylesheetHref(): string | null {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  );
  const google = links.find((l) => l.href.includes('fonts.googleapis.com'));
  return google?.href ?? null;
}

async function fetchAsDataURI(url: string): Promise<string> {
  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok) throw new Error(`Font fetch failed: ${url} (${resp.status})`);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const type = resp.headers.get('content-type') || 'font/woff2';
  return `data:${type};base64,${btoa(binary)}`;
}

async function buildFontEmbedCSS(): Promise<string> {
  if (fontEmbedCSSPromise) return fontEmbedCSSPromise;
  fontEmbedCSSPromise = (async () => {
    const href = getFontStylesheetHref();
    if (!href) throw new Error('Google Fonts stylesheet not found');
    const cssResp = await fetch(href, { mode: 'cors' });
    if (!cssResp.ok) throw new Error(`Font CSS fetch failed (${cssResp.status})`);
    let css = await cssResp.text();

    // Collect every distinct font URL, inline it once, and substitute.
    const urls = new Set<string>();
    const urlRe = /url\((['"]?)(https?:\/\/[^'")]+)\1\)/g;
    for (let m = urlRe.exec(css); m; m = urlRe.exec(css)) urls.add(m[2]);

    const replacements = await Promise.all(
      Array.from(urls).map(async (u) => [u, await fetchAsDataURI(u)] as const),
    );
    for (const [original, dataUri] of replacements) {
      css = css.split(original).join(dataUri);
    }
    return css;
  })();
  // On failure, clear the cache so a later attempt can retry.
  fontEmbedCSSPromise.catch(() => {
    fontEmbedCSSPromise = null;
  });
  return fontEmbedCSSPromise;
}

/** Render the given card element to a 9:16 PNG blob. */
export async function renderCardBlob(args: ExportArgs): Promise<ExportResult> {
  const { el, kind, verdict, accentHex = '#54e6f0' } = args;
  await ensureFonts();
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

  // Capture the card node 1:1, dropping edit-only overlays from the snapshot.
  // We pass our own `fontEmbedCSS` (Google's woff2 inlined as data URIs) so the
  // off-document SVG snapshot renders Anton/Hanken Grotesk/Space Mono exactly as
  // on screen. If embedding fails (e.g. offline), fall back to `skipFonts` so an
  // image is still produced rather than throwing.
  let fontEmbedCSS: string | undefined;
  try {
    fontEmbedCSS = await buildFontEmbedCSS();
  } catch {
    fontEmbedCSS = undefined;
  }
  const cardCanvas = await toCanvas(el, {
    pixelRatio: 3,
    width: el.offsetWidth,
    height: el.offsetHeight,
    fontEmbedCSS,
    skipFonts: fontEmbedCSS === undefined,
    filter: (n) =>
      !(n instanceof Element && (n.classList.contains('st-overlay') || n.classList.contains('st-edithint'))),
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
