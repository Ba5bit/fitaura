import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { splitPercent, type BattleWinner, type Superlative, type VersusMode } from '@fitaura/shared';
import { Icon } from '../../../lib/icons';

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

/** VS medallion (icy | gold hard-split ring) that anchors the arena + share cards. */
export function VersusMedallion({ small = false }: { small?: boolean }) {
  return (
    <div className={'vs-medal' + (small ? ' sm' : '')} aria-hidden="true">
      <span className="spin" />
      <span className="core" />
      <span className="vs">VS</span>
    </div>
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

/** One head-to-head metric: A fills from the left, B from the right. */
export function SplitBar({ label, a, b, win }: { label: string; a: number; b: number; win: BattleWinner }) {
  const pct = splitPercent(a, b);
  return (
    <div className="vs-split" data-win={win}>
      <div className="top">
        <span className="na">{a}</span>
        <span className="lab">{label}</span>
        <span className="nb">{b}</span>
      </div>
      <div className="vs-track">
        <span className="fa" style={{ width: `${pct.a}%` }} />
        <span className="fb" style={{ width: `${pct.b}%` }} />
        <span className="divline" style={{ left: `${pct.a}%` }} />
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

const MODE_LABELS: Record<VersusMode, string> = { face: 'Face', fit: 'Fit', both: 'Both' };

/** Face / Fit / Both segmented control (≥44px targets). */
export function ModeSelector({ mode, onChange }: { mode: VersusMode; onChange: (m: VersusMode) => void }) {
  return (
    <div className="vs-modes-row">
      <div className="vs-modes" role="group" aria-label="What to compare">
        {(['face', 'fit', 'both'] as VersusMode[]).map((m) => (
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
 * A single crowned superlative chip. A=icy, B=gold; the crowned side's colour
 * flows via `--c` (set on the chip). The locked chip starts as a "tap to reveal"
 * wildcard and reveals its winner on click/Enter/Space (local state).
 */
function SuperlativeChip({ item, names }: { item: Superlative; names: { a: string; b: string } }) {
  const [revealed, setRevealed] = useState(false);
  const sideVar = item.winner === 'a' ? 'var(--icy)' : 'var(--gold)';
  const who = item.winner === 'a' ? names.a : names.b;
  const locked = item.locked && !revealed;

  if (locked) {
    return (
      <button
        type="button"
        className="vs-superlative locked"
        onClick={() => setRevealed(true)}
        aria-label={`${item.label} — tap to reveal the winner`}
      >
        <span className="ic">
          <Icon.lock />
        </span>
        <span className="txt">
          <span className="lbl">{item.label}</span>
          <span className="reveal">
            <Icon.eye /> Tap to reveal
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="vs-superlative" data-side={item.winner} style={{ ['--c']: sideVar } as CSSProperties}>
      <span className="ic crown">
        <CrownGlyph size={13} />
      </span>
      <span className="txt">
        <span className="lbl">{item.label}</span>
        <span className="who">{who}</span>
      </span>
    </div>
  );
}

/**
 * The superlatives row — a row of crowned chips (A=icy, B=gold) with exactly one
 * locked "tap to reveal" wildcard. Renders nothing when there are no superlatives
 * (e.g. the dev no-AI fallback path).
 */
export function SuperlativesRow({
  items,
  names,
  heading = 'Superlatives',
}: {
  items: Superlative[];
  names: { a: string; b: string };
  heading?: string;
}) {
  if (!items.length) return null;
  return (
    <div className="vs-superlatives">
      <div className="hd">{heading}</div>
      <div className="row">
        {items.map((item, i) => (
          <SuperlativeChip key={`${item.label}-${i}`} item={item} names={names} />
        ))}
      </div>
    </div>
  );
}
