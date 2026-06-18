import { VERDICT_LABEL, type DatingReceiptResult, type ReceiptRowTone } from '@fitaura/shared';
import { SITE_URL } from '../../lib/qr';
import { QrCode } from './QrCode';

interface ReceiptPremiumProps {
  content: DatingReceiptResult;
}

const TONE_CLASS: Record<ReceiptRowTone, string> = { default: '', good: 'good', hi: 'hi' };

/**
 * Premium receipt — a sleek "verified pass": iridescent holo strip, big neon
 * verdict, frosted data panel, and a real scannable QR to the homepage. Built in
 * system tokens; the accent follows the card's gender identity (set via
 * `data-gender` on the mount, as the face/outfit cards do). Verdict colour stays
 * semantic. Ported from the Card Studio v2 prototype, no gold-on-gold.
 */
export function ReceiptPremium({ content }: ReceiptPremiumProps) {
  const verdictLabel = VERDICT_LABEL[content.datingVerdict];
  return (
    <div className="asset rcp" data-verdict={content.datingVerdict}>
      <div className="rcp-glow" aria-hidden="true" />
      <div className="rcp-inner">
        <div className="rcp-top">
          <div className="rcp-brand"><span className="rcp-dot" />FITAURA</div>
          <div className="rcp-passtag">VERIFIED PASS</div>
        </div>

        <div className="rcp-holo" aria-hidden="true">
          <span>DATING DOSSIER · FITAURA · DATING DOSSIER · FITAURA ·</span>
        </div>

        <div className="rcp-hero">
          <span className="rcp-vlabel">CATEGORICAL VERDICT</span>
          <span className="rcp-stamp">{verdictLabel}</span>
          <span className="rcp-punch">{content.finalPunchline}</span>
        </div>

        <div className="rcp-rows">
          {content.rows.map((row) => (
            <div className="rcp-row" key={row.id}>
              <span className="rk">{row.label}</span>
              <span className="rlead" />
              <span className={'rv ' + TONE_CLASS[row.tone ?? 'default']}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className="rcp-foot">
          <QrCode value={SITE_URL} className="rcp-qr" />
          <div className="rcp-foottext">
            <div className="rcp-seal">SCAN TO PLAY</div>
            <div className="rcp-meta">GET YOUR FRIENDS SCORED</div>
            <div className="rcp-meta">NO. {content.generationId} · FITAURA.STUDIO</div>
          </div>
        </div>
      </div>
    </div>
  );
}
