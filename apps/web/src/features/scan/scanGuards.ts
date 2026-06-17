import type { GenerationResult, UploadedPhoto } from '../../state/generation';

/**
 * True when `result` was produced from exactly these `face`/`outfit` photos.
 *
 * Used to stop the scan route from re-running (and re-spending a credit) when the
 * user navigates back to it from the result page: the photos persist in the
 * session, so without this check a remount would kick off a brand-new scan of an
 * image whose verdict already exists. Photo urls are stable baked data URLs, so an
 * exact match is reliable within a session and across reloads.
 *
 * Matches on the parts that are present in the result: a face-only result matches a
 * face-only session, an outfit-only result matches an outfit-only session, and a
 * both-modality result requires both photos to match.
 */
export function resultMatchesPhotos(
  result: GenerationResult | null,
  face: UploadedPhoto | null,
  outfit: UploadedPhoto | null,
): boolean {
  if (!result) return false;
  const faceOk = result.face ? !!face && result.face.card.imageUrl === face.url : !face;
  const outfitOk = result.outfit ? !!outfit && result.outfit.card.imageUrl === outfit.url : !outfit;
  return faceOk && outfitOk;
}
