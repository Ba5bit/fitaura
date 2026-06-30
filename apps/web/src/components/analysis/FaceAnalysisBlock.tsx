import { VERDICT_LABEL, type FaceResult, type DatingVerdict } from '@fitaura/shared';
import { ScoreRing } from './ScoreRing';
import { GymCard } from './GymCard';

const FACE_LABEL_OVERRIDE: Record<string, string> = {
  jaw: 'Jawline Frame',
  presence: 'Eye Presence',
  haircut: 'Hair Match',
  grooming: 'Grooming Polish',
  'main-character': 'Facial Structure',
};


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
      </section>

      <section className="rs-block glass">
        <h3 className="rs-blocktitle">
          Score breakdown <span className="n">{analysis.breakdown.length} categories</span>
        </h3>
        <div className="rs-breakgrid">
          {analysis.breakdown.map((trait) => (
            <GymCard key={trait.id} trait={{ ...trait, label: FACE_LABEL_OVERRIDE[trait.id] ?? trait.label }} run={run} />
          ))}
        </div>
      </section>
    </>
  );
}
