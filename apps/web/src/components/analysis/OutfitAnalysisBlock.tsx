import type { OutfitResult } from '@fitaura/shared';
import { useCountUp } from '../../lib/useCountUp';
import { capFor, bestWorst } from './TraitRow';
import { SupportingStat } from './SupportingStat';

interface OutfitAnalysisBlockProps {
  outfit: OutfitResult;
  run: boolean;
}

/**
 * Outfit Analysis Block — in-app, page-only. Short read + tags, then the
 * fit/physique trait rows. Ported from the design's `OutfitAnalysis`.
 */
export function OutfitAnalysisBlock({ outfit, run }: OutfitAnalysisBlockProps) {
  const score = useCountUp(outfit.card.overallScore, run, 1000);
  const { best, worst } = bestWorst(outfit.card.scores);
  return (
    <>
      <section className="rs-block hero">
        <div className="rs-eyebrow">IN-APP BREAKDOWN · OUTFIT</div>
        <div className="rs-scorehead">
          <div>
            <div className="rs-scorenum">
              {score}
              <span className="u">/100</span>
            </div>
            <div className="rs-scorelbl">FIT SCORE</div>
          </div>
          <div className="rs-verdictbadge">
            <span
              className="vstamp"
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              {outfit.card.caption}
            </span>
          </div>
        </div>
        <p className="rs-read">{outfit.analysis.explanation}</p>
        <div className="rs-tags">
          <span className="rs-tag good">Best · {best.label}</span>
          <span className="rs-tag bad">Watch · {worst.label}</span>
          {outfit.analysis.tags.map((tag) => (
            <span key={tag.label} className={'rs-tag ' + (tag.tone === 'good' ? 'good' : 'bad')}>
              {tag.label}
            </span>
          ))}
        </div>
      </section>
      <section className="rs-block">
        <h3 className="rs-blocktitle">
          Fit &amp; physique read <span className="n">{outfit.card.scores.length} metrics</span>
        </h3>
        <div className="rs-breakgrid">
          {outfit.card.scores.map((stat) => (
            <div className="gym-card" data-accent="blue" key={stat.id}>
              <div className="gc-top">
                <div className="gc-score">
                  <span className="num">{stat.value}</span>
                  <span className="tier">{capFor(stat.value)}</span>
                </div>
              </div>
              <div className="gc-name">{stat.label}</div>
              <div className="gc-bar"><i style={{ width: `${stat.value}%` }} /></div>
              {stat.note && <p className="gc-note">{stat.note}</p>}
            </div>
          ))}
        </div>

        {outfit.analysis.supporting && outfit.analysis.supporting.length > 0 && (
          <>
            <div className="rs-subhead">
              <span className="lbl">Supporting read</span>
              <span className="n">{outfit.analysis.supporting.length} more · optional</span>
            </div>
            <div className="rs-subgrid">
              {outfit.analysis.supporting.map((stat) => (
                <SupportingStat key={stat.id} stat={stat} run={run} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
