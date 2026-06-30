// apps/web/src/components/cards/nfactorial/NFCards.tsx
//
// FITAURA × nFACTORIAL EDITION — dedicated card components.
// A faithful port of the user's own skin kit (nfactorial-skin-kit/cards.jsx +
// nfactorial.jsx) bound to the app's REAL result data. These are NOT a re-tint of
// the Default cards — they reproduce the kit's full-bleed Face/Outfit cards and the
// nFactorial dating receipt (red + white edition, ¡n! lockup / seal / watermark).
//
// Every component's ROOT is `<div className="nfx">…` — the scope handle. All card
// styles live in `apps/web/src/design/nfactorial-skin.css`, prefixed with `.nfx ` so
// the app's Default cards (same class names, unscoped) are completely unaffected.
import {
  VERDICT_LABEL,
  type DatingReceiptResult,
  type FaceCardContent,
  type OutfitCardContent,
  type ScoreItem,
} from '@fitaura/shared';
import { useCountUp } from '../../../lib/useCountUp';
import { receiptDate } from '../../../lib/format';
import { SITE_URL } from '../../../lib/qr';
import { QrCode } from '../QrCode';
import nfLogo from '../../../assets/nfactorial-logo.png';

/* ----------------------------- local helpers ----------------------------- */

/** MStat input — the kit's compact on-card stat shape. */
interface MStatInput {
  k: string;
  v: number;
  /** Rendered value: a categorical string (displayValue) or the numeric value. */
  shown: string | number;
  noBar?: boolean;
  hot?: boolean;
}

/** Map a real `ScoreItem` to the kit's MStat input. Age has no bar; show its text. */
function toMStat(s: ScoreItem): MStatInput {
  return {
    k: s.label,
    v: s.value,
    shown: s.displayValue ?? s.value,
    noBar: s.noBar ?? s.id === 'age',
    hot: s.hot,
  };
}

/** Compact on-card stat (label, count-up value, fill bar). Port of the kit `MStat`. */
function MStat({ s, run }: { s: MStatInput; run: boolean }) {
  const counted = useCountUp(s.v, run);
  // A categorical stat (e.g. "21 y.o.", "+240") shows its string statically; a
  // numeric stat counts up to its value.
  const val = typeof s.shown === 'string' ? s.shown : counted;
  return (
    <div className={'mstat' + (s.hot ? ' hot' : '') + (s.noBar ? ' mstat--nobar' : '')}>
      <div className="top">
        <span className="lbl">{s.k}</span>
        <span className="val">{val}</span>
      </div>
      {!s.noBar && (
        <div className="track">
          <div className="fill" style={{ width: `${s.v}%` }} />
        </div>
      )}
    </div>
  );
}

/** Decorative deterministic barcode. Port of the kit `Bars`/`NFBars` (renders `.barcode`). */
function Bars({ seed = 31, count = 20 }: { seed?: number; count?: number }) {
  const bars = [];
  let x = seed;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    const w = 1 + (x % 4);
    bars.push(<i key={i} style={{ width: `${w}px`, opacity: x % 5 > 0 ? 0.85 : 0.3 }} />);
  }
  return <div className="barcode">{bars}</div>;
}

/** Co-brand lockup laced into each card's top bar: FITAURA × ¡n!. */
function NFLock() {
  return (
    <div className="nf-lock">
      <span className="brand-tag">FITAURA</span>
      <span className="nf-x">×</span>
      <img className="nf-chip" src={nfLogo} alt="nFactorial" />
    </div>
  );
}

/* -------------------------------- FACE CARD ------------------------------- */

/**
 * nFactorial Face Card — full-bleed photo, the ¡n! co-brand lockup, an AURA score
 * badge, the verdict + roast over a bottom scrim, and a 2-col stat grid below.
 * Port of the kit's `FaceCardFB` / `NFFaceCard`.
 */
