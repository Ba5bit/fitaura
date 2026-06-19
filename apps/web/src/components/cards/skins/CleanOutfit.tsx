import type { OutfitCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Clean skin (outfit) — full-bleed, Tinder-style: the photo fills the card, a
 * gradient scrim carries the caption, the fit score + stat chips and a one-line
 * read. System tokens; accent follows the card's gender identity.
 */
export function CleanOutfit({ content, roast }: SkinProps) {
  const c = content as OutfitCardContent;
  const chips = c.scores.slice(0, 3);
  return (
    <div className="asset clean-card" data-kind="outfit">
      <CardImage src={c.imageUrl} shape="rect" placeholder="drop outfit photo" alt="Your outfit" />
      <div className="clean-scrim" />
      <span className="clean-wm">FITAURA</span>
      <div className="score-badge">
        <span className="sub">FIT SCORE</span>
        <span className="num">{c.overallScore}</span>
      </div>
      <div className="clean-bottom">
        <h2 className="clean-verdict">{c.caption}</h2>
        <div className="clean-chips">
          {chips.map((s) => (
            <span className="clean-chip" key={s.id}>{s.label} · {s.displayValue ?? s.value}</span>
          ))}
        </div>
        {roast && <p className="clean-bio">{roast}</p>}
      </div>
    </div>
  );
}
