import type { FaceTrait, FaceTraitIcon } from '@fitaura/shared';
import { useCountUp } from '../../lib/useCountUp';
import { TraitIcon } from './TraitIcon';

function tierOf(v: number): 'high' | 'mid' | 'low' {
  return v >= 78 ? 'high' : v >= 60 ? 'mid' : 'low';
}
const TIER_LABEL = { high: 'HIGH', mid: 'MID', low: 'LOW' } as const;

/** Word-relevant icons keyed by trait id, overriding the stored geometric icon. */
const ICON_BY_ID: Record<string, FaceTraitIcon> = {
  jaw: 'face',
  haircut: 'hair',
  grooming: 'razor',
};

/** Gym-app "Score Breakdown" trait card. Ported from the design's `GymCard`. */
export function GymCard({ trait, run }: { trait: FaceTrait; run: boolean }) {
  const tier = tierOf(trait.value);
  const n = useCountUp(trait.value, run, 1000);
  return (
    <div className="gym-card" data-tier={tier}>
      <div className="gc-top">
        <span className="gc-ico">
          <TraitIcon name={ICON_BY_ID[trait.id] ?? trait.icon} />
        </span>
        <div className="gc-score">
          <span className="num">{n}</span>
          <span className="tier">{TIER_LABEL[tier]}</span>
        </div>
      </div>
      <div className="gc-name">{trait.label}</div>
      <div className="gc-desc">{trait.descriptor}</div>
      <div className="gc-bar">
        <i style={{ width: `${trait.value}%` }} />
      </div>
    </div>
  );
}
