import type { FaceCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import type { SkinProps } from './types';

/**
 * Buffering skin (face) — a "loading screen" card: a contained photo on top
 * (cover-cropped, never stretched) with a BUFFERING_ pill, then a content block
 * carrying NOW LOADING + the big Aura %, the verdict title, progress bars for the
 * percentage stats, an italic quote (the roast) and a RENDER READY footer. System
 * tokens; accent follows gender (cyan masc / magenta femme). Femme renders the
 * ivory/cream theme via the `data-gender` ancestor. Editable sticker rides on top.
 */
export function BufferingFace({ content, roast }: SkinProps) {
  const c = content as FaceCardContent;
  const big = c.scores.find((s) => s.id === 'aura') ?? c.scores[0];
  const bars = c.scores.filter((s) => !s.noBar);
  return (
    <div className="asset buffering-card" data-kind="face">
      <div className="buffering-photo">
        <CardImage src={c.imageUrl} shape="rect" placeholder="drop face photo" alt="Your face" />
        <div className="buffering-photo-top">
          <span className="buffering-pill">BUFFERING<span className="cur">_</span></span>
          <span className="buffering-mono dim">LOADING V1.0</span>
        </div>
      </div>
      <div className="buffering-info">
        <div className="buffering-head">
          <span className="buffering-mono accent">NOW LOADING</span>
          <span className="buffering-bigpct">{big.value}<i>%</i></span>
        </div>
        <h2 className="buffering-title">
          {c.verdict[0]} <span className="hl">{c.verdict[1]}</span>
        </h2>
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
        {roast && <p className="buffering-quote">“{roast}”</p>}
        <div className="buffering-foot">
          <span className="buffering-nextbtn">RENDER READY</span>
          <span className="buffering-spark">✦ FITAURA.APP</span>
        </div>
      </div>
    </div>
  );
}
