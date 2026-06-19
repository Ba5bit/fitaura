import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Clean skin (face) — a contained photo on top (framed on the face, never
 * stretched) that ends at the info block; the block below holds all the copy: the
 * verdict, roast, estimated age, the remaining face stats as Clean pill chips, and
 * a footer read. System tokens only; the verdict highlight uses the semantic
 * `--verdict` colour to match the Dossier (first) face card. The editable sticker
 * rides on top from the Result page.
 */
export function CleanFace({ content, roast }: SkinProps) {
  const c = content as FaceCardContent;
  const age = c.scores.find((s) => s.id === 'age');
  const chips = c.scores.filter((s) => s.id !== 'age');
  return (
    <div className="asset clean-card cleanface" data-kind="face">
      <div className="cleanface-photo">
        <CardImage src={c.imageUrl} shape="rect" placeholder="drop face photo" alt="Your face" />
        <span className="clean-wm">FITAURA</span>
      </div>
      <div className="cleanface-info">
        <h2 className="clean-verdict">
          {c.verdict[0]} <span className="hl">{c.verdict[1]}</span>
        </h2>
        {roast && <p className="cleanface-roast">{roast}</p>}
        {age && <p className="cleanface-age">ESTIMATED AGE {age.displayValue ?? age.value}</p>}
        <div className="clean-chips">
          {chips.map((s) => (
            <span className="clean-chip" key={s.id}>
              {s.label} · {s.displayValue ?? s.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
