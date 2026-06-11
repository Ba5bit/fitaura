import { VERDICT_LABEL, type DatingReceiptResult } from '@fitaura/shared';
import { Icon } from '../../lib/icons';

interface ReceiptSummaryBlockProps {
  receipt: DatingReceiptResult;
  onExportAll: () => void;
  onShare: () => void;
  onSaveHistory: () => void;
  onNewScan: () => void;
}

/**
 * Receipt final-summary block — in-app, page-only. Headline score + verdict,
 * the summary read (led by the punchline), and the primary result actions.
 * Ported from the design's `ReceiptSummary`.
 */
export function ReceiptSummaryBlock({
  receipt,
  onExportAll,
  onShare,
  onSaveHistory,
  onNewScan,
}: ReceiptSummaryBlockProps) {
  return (
    <section className="rs-block hero rs-summary">
      <div className="rs-eyebrow">FINAL SUMMARY</div>
      <div className="rs-scorehead">
        <div>
          <div className="rs-scorenum">
            {receipt.datingScore}
            <span className="u">/10</span>
          </div>
          <div className="rs-scorelbl">DATING SCORE</div>
        </div>
        <div className="rs-verdictbadge">
          <span className="vstamp">{VERDICT_LABEL[receipt.datingVerdict]}</span>
        </div>
      </div>
      <p className="rs-read">
        <span className="hl">{receipt.finalPunchline}.</span> {receipt.summary}
      </p>
      <div className="rs-summary-actions">
        <button className="rs-bigbtn primary" onClick={onExportAll}>
          <Icon.download />
          Export all 3 cards
        </button>
        <button className="rs-bigbtn" onClick={onShare}>
          <Icon.share />
          Share verdict
        </button>
        <button className="rs-bigbtn" onClick={onSaveHistory}>
          <Icon.bookmark />
          Save to history
        </button>
        <button className="rs-bigbtn danger" onClick={onNewScan}>
          <Icon.refresh />
          New scan
        </button>
      </div>
      <div className="rs-summary-foot">
        <Icon.lock width={13} height={13} />
        Photos never stored on our servers · result lives on this device
      </div>
    </section>
  );
}
