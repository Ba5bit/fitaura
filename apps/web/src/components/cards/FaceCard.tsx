import { useLayoutEffect, useRef, useState } from 'react';
import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from './CardImage';
import { MiniStat } from './MiniStat';
import { Bars } from './Bars';

interface FaceCardProps {
  content: FaceCardContent;
  /** Trigger entrance animations (stat count-up). */
  run?: boolean;
  /** Optional one-liner roast shown as a borderless quote under the verdict. */
  roast?: string;
}

/**
 * Face Card — compact, image-led, EXPORTABLE shareable asset.
 * Ported 1:1 from the design's `FaceCard`. Detail lives in the analysis block,
 * never on the card itself.
 */
export function FaceCard({ content, run = true, roast }: FaceCardProps) {
  // The roast shrinks when the verdict wraps to 2–3 lines (less room), so the
  // card stays balanced. Measured from the rendered verdict's line count.
  const lineRef = useRef<HTMLHeadingElement>(null);
  const [vlines, setVlines] = useState(1);
  useLayoutEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const measure = () => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || el.offsetHeight || 1;
      setVlines(Math.max(1, Math.min(3, Math.round(el.offsetHeight / lh))));
    };
    measure();
    // Re-measure once the display font loads — the fallback font wraps differently.
    document.fonts?.ready.then(measure).catch(() => {});
  }, [content.verdict]);
  return (
    <div className="asset facecard" data-vlines={vlines}>
      <div className="glow" />
      <div className="fc-top">
        <span className="brand-tag">FITAURA</span>
        <span className="kind-tag">FACE CARD</span>
      </div>
      <div className="selfie-stage">
        <div className="selfie-ring" />
        <div className="fc-recticks">
          <span className="tl" />
          <span className="tr" />
          <span className="bl" />
          <span className="br" />
        </div>
        <CardImage src={content.imageUrl} shape="circle" placeholder="drop face photo" alt="Your face" />
      </div>
      <div className="fc-verdict">
        <div className="fc-eyebrow">{content.eyebrow}</div>
        <h2 className="fc-line" ref={lineRef}>
          {content.verdict[0]} <span className="hl">{content.verdict[1]}</span>
        </h2>
      </div>
      {roast && <p className="fc-roast">{roast}</p>}
      <div className="fc-stats">
        {content.scores.map((stat) => (
          <MiniStat key={stat.id} stat={stat} run={run} />
        ))}
      </div>
      <div className="fc-foot">
        <span className="kind-tag">{content.index}</span>
        <div className="barcode">
          <Bars seed={31} count={20} />
        </div>
      </div>
    </div>
  );
}
