import type { GenerationResult, UploadedPhoto } from '../../state/generation';

/**
 * True when `result` was produced from exactly these `face`/`outfit` photos.
 *
 * Used to stop the scan route from re-running (and re-spending a credit) when the
 * user navigates back to it from the result page: the photos persist in the
 * session, so without this check a remount would kick off a brand-new scan of an
 * image whose verdict already exists. Photo urls are stable baked data URLs, so an
 * exact match is reliable within a session and across reloads.
 */
export function resultMatchesPhotos(
  result: GenerationResult | null,
  face: UploadedPhoto | null,
  outfit: UploadedPhoto | null,
): boolean {
  return (
    !!result &&
    !!face &&
    !!outfit &&
    result.face.card.imageUrl === face.url &&
    result.outfit.card.imageUrl === outfit.url
  );
}
