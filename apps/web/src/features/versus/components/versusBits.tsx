import { useEffect, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { splitPercent, type BattleWinner, type DerivedRead, type VersusMode } from '@fitaura/shared';
import { useCountUp } from '../../../lib/useCountUp';

/** Per-row delay for the first-view stats reveal (top-to-bottom stagger). */
export const SPLIT_STAGGER_MS = 110;

/**
 * Small, stateless view primitives for Friend vs Friend. All contender coloring
 * flows from the `.vs-c[data-side]` wrapper (which sets `--c` and remaps
 * `--accent`), so these read `--c` rather than hardcoding the contender colours.
 */

/** The bare Fitaura mountain glyph (no positioning) — for inline use in banners. */
export function CrownGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M3 7l4 4 5-7 5 7 4-4v11H3z" />
    </svg>
  );
}

/** The winner's gold crown, absolutely positioned above an avatar/frame. */
export function Crown({ size = 34 }: { size?: number }) {
  return (
    <span className="vs-crown" aria-hidden="true">
      <CrownGlyph size={size} />
    </span>
  );
}

/** Primary CTA — Solo's calm accent-on-subtle-fill button (.vs-cta). */
export function DualGlowButton({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="vs-cta" {...rest}>
      {children}
    </button>
  );
}

/** Lime green-flag / red-flag / gold (reserved) chip. */
export function FlagChip({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'red' | 'gold' }) {
  return (
    <span className={'vs-flag' + (tone === 'red' ? ' red' : tone === 'gold' ? ' gold' : '')}>
      <span className="gd" />
      {children}
    </span>
  );
}

/**
 * One head-to-head metric: A fills from the left, B from the right. On the
 * first-view reveal the row fades in, the numbers count up and the bars grow
 * from empty — staggered top-to-bottom by `index`. `reveal=false` (revisits,
 * reduced-motion) renders the final state immediately.
 */
export function SplitBar({
  label,
  a,
  b,
  win,
  reveal = false,
  index = 0,
}: {
  label: string;
  a: number;
  b: number;
  win: BattleWinner;
  reveal?: boolean;
  index?: number;
}) {
  const pct = splitPercent(a, b);
  const delay = reveal ? index * SPLIT_STAGGER_MS : 0;
  const na = useCountUp(a, reveal, 820, delay);
  const nb = useCountUp(b, reveal, 820, delay);

  // Bars grow once the row's stagger delay elapses (the CSS width transition
  // does the easing). Stay collapsed during the delay so the fill animates in.
  const [grown, setGrown] = useState(!reveal);
  useEffect(() => {
    if (!reveal) {
      setGrown(true);
      return;
    }
    setGrown(false);
    const t = setTimeout(() => setGrown(true), delay);
    return () => clearTimeout(t);
  }, [reveal, delay]);
  const wa = grown ? pct.a : 0;
  const wb = grown ? pct.b : 0;

  return (
    <div
      className="vs-split"
      data-win={win}
      data-reveal={reveal ? '1' : undefined}
      style={{ ['--i']: index } as CSSProperties}
    >
      <div className="top">
        <span className="na">{na}</span>
        <span className="lab">{label}</span>
        <span className="nb">{nb}</span>
      </div>
      <div className="vs-track">
        <span className="fa" style={{ width: `${wa}%` }} />
        <span className="fb" style={{ width: `${wb}%` }} />
        <span className="divline" style={{ left: `${wa}%` }} />
      </div>
    </div>
  );
}

/** Crowned-or-dimmed avatar in a conic ring. Lives inside a `.vs-c` wrapper. */
export function CrownAvatar({ photo, crowned, name }: { photo?: string; crowned: boolean; name: string }) {
  return (
    <div className="vs-avatar">
      <span className="halo" />
      {crowned && <Crown />}
      <span className="ring" />
      {photo ? <img className="photo" src={photo} alt={name} /> : <span className="ph" aria-hidden="true" />}
    </div>
  );
}

const MODE_LABELS: Record<VersusMode, string> = { face: 'Face', fit: 'Fit' };

/** Face / Fit segmented control (≥44px targets). */
export function ModeSelector({ mode, onChange }: { mode: VersusMode; onChange: (m: VersusMode) => void }) {
  return (
    <div className="vs-modes-row">
      <div className="vs-modes" role="group" aria-label="What to compare">
        {(['face', 'fit'] as VersusMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className="vs-mode"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One verdict breakdown read — the "joke" half (badge + funny title + tag) and the
 * "read" half (metric, subject name, score, tier, bar, and the human read line).
 * `--c` is the subject side's colour; roast rows flip the score/tier/bar/tag to red
 * via `[data-roast]` (handled in CSS). All numbers come from `DerivedRead` (which
 * `deriveReads` resolves from the real metric), never from the prose.
 */
export function VerdictReadRow({ read }: { read: DerivedRead }) {
  const sideVar = read.side === 'a' ? 'var(--icy)' : 'var(--gold)';
  return (
    <div
      className="vs-readrow"
      data-side={read.side}
      data-roast={read.isRoast ? '1' : undefined}
      style={{ ['--c']: sideVar } as CSSProperties}
    >
      <div className="joke">
        <span className="badge" aria-hidden="true">
          <CrownGlyph size={15} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="title">{read.title}</div>
          <div className="tag">{read.tag}</div>
        </div>
      </div>
      <div className="read">
        <div className="rtop">
          <div style={{ minWidth: 0 }}>
            <div className="mlabel">{read.metricLabel}</div>
            <div className="name">{read.name}</div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div className="score">{read.score}</div>
            <div className="tier">{read.tier}</div>
          </div>
        </div>
        <div className="bar">
          <i style={{ width: `${read.score}%` }} />
        </div>
        <p className="why">{read.reason}</p>
      </div>
    </div>
  );
}
