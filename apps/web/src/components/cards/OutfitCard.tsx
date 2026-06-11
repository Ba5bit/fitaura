import type { OutfitCardContent } from '@fitaura/shared';
import { CardImage } from './CardImage';
import { Sticker } from './Sticker';
import { MiniStat } from './MiniStat';
import { Bars } from './Bars';
import { useCountUp } from '../../lib/useCountUp';

interface OutfitCardProps {
  content: OutfitCardContent;
  stickerOn?: boolean;
  run?: boolean;
}

/**
 * Outfit Check — image-led, EXPORTABLE shareable asset.
 * Ported 1:1 from the design's `OutfitCard`.
 */
export function OutfitCard({ content, stickerOn = true, run = true }: OutfitCardProps) {
  const score = useCountUp(content.overallScore, run);
  return (
    <div className="asset outfitcard">
      <div className="outfit-photo">
        <CardImage src={content.imageUrl} shape="rect" placeholder="drop outfit photo" alt="Your outfit" />
        <div className="scrim" />
        <div className="oc-top">
          <span className="brand-tag">FITAURA</span>
        </div>
        <div className="score-badge">
          <span className="num">{score}</span>
          <span className="sub">FIT SCORE</span>
        </div>
        <Sticker sticker={content.sticker} hidden={!stickerOn} kind="outfit" />
        <div className="caption-bar">
          <div className="cap">{content.caption}</div>
        </div>
      </div>
      <div className="oc-body">
        <div className="oc-stats">
          {content.scores.map((stat) => (
            <MiniStat key={stat.id} stat={stat} run={run} />
          ))}
        </div>
        <div className="oc-foot">
          <span className="kind-tag">FIT / PHYSIQUE READ</span>
          <div className="barcode">
            <Bars seed={88} count={20} />
          </div>
        </div>
      </div>
    </div>
  );
}
