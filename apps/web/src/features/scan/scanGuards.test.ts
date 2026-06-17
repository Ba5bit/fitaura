import { describe, expect, it } from 'vitest';
import { resultMatchesPhotos } from './scanGuards';
import type { GenerationResult, UploadedPhoto } from '../../state/generation';

const photo = (url: string): UploadedPhoto => ({ url });
const result = (faceUrl: string, outfitUrl: string): GenerationResult =>
  ({ face: { card: { imageUrl: faceUrl } }, outfit: { card: { imageUrl: outfitUrl } } } as unknown as GenerationResult);

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