export function NFFace({
  content,
  roast,
  run = true,
}: {
  content: FaceCardContent;
  roast?: string;
  run?: boolean;
}) {
  const auraTarget =
    parseInt(content.index.replace(/\D/g, ''), 10) || content.scores[0]?.value || 0;
  const aura = useCountUp(auraTarget, run);
  return (
    <div className="nfx">
      <div className="asset outfitcard facecard-fb nf-face">
        <div className="outfit-photo fc2-photo">
          <img className="slot-img" src={content.imageUrl ?? undefined} alt="" draggable={false} />
          <div className="scrim" />
          <div className="oc-top">
            <NFLock />
          </div>
          <div className="score-badge">
            <span className="num">{aura}</span>
            <span className="sub">Aura</span>
          </div>
          <div className="caption-bar fc2-cap">
            <div className="fc2-eyebrow">{content.eyebrow}</div>
            <h2 className="fc2-name">
              {content.verdict[0]} <span className="hl">{content.verdict[1]}</span>
            </h2>
            {roast && <div className="fc2-tag">{roast}</div>}
          </div>
        </div>
        <div className="oc-body">
          <div className="oc-stats">
            {content.scores.map((s) => (
              <MStat key={s.id} s={toMStat(s)} run={run} />
            ))}
          </div>
          <div className="oc-foot">
            <span className="kind-tag">FACE / AURA READ</span>
            <Bars seed={31} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- OUTFIT CARD ------------------------------ */

/**
 * nFactorial Outfit Card — full-bleed fit photo, the ¡n! lockup, a FIT SCORE badge,
 * the caption over a bottom scrim, and a 2-col stat grid. Port of the kit `OutfitCard`.
 */
export function NFOutfit({ content, run = true }: { content: OutfitCardContent; run?: boolean }) {
  const score = useCountUp(content.overallScore, run);
  return (
    <div className="nfx">
      <div className="asset outfitcard nf-outfit">
        <div className="outfit-photo">
          <img className="slot-img" src={content.imageUrl ?? undefined} alt="" draggable={false} />
          <div className="scrim" />
          <div className="oc-top">
            <NFLock />
          </div>
          <div className="score-badge">
            <span className="num">{score}</span>
            <span className="sub">FIT SCORE</span>
          </div>
          <div className="caption-bar">
            <div className="cap">{content.caption}</div>
          </div>
        </div>
        <div className="oc-body">
          <div className="oc-stats">
            {content.scores.map((s) => (
              <MStat key={s.id} s={toMStat(s)} run={run} />
            ))}
          </div>
          <div className="oc-foot">
            <span className="kind-tag">FIT / PHYSIQUE READ</span>
            <Bars seed={88} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- RECEIPT -------------------------------- */

/**
 * nFactorial Dating Receipt — the kit's `Receipt` + `NFReceipt` seal/watermark, with
 * the faux QR replaced by a real scannable `<QrCode>` linking to the site.
 */
export function NFReceipt({ content }: { content: DatingReceiptResult }) {
  const verdictLabel = VERDICT_LABEL[content.datingVerdict];
  return (
    <div className="asset receipt nf-receipt">
      <div className="r-edge top" />
      <div className="receipt-inner">
        <img className="nf-rcpt-wm" src={nfLogo} alt="" aria-hidden="true" />
        <div className="nf-rcpt-seal">
          <img src={nfLogo} alt="nFactorial" />
        </div>
          <div className="r-head">
            <div className="logo">FITAURA</div>
            <div className="sub">DATING RECEIPT</div>
          </div>
          <div className="r-meta">
            <span>NO. {content.generationId}</span>
            <span>·</span>
            <span>{receiptDate(content.generatedAt)}</span>
          </div>
          <hr className="r-dotted" />
          <div className="r-rows">
            {content.rows.map((row) => (
              <div className="r-row" key={row.id}>
                <span className="k">{row.label}</span>
                <span className="lead" />
                <span className={'v ' + (!row.tone || row.tone === 'default' ? '' : row.tone)}>
                  {String(row.value)}
                </span>
              </div>
            ))}
          </div>
          <div className="r-subtotal">
            <span>{content.rows.length} metrics analyzed</span>
            <span>1 credit</span>
          </div>
          <hr className="r-dotted" />
          <div className="r-verdict">
            <div className="lbl">CATEGORICAL VERDICT</div>
            <div className="r-stamp-big">{verdictLabel}</div>
          </div>
          <div className="r-punch">
            <div className="eyebrow">— FINAL READING —</div>
            <div className="big">{content.finalPunchline}</div>
          </div>
          <div className="r-invite">
            <div className="r-qr" aria-hidden="true">
              <QrCode value={SITE_URL} />
            </div>
            <div className="r-invite-copy">
              <div className="r-invite-eye">↓ SCAN TO INVITE</div>
              <div className="r-invite-h">
                Get your
                <br />
                friends scored
              </div>
              <div className="r-invite-sub">FITAURA · {content.generationId}</div>
            </div>
          </div>
        </div>
        <div className="r-edge bottom" />
      </div>
  );
}
