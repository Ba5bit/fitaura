import { VERDICT_LABEL, type DatingReceiptResult, type ReceiptRowTone } from '@fitaura/shared';
import { receiptDate } from '../../lib/format';
import { SITE_URL } from '../../lib/qr';
import { QrCode } from './QrCode';

interface ReceiptPremiumProps {
  content: DatingReceiptResult;
}

const TONE_CLASS: Record<ReceiptRowTone, string> = { default: '', good: 'good', hi: 'hi' };

/**
 * Premium receipt — the familiar Dating Score Receipt, dressed up: a neon
 * verdict box, a FITAURA VERIFIED seal, and a real scannable QR + invite footer
 * in place of the barcode. It reuses the `.receipt` base class so it inherits the
 * dark thermal styling AND the correct export/centering geometry (so it never
 * clips like a custom-width card would). Built in system tokens; verdict colour
 * stays semantic. Adopts the prototype's receipt style.
 */
export function ReceiptPremium({ content }: ReceiptPremiumProps) {
  const verdictLabel = VERDICT_LABEL[content.datingVerdict];
  return (
    <div className="asset receipt receipt-premium" data-style="premium" data-verdict={content.datingVerdict}>
      <div className="receipt-inner">
        <div className="rcp-seal" aria-hidden="true">
          <span>FITAURA</span>
          <span>VERIFIED</span>
        </div>
        <div className="r-head">
          <div className="logo">FITAURA</div>
          <div className="sub">DATING SCORE RECEIPT</div>
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
              <span className={'v ' + TONE_CLASS[row.tone ?? 'default']}>{row.value}</span>
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
          <div className="r-stamp-big rcp-vbox">{verdictLabel}</div>
        </div>
        <div className="r-punch">
          <div className="eyebrow">— FINAL READING —</div>
          <div className="big">{content.finalPunchline}</div>
        </div>
        <div className="rcp-foot">
          <QrCode value={SITE_URL} className="rcp-qr" />
          <div className="rcp-foottext">
            <div className="rcp-cta">SCAN TO INVITE</div>
            <div className="rcp-meta">GET YOUR FRIENDS SCORED</div>
            <div className="rcp-meta">FITAURA · {content.generationId}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
