import { useEffect, useState } from 'react';

/**
 * CardImage — the production replacement for the design-time `<image-slot>`
 * custom element. The upload flow produces a ready, cropped image URL; this
 * component renders it covering the frame (or a neutral placeholder when empty
 * or when the image fails to load). Positioning/sizing comes from the
 * surrounding `.card-image` CSS that the design already defines for each card.
 */
export type CardImageShape = 'circle' | 'rect';

interface CardImageProps {
  src: string | null | undefined;
  shape?: CardImageShape;
  placeholder?: string;
  alt?: string;
}

export function CardImage({ src, shape = 'rect', placeholder = 'drop a photo', alt = '' }: CardImageProps) {
  const [failed, setFailed] = useState(false);
  // Reset the error state whenever the source changes.
  useEffect(() => setFailed(false), [src]);

  const show = src && !failed;
  return (
    <div className="card-image" data-shape={shape} data-filled={show ? 'true' : 'false'}>
      {show ? (
        <img src={src} alt={alt} draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span className="card-image-placeholder">{placeholder}</span>
      )}
    </div>
  );
}
