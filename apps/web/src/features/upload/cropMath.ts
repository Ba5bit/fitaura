/**
 * Crop geometry shared by the UploadZone interaction and the bake step.
 * Mirrors the design's `clampView` / `imgStyle` model: the image covers the
 * frame on its tighter axis at zoom 1, then pans/zooms within clamped bounds.
 */
export interface Frame {
  w: number;
  h: number;
}
export interface Natural {
  w: number;
  h: number;
}
export interface View {
  zoom: number;
  x: number;
  y: number;
}

import type { CSSProperties } from 'react';

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/** Cover-baseline scale (natural → display) at zoom 1. */
function baseScale(nat: Natural, frame: Frame): number {
  return Math.max(frame.w / nat.w, frame.h / nat.h);
}

/** Clamp pan so the frame is always fully covered (safe-framing guarantee). */
export function clampView(v: View, nat: Natural, frame: Frame): View {
  const base = baseScale(nat, frame);
  const dispW = nat.w * base * v.zoom;
  const dispH = nat.h * base * v.zoom;
  const mx = Math.max(0, (dispW - frame.w) / 2);
  const my = Math.max(0, (dispH - frame.h) / 2);
  return {
    zoom: v.zoom,
    x: Math.max(-mx, Math.min(mx, v.x)),
    y: Math.max(-my, Math.min(my, v.y)),
  };
}

/** Inline style placing the <img> inside the crop frame (display px). */
export function imgStyle(v: View, nat: Natural, frame: Frame): CSSProperties {
  const base = baseScale(nat, frame);
  const dispW = nat.w * base * v.zoom;
  const dispH = nat.h * base * v.zoom;
  return {
    width: `${dispW}px`,
    height: `${dispH}px`,
    transform: `translate(calc(-50% + ${v.x}px), calc(-50% + ${v.y}px))`,
  };
}

/**
 * Bake the current crop to a data URL at the card's target resolution.
 * Returns a WebP data URL stored on-device (never uploaded permanently).
 */
export function bakeCrop(
  img: HTMLImageElement,
  view: View,
  frame: Frame,
  out: { w: number; h: number },
): string {
  const nat: Natural = { w: img.naturalWidth, h: img.naturalHeight };
  const scale = baseScale(nat, frame) * view.zoom; // natural → display
  const dispW = nat.w * scale;
  const dispH = nat.h * scale;

  // Frame's top-left within the displayed image (display px from image origin).
  const leftDisplay = dispW / 2 - view.x - frame.w / 2;
  const topDisplay = dispH / 2 - view.y - frame.h / 2;

  // Convert to natural source coordinates.
  const sx = leftDisplay / scale;
  const sy = topDisplay / scale;
  const sw = frame.w / scale;
  const sh = frame.h / scale;

  const canvas = document.createElement('canvas');
  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.w, out.h);
  return canvas.toDataURL('image/webp', 0.85);
}
