import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Clean skin (face) — the photo fills the card (framed on the face, never
 * stretched), but a translucent glass block at the bottom holds all the copy: the
 * verdict, roast, estimated age, the remaining face stats as Clean pill chips, and
 * a footer read. The block covers the lower photo, so the crisp image is the
 * smaller top slice. System tokens only; the verdict highlight uses the semantic
 * `--verdict` colour to match the Dossier (first) face card. The editable sticker
 * rides on top from the Result page.
 */
export function CleanFace({ content, roast }: SkinProps) {
  const c = content as FaceCardContent;
  const age = c.scores.find((s) => s.id === 'age');
  const chips = c.scores.filter((s) => s.id !== 'age');
  return (
    <div className="asset clean-card cleanface" data-kind="face">
      <CardImage src={c.imageUrl} shape="rect" placeholder="drop face photo" alt="Your face" />
      <span className="clean-wm">FITAURA</span>
      <div className="cleanface-info">
        <h2 className="clean-verdict">
          {c.verdict[0]} <span className="hl">{c.verdict[1]}</span>
        </h2>
        {roast && <p className="cleanface-roast">{roast}</p>}
        {age && <p className="cleanface-age">EST. {age.displayValue ?? age.value}</p>}
        <div className="clean-chips">
          {chips.map((s) => (
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
