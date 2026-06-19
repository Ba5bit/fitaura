import type { OutfitCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Buffering skin (outfit) — the "loading screen" card for the fit: a contained
 * photo on top (cover-cropped, never stretched) with a BUFFERING_ pill, then a
 * content block with NOW LOADING + the big fit %, the caption title, progress bars
 * for the four fit stats, an italic quote (the read) and a RENDER READY footer.
 * System tokens; accent follows gender. Femme renders the ivory/cream theme.
 */
export function BufferingOutfit({ content, roast }: SkinProps) {
  const c = content as OutfitCardContent;
  const bars = c.scores.filter((s) => !s.noBar);
  return (
    <div className="asset buffering-card" data-kind="outfit">
      <div className="buffering-photo">
        <CardImage src={c.imageUrl} shape="rect" placeholder="drop outfit photo" alt="Your outfit" />
        <div className="buffering-photo-top">
          <span className="buffering-pill">BUFFERING<span className="cur">_</span></span>
          <span className="buffering-mono dim">LOADING V1.0</span>
        </div>
      </div>
      <div className="buffering-info">
        <div className="buffering-head">
          <span className="buffering-score-pill">FIT SCORE</span>
          <span className="buffering-bigpct">{c.overallScore}</span>
        </div>
        <h2 className="buffering-title">{c.caption}</h2>
        {roast && <p className="buffering-quote">“{roast}”</p>}
        <div className="buffering-bars">
          {bars.map((s) => (
            <div className="buffering-bar" key={s.id}>
              <div className="buffering-bar-top">
                <span>{s.label}</span>
                <b>{s.value}%</b>
              </div>
              <div className="buffering-bar-track">
                <div className="buffering-bar-fill" style={{ width: `${s.value}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="buffering-foot">
          <span className="buffering-nextbtn">RENDER READY</span>
          <span className="buffering-spark">✦ FITAURA.STUDIO</span>
        </div>
      </div>
    </div>
  );
}
