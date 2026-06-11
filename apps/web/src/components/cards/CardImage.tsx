/**
 * CardImage — the production replacement for the design-time `<image-slot>`
 * custom element. The upload flow produces a ready, cropped image URL; this
 * component simply renders it covering the frame (or a neutral placeholder when
 * empty). Positioning/sizing comes from the surrounding `.card-image` CSS that
 * the design already defines for each card.
 */
export type CardImageShape = 'circle' | 'rect';

interface CardImageProps {
  src: string | null | undefined;
  shape?: CardImageShape;
  placeholder?: string;
  alt?: string;
}

export function CardImage({
  src,
  shape = 'rect',
  placeholder = 'drop a photo',
  alt = '',
}: CardImageProps) {
  return (
    <div className="card-image" data-shape={shape} data-filled={src ? 'true' : 'false'}>
      {src ? (
        <img src={src} alt={alt} draggable={false} />
      ) : (
        <span className="card-image-placeholder">{placeholder}</span>
      )}
    </div>
  );
}
