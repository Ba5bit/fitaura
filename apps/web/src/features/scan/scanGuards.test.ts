import { describe, expect, it } from 'vitest';
import { resultMatchesPhotos } from './scanGuards';
import type { GenerationResult, UploadedPhoto } from '../../state/generation';

const photo = (url: string): UploadedPhoto => ({ url });
const result = (faceUrl: string | null, outfitUrl: string | null): GenerationResult =>
  ({
    parts: { face: faceUrl != null, outfit: outfitUrl != null },
    face: faceUrl != null ? { card: { imageUrl: faceUrl } } : null,
    outfit: outfitUrl != null ? { card: { imageUrl: outfitUrl } } : null,
  } as unknown as GenerationResult);

describe('resultMatchesPhotos', () => {
  it('matches when both photo urls equal the result card urls', () => {
    expect(resultMatchesPhotos(result('face-a', 'fit-a'), photo('face-a'), photo('fit-a'))).toBe(true);
  });

  it('does not match when the face photo differs', () => {
    expect(resultMatchesPhotos(result('face-a', 'fit-a'), photo('face-b'), photo('fit-a'))).toBe(false);
  });

  it('does not match when the outfit photo differs', () => {
    expect(resultMatchesPhotos(result('face-a', 'fit-a'), photo('face-a'), photo('fit-b'))).toBe(false);
  });

  it('returns false when there is no result yet', () => {
    expect(resultMatchesPhotos(null, photo('face-a'), photo('fit-a'))).toBe(false);
  });

  it('returns false when photos are missing', () => {
    expect(resultMatchesPhotos(result('face-a', 'fit-a'), null, null)).toBe(false);
  });
});

describe('resultMatchesPhotos (partial)', () => {
  it('outfit-only result matches an outfit-only session', () => {
    expect(resultMatchesPhotos(result(null, 'fit-a'), null, photo('fit-a'))).toBe(true);
  });
  it('outfit-only result does NOT match when a face photo is also present', () => {
    expect(resultMatchesPhotos(result(null, 'fit-a'), photo('face-a'), photo('fit-a'))).toBe(false);
  });
  it('face-only result matches a face-only session', () => {
    expect(resultMatchesPhotos(result('face-a', null), photo('face-a'), null)).toBe(true);
  });
});
