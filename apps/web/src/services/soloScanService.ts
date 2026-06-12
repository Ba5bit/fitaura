// apps/web/src/services/soloScanService.ts
import type { FullGenerationResult } from '@fitaura/shared';
import { supabase } from '../lib/supabase';

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

/** Invoke the `solo-scan` Edge Function for one face + outfit data URL pair. */
export async function runSoloScan(faceDataUrl: string, outfitDataUrl: string): Promise<SoloScanOutcome> {
  let face: InlineImage;
  let outfit: InlineImage;
  try {
    face = dataUrlToInline(faceDataUrl);
    outfit = dataUrlToInline(outfitDataUrl);
  } catch {
    return { kind: 'error', message: 'bad_image' };
  }

  const scanId = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke('solo-scan', {
    body: { scanId, face, outfit },
  });

  if (error || !data) return { kind: 'error', message: error?.message ?? 'no_response' };
  if (data.ok) {
    // Success must carry a result; an empty success means server-side schema drift.
    if (data.result) return { kind: 'result', result: data.result as FullGenerationResult };
    return { kind: 'error', message: 'missing_result' };
  }
  if (data.kind === 'retake') {
    return { kind: 'retake', faceUsable: !!data.faceUsable, outfitUsable: !!data.outfitUsable, instruction: String(data.instruction ?? '') };
  }
  return { kind: 'error', message: String(data.message ?? 'generation_failed') };
}
