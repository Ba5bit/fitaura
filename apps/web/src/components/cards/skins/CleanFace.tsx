import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Clean skin (face) — a contained, naturally-cropped photo carries the verdict,
 * punchline and roast on a bottom scrim; a solid info block below holds the four
 * face stats as Clean pill chips and a footer read. Replaces the old full-bleed
 * layout that stretched/over-cropped selfies. System tokens only; the accent
 * (verdict highlight, punchline) follows the card's gender identity via the
 * ancestor `data-gender`. The editable sticker rides on top from the Result page.
 */
export function CleanFace({ content, roast, punchline }: SkinProps) {
  const c = content as FaceCardContent;
  return (
    <div className="asset clean-card cleanface" data-kind="face">
      <div className="cleanface-photo">
        <CardImage src={c.imageUrl} shape="rect" placeholder="drop face photo" alt="Your face" />
        <span className="clean-wm">FITAURA</span>
        <div className="cleanface-photo-scrim" />
        <div className="cleanface-text">
          <h2 className="clean-verdict">
            {c.verdict[0]} <span className="hl">{c.verdict[1]}</span>
          </h2>
          {punchline && <p className="cleanface-punch">{punchline}</p>}
          {roast && <p className="cleanface-roast">{roast}</p>}
        </div>
      </div>
      <div className="cleanface-info">
        <div className="clean-chips">
          {c.scores.map((s) => (
            <span className="clean-chip" key={s.id}>
              {s.label} · {s.displayValue ?? s.value}
            </span>
          ))}
        </div>
        <div className="cleanface-read">FACE / VIBE READ</div>
      </div>
    </div>
  );
}
