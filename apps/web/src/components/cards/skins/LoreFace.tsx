import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';
import { LORE_COPY, DotMeter } from './loreCopy';

/**
 * Lore skin (face) — collectible card: full-bleed photo + tint, a FIT LORE
 * header (volume + rarity), a class label, the verdict title, a short read, and
 * dot-meters for the stats. System tokens; gold detailing + gender accent.
 */
export function LoreFace({ content, verdict, roast }: SkinProps) {
  const c = content as FaceCardContent;
  const copy = LORE_COPY[verdict];
  const meters = c.scores.filter((s) => !s.noBar).slice(0, 4);
  return (
    <div className="asset lore-card" data-kind="face">
      <CardImage src={c.imageUrl} shape="rect" placeholder="drop face photo" alt="Your face" />
      <div className="lore-tint" />
      <div className="lore-scrim" />
      <div className="lore-top">
        <span className="lore-mono dim">FIT LORE · {copy.vol}</span>
        <span className="lore-rarity">RARITY <b>{copy.rarity}</b></span>
      </div>
      <div className="lore-bottom">
        <div className="lore-mono gold">{copy.tier}</div>
        <h2 className="lore-title">{c.verdict[0]}<br />{c.verdict[1]}</h2>
        {roast && <p className="lore-bio">{roast}</p>}
        <div className="lore-meters">
          {meters.map((s) => (
            <div className="lore-meter" key={s.id}>
              <span className="ml">{s.label}</span>
              <DotMeter value={s.value} />
            </div>
          ))}
        </div>
        <div className="lore-foot"><span>FIT LORE</span><span className="spark">✦ FITAURA</span></div>
      </div>
    </div>
  );
}
