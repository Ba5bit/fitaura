import {
  VERDICT_LABEL,
  type DatingReceiptResult,
  type ReceiptPaper,
  type ReceiptRowTone,
} from '@fitaura/shared';
import { Bars } from './Bars';
import { receiptDate } from '../../lib/format';

interface ReceiptProps {
  content: DatingReceiptResult;
  paper?: ReceiptPaper;
  /** Whether the verdict seal/stamp is shown (sticker toggle). */
  sealOn?: boolean;
}

const TONE_CLASS: Record<ReceiptRowTone, string> = {
  default: '',
  good: 'good',
  hi: 'hi',
};

/**
 * Dating Score Receipt — the final combined verdict as a stylised digital
 * cheque. The single categorical verdict is shown prominently and is kept
 * separate from the final viral punchline. Ported from the design's `Receipt`.
 */
export function Receipt({ content, paper = 'neon', sealOn = true }: ReceiptProps) {
  const verdictLabel = VERDICT_LABEL[content.datingVerdict];
  const stamp = content.stamp ?? ['FITAURA', 'VERIFIED'];
  return (
    <div className="asset receipt" data-style={paper} data-verdict={content.datingVerdict}>
      <div className="r-edge top" />
      <div className="receipt-inner">
        {sealOn && (
          <div className="r-seal">
            {stamp[0]}
            <br />
            {stamp[1]}
          </div>
        )}
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
          <div className="r-stamp-big">{verdictLabel}</div>
        </div>
        <div className="r-punch">
          <div className="eyebrow">— FINAL READING —</div>
          <div className="big">{content.finalPunchline}</div>
        </div>
        <div className="r-barcode">
          <Bars seed={content.generationId.length * 13 + 4} count={48} height="36px" />
          <span className="id">FITAURA · {content.generationId}</span>
        </div>
      </div>
      <div className="r-edge bottom" />
    </div>
  );
}
