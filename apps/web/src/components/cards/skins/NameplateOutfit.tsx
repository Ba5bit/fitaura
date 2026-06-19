import type { CSSProperties } from 'react';
import type { OutfitCardContent } from '@fitaura/shared';
import { CardImage } from '../CardImage';
import { Bars } from '../Bars';
import type { SkinProps } from './types';

const FALLBACK_ACCENT = { masc: '#83b4ff', femme: '#ff52a6' } as const;

/**
 * Nameplate skin (outfit) — the Aura-Scan "forensic dossier" card. Gemini names
 * and reads the FIT (not a roast); a per-image legibility-clamped accent flows
 * through ticks / brand / lane / dotted leaders while the stars stay gold. When
 * no nameplate is present (legacy / vault rows) it falls back to the caption +
 * verdict read + gender accent and drops the dossier block. Dark for both
 * genders — the accent carries identity.
 */
export function NameplateOutfit({ content, gender, roast }: SkinProps) {
  const c = content as OutfitCardContent;
  const np = c.nameplate;
  const accent = np?.accent || FALLBACK_ACCENT[gender];
  const name = np?.name || c.caption;
  const eyebrow = np?.eyebrow;
  const tagline = np?.tagline || roast;
  const lane = np?.lane;
  const dossier = np?.dossier ?? [];
  const rating = Math.max(0, Math.min(5, c.overallScore / 20));
  const style = { '--accent': accent } as CSSProperties;
  const starStyle = { '--r': rating } as CSSProperties;
  return (
    <div className="asset nameplate-card" data-kind="outfit" style={style}>
      <CardImage src={c.imageUrl} shape="rect" placeholder="drop outfit photo" alt="Your outfit" />
      <div className="np-grain" />
      <div className="np-scrim" />
      <div className="np-ticks"><span className="tl" /><span className="tr" /><span className="bl" /><span className="br" /></div>
      <div className="np-top">
        <span className="np-brand"><span className="dot" />FITAURA</span>
        {lane && <span className="np-lane"><span className="pip" />{lane}</span>}
      </div>
      <div className="np-body">
        {eyebrow && <div className="np-eyebrow">{eyebrow}</div>}
        <h2 className="np-name">{name}</h2>
        <div className="np-rate">
          <span className="np-stars" style={starStyle}>
            <span className="base">★★★★★</span><span className="fill">★★★★★</span>
          </span>
          <span className="np-score">{rating.toFixed(1)}<span className="u">/5</span></span>
        </div>
        {tagline && <p className="np-tagline">{tagline}</p>}
        {dossier.length > 0 && (
          <div className="np-specs">
            {dossier.map((row, i) => (
              <div className="np-spec" key={row.label + i}>
                <span className="k">{row.label}</span>
                <span className="lead" />
                <span className="v">{row.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="np-foot">
          <span className="np-handle"><span className="dot" />Fit read&nbsp; <b>@tryfitaura</b></span>
          <div className="np-barcode"><Bars seed={42} count={10} /></div>
        </div>
      </div>
    </div>
  );
}
