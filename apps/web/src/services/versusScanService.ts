// apps/web/src/services/versusScanService.ts
import type { VersusResult } from '@fitaura/shared';
import type { Battle } from '../state/battle';
import { supabase } from '../lib/supabase';

export interface InlineImage {
  mimeType: string;
  data: string;
}

export type VersusScanOutcome =
  | { kind: 'result'; result: VersusResult }
  | { kind: 'error'; message: string };

/** Split a `data:<mime>;base64,<data>` URL into the inline image parts.
 * Mime is restricted to what the Edge Function (and Gemini) accept, so an
 * unsupported type is rejected here instead of after a wasted round-trip. */
export function dataUrlToInline(dataUrl: string): InlineImage {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('not_a_data_url');
  return { mimeType: m[1], data: m[2] };
}

/** Invoke the `versus-scan` Edge Function with the contenders' active photos.
 * The mode decides which of the four slots count (face → aFace,bFace;
 * fit → aFit,bFit; both → all four). */
export async function runVersusScan(battle: Battle): Promise<VersusScanOutcome> {
  const { mode, imgs } = battle;
  const wantFace = mode === 'face' || mode === 'both';
  const wantFit = mode === 'fit' || mode === 'both';

  const images: { aFace?: InlineImage; aFit?: InlineImage; bFace?: InlineImage; bFit?: InlineImage } = {};
  try {
    if (wantFace && imgs.aFace) images.aFace = dataUrlToInline(imgs.aFace);
    if (wantFace && imgs.bFace) images.bFace = dataUrlToInline(imgs.bFace);
    if (wantFit && imgs.aFit) images.aFit = dataUrlToInline(imgs.aFit);
    if (wantFit && imgs.bFit) images.bFit = dataUrlToInline(imgs.bFit);
  } catch {
    return { kind: 'error', message: 'bad_image' };
  }
  if (Object.keys(images).length === 0) return { kind: 'error', message: 'bad_image' };

  const body = { battleId: crypto.randomUUID(), mode, images };

  const { data, error } = await supabase.functions.invoke('versus-scan', { body });

  if (error || !data) {
    // App-level errors return HTTP 200 with a reason; only true transport/infra
    // failures reach here (supabase-js discards the body on non-2xx), so show a
    // friendly line instead of its generic "non-2xx status code" message.
    if (error) console.error('versus-scan invoke failed', error);
    return { kind: 'error', message: 'Could not reach the scanner — check your connection and try again.' };
  }
  if (data.ok && data.result) {
    return { kind: 'result', result: data.result as VersusResult };
  }
  return { kind: 'error', message: String(data.message ?? 'generation_failed') };
}
