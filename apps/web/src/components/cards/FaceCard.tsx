import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from './CardImage';
import { Sticker } from './Sticker';
import { MiniStat } from './MiniStat';
import { Bars } from './Bars';

interface FaceCardProps {
  content: FaceCardContent;
  /** Sticker visibility override from the result-page control. */
  stickerOn?: boolean;
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
export function FaceCard({ content, stickerOn = true, run = true, roast }: FaceCardProps) {
  return (
    <div className="asset facecard">
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
        <Sticker sticker={content.sticker} hidden={!stickerOn} kind="face" />
      </div>
      <div className="fc-verdict">
        <div className="fc-eyebrow">{content.eyebrow}</div>
        <h2 className="fc-line">
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
