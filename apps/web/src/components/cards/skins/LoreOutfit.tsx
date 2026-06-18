import type { OutfitCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';
import { LORE_COPY, DotMeter } from './loreCopy';

/**
 * Lore skin (outfit) — collectible card: full-bleed photo + tint, FIT LORE
 * header (volume + the fit score as rarity), class label, the caption title, a
 * short read, and dot-meters for the stats. System tokens; gold + gender accent.
 */
export function LoreOutfit({ content, verdict, roast }: SkinProps) {
  const c = content as OutfitCardContent;
  const copy = LORE_COPY[verdict];
  const meters = c.scores.filter((s) => !s.noBar).slice(0, 4);
  return (
    <div className="asset lore-card" data-kind="outfit">
      <CardImage src={c.imageUrl} shape="rect" placeholder="drop outfit photo" alt="Your outfit" />
      <div className="lore-tint" />
      <div className="lore-scrim" />
      <div className="lore-top">
        <span className="lore-mono dim">FIT LORE · {copy.vol}</span>
        <span className="lore-rarity">FIT <b>{c.overallScore}</b></span>
      </div>
      <div className="lore-bottom">
        <div className="lore-mono gold">{copy.tier}</div>
        <h2 className="lore-title">{c.caption}</h2>
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
