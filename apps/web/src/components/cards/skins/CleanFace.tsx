import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Clean skin (face) — full-bleed, Tinder-style: the photo fills the card, a
 * gradient scrim carries the verdict, stat chips and a one-line read at the
 * bottom. System tokens; the accent (verdict highlight + score chip) follows the
 * card's gender identity via the ancestor `data-gender`. The editable sticker
 * rides on top from the Result page.
 */
export function CleanFace({ content, roast }: SkinProps) {
  const c = content as FaceCardContent;
  const chips = c.scores.slice(0, 3);
  return (
    <div className="asset clean-card" data-kind="face">
      <CardImage src={c.imageUrl} shape="rect" placeholder="drop face photo" alt="Your face" />
      <div className="clean-scrim" />
      <span className="clean-wm">FITAURA</span>
      <div className="clean-bottom">
        <h2 className="clean-verdict">
          {c.verdict[0]} <span className="hl">{c.verdict[1]}</span>
        </h2>
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
