import { VERDICT_LABEL, type FaceResult, type DatingVerdict } from '@fitaura/shared';
import { ScoreRing } from './ScoreRing';
import { GymCard } from './GymCard';

interface FaceAnalysisBlockProps {
  face: FaceResult;
  verdict: DatingVerdict;
  run: boolean;
}

/**
 * Face Analysis Block — in-app, page-only breakdown (never exported).
 * Aura ring + explanation + roast, then a gym-app score-breakdown grid.
 * Ported from the design's `FaceAnalysis`.
 */
export function FaceAnalysisBlock({ face, verdict, run }: FaceAnalysisBlockProps) {
  const { analysis } = face;
  return (
    <>
      <section className="rs-block glass hero">
        <div className="rs-eyebrow">IN-APP BREAKDOWN · FACE</div>
        <div className="rs-facehead">
          <ScoreRing value={analysis.aura} label="AURA" run={run} />
          <div className="meta">
            <span className="rs-facestamp">{VERDICT_LABEL[verdict]}</span>
            <p className="rs-read">{analysis.explanation}</p>
          </div>
        </div>
        <div className="rs-roast">
          <span className="q">&ldquo;</span>
          <div>
            <div className="re">The roast</div>
            <p>{analysis.roast}</p>
          </div>
        </div>
      </section>

      <section className="rs-block glass">
        <h3 className="rs-blocktitle">
          Score breakdown <span className="n">{analysis.breakdown.length} categories</span>
        </h3>
        <div className="rs-breakgrid">
          {analysis.breakdown.map((trait) => (
            <GymCard key={trait.id} trait={trait} run={run} />
          ))}
        </div>
      </section>
    </>
  );
}
