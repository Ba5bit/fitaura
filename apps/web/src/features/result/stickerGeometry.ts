/**
 * Sticker placement geometry — ported from the Card Studio (`sticker-editor.jsx`).
 * All coordinates are normalized (0..1 of the card box). Integrated into the
 * Verdict page so stickers can be repositioned in-place without a separate studio.
 *
 *  - safe:    the printable safe zone; the sticker bbox must stay inside.
 *  - exclude: critical text the sticker must never overlap.
 *  - guides:  snap lines the sticker eases to.
 *  - def:     default anchor (sticker CENTER) used on entry + reset.
 */
export type StickerKind = 'face' | 'outfit';

export interface Point {
  cx: number;
  cy: number;
}
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface CardGeom {
  safe: Rect;
  exclude: (Rect & { label: string })[];
  guides: { x: number[]; y: number[] };
  def: Point;
}

export const CARD_GEOM: Record<StickerKind, CardGeom> = {
  face: {
    safe: { x0: 0.05, y0: 0.045, x1: 0.95, y1: 0.955 },
    exclude: [
      { x0: 0.05, y0: 0.045, x1: 0.95, y1: 0.1, label: 'BRAND' },
      { x0: 0.06, y0: 0.55, x1: 0.94, y1: 0.735, label: 'VERDICT' },
      { x0: 0.05, y0: 0.755, x1: 0.95, y1: 0.955, label: 'STATS' },
    ],
    guides: { x: [0.5], y: [0.3] },
    def: { cx: 0.72, cy: 0.4 },
  },
  outfit: {
    safe: { x0: 0.04, y0: 0.04, x1: 0.96, y1: 0.96 },
    exclude: [
      { x0: 0.04, y0: 0.04, x1: 0.52, y1: 0.105, label: 'BRAND' },
      { x0: 0.7, y0: 0.025, x1: 0.96, y1: 0.2, label: 'SCORE' },
      { x0: 0.04, y0: 0.585, x1: 0.96, y1: 0.715, label: 'CAPTION' },
      { x0: 0.04, y0: 0.715, x1: 0.96, y1: 0.96, label: 'READ' },
    ],
    guides: { x: [0.5], y: [0.5] },
    def: { cx: 0.27, cy: 0.34 },
  },
};

/** Preset stamp slots for the receipt (preset positions only, no free drag). */
export interface ReceiptPreset {
  id: string;
  label: string;
  cx: number;
  cy: number;
  rot: number;
  wide: boolean;
}
export const RECEIPT_PRESETS: ReceiptPreset[] = [
  { id: 'tr', label: 'Top right', cx: 0.8, cy: 0.135, rot: 13, wide: false },
  { id: 'center', label: 'Overlay', cx: 0.5, cy: 0.5, rot: -8, wide: true },
  { id: 'bl', label: 'Bottom left', cx: 0.24, cy: 0.875, rot: -10, wide: false },
];

const EPS = 1e-4;
const box = (c: Point, hw: number, hh: number): Rect => ({
  x0: c.cx - hw,
  y0: c.cy - hh,
  x1: c.cx + hw,
  y1: c.cy + hh,
});
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const toSafe = (s: Rect, x: number, y: number, hw: number, hh: number): Point => ({
  cx: Math.min(Math.max(x, s.x0 + hw), s.x1 - hw),
  cy: Math.min(Math.max(y, s.y0 + hh), s.y1 - hh),
});

/**
 * Clamp the sticker center so its half-extent box stays in the safe zone AND
 * clears every critical-text exclusion. Slides along forbidden edges instead of
 * tunnelling through them.
 */
export function clampSticker(spec: CardGeom, cx: number, cy: number, halfW: number, halfH: number): Point {
  const s = spec.safe;
  let p = toSafe(s, cx, cy, halfW, halfH);
  const totalOv = (c: Point) =>
    spec.exclude.reduce((sum, z) => sum + overlapArea(box(c, halfW, halfH), z), 0);
  for (let pass = 0; pass < 10; pass++) {
    const cur = totalOv(p);
    if (cur <= EPS) break;
    const cands: Point[] = [];
    for (const z of spec.exclude) {
      cands.push(
        { cx: z.x0 - halfW, cy: p.cy },
        { cx: z.x1 + halfW, cy: p.cy },
        { cx: p.cx, cy: z.y0 - halfH },
        { cx: p.cx, cy: z.y1 + halfH },
        { cx: z.x0 - halfW, cy: z.y0 - halfH },
        { cx: z.x1 + halfW, cy: z.y1 + halfH },
      );
    }
    const scored = cands
      .map((c) => toSafe(s, c.cx, c.cy, halfW, halfH))
      .map((c) => ({ c, ov: totalOv(c), d: Math.hypot(c.cx - p.cx, c.cy - p.cy) }))
      .sort((a, b) => a.ov - b.ov || a.d - b.d);
    if (!scored.length || scored[0].ov >= cur - EPS) break;
    p = scored[0].c;
  }
  return p;
}

const SNAP_THRESH = 0.035;
export function nearestGuide(
  val: number,
  guides: number[],
  half: number,
  safeLo: number,
  safeHi: number,
): number | null {
  const cands = [...guides, safeLo + half, safeHi - half];
  let best: number | null = null;
  let bestD = SNAP_THRESH;
  for (const g of cands) {
    const d = Math.abs(val - g);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

export function posWords(cx: number, cy: number): string {
  const h = cx < 0.37 ? 'left' : cx > 0.63 ? 'right' : 'center';
  const v = cy < 0.37 ? 'upper' : cy > 0.63 ? 'lower' : 'middle';
  return `${v} ${h}`;
}
