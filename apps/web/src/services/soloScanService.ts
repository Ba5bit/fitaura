// apps/web/src/services/soloScanService.ts
import type { FullGenerationResult } from '@fitaura/shared';
import { getSupabase } from '../lib/supabase';

export interface InlineImage {
  mimeType: string;
  data: string;
}

export type SoloScanOutcome =
  | { kind: 'result'; result: FullGenerationResult }
  | { kind: 'retake'; faceUsable: boolean; outfitUsable: boolean; instruction: string }
  | { kind: 'error'; message: string };

/** Split a `data:<mime>;base64,<data>` URL into the inline image parts.
 * Mime is restricted to what the Edge Function (and Gemini) accept, so an
 * unsupported type is rejected here instead of after a wasted round-trip. */
export function dataUrlToInline(dataUrl: string): InlineImage {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('not_a_data_url');
  return { mimeType: m[1], data: m[2] };
}

/** Invoke the `solo-scan` Edge Function with a face url, an outfit url, or both. */
export async function runSoloScan(
  faceDataUrl: string | null,
  outfitDataUrl: string | null,
): Promise<SoloScanOutcome> {
  let face: InlineImage | undefined;
  let outfit: InlineImage | undefined;
  try {
    if (faceDataUrl) face = dataUrlToInline(faceDataUrl);
    if (outfitDataUrl) outfit = dataUrlToInline(outfitDataUrl);
  } catch {
    return { kind: 'error', message: 'bad_image' };
  }
  if (!face && !outfit) return { kind: 'error', message: 'bad_image' };

  const scanId = crypto.randomUUID();
  const body: Record<string, unknown> = { scanId };
  if (face) body.face = face;
  if (outfit) body.outfit = outfit;

  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke('solo-scan', { body });

  if (error || !data) {
    // App-level errors now return HTTP 200 with a reason; only true transport/infra
    // failures reach here (supabase-js discards the body on non-2xx), so show a
    // friendly line instead of its generic "non-2xx status code" message.
    if (error) console.error('solo-scan invoke failed', error);
    return { kind: 'error', message: 'Could not reach the scanner — check your connection and try again.' };
  }
  if (data.ok) {
    if (data.result) return { kind: 'result', result: data.result as FullGenerationResult };
    return { kind: 'error', message: 'missing_result' };
  }
  if (data.kind === 'retake') {
    return { kind: 'retake', faceUsable: !!data.faceUsable, outfitUsable: !!data.outfitUsable, instruction: String(data.instruction ?? '') };
  }
  return { kind: 'error', message: String(data.message ?? 'generation_failed') };
}
