import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  VERDICT_COLOR_VAR,
  VERDICT_LABEL,
  type DatingVerdict,
} from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { receiptDateTime } from '../../lib/format';
import { useGeneration, type GenerationResult } from '../../state/generation';
import { useAccount } from '../account/AccountContext';
import type { ScanMode } from './modes';

const FILTERS: { id: 'all' | DatingVerdict; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'green_flag', label: 'Green flag' },
  { id: 'normie', label: 'Normie' },
  { id: 'red_flag', label: 'Red flag' },
];

/** Outfit-led preview thumbnail for one saved Solo verdict. */
function OutfitThumb({ r, onOpen }: { r: GenerationResult; onOpen: (r: GenerationResult) => void }) {
  const img = r.outfit?.card.imageUrl ?? r.face?.card.imageUrl ?? null;
  return (
    <div
      className="vlt-thumb"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(r)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(r);
        }
      }}
    >
      {img ? <img className="img" src={img} alt="" /> : <span className="figure" />}
      <span className="hatch" />
      <span className="scrim" />
      <span className="vdot">
        <span className="d" />
        {VERDICT_LABEL[r.verdict]}
      </span>
      {r.outfit ? (
        <div className="badge">
          <span className="num">{r.outfit.card.overallScore}</span>
          <span className="sub">FIT</span>
        </div>
      ) : r.face ? (
        <div className="badge">
          <span className="num">{r.face.analysis.aura}</span>
          <span className="sub">AURA</span>
        </div>
      ) : null}
      {r.outfit && <div className="cap">{r.outfit.card.caption}</div>}
    </div>
  );
}

/** One saved Solo verdict card. */
function SoloCard({
  r,
  menuOpen,
  onMenu,
  onOpen,
  onAction,
}: {
  r: GenerationResult;
  menuOpen: boolean;
  onMenu: (id: string | null) => void;
  onOpen: (r: GenerationResult) => void;
  onAction: (kind: 'open' | 'download' | 'studio' | 'rename' | 'delete', r: GenerationResult) => void;
}) {
  const vc = VERDICT_COLOR_VAR[r.verdict];
  const id = r.name || r.receipt.generationId;
  return (
    <article className="vlt-card" style={{ ['--vc']: vc } as CSSProperties}>
      <OutfitThumb r={r} onOpen={onOpen} />
      <div className="vlt-assets" aria-label="What this verdict contains">
        {r.face && (
          <span className="a on">
            <span className="gd" />
            Face
          </span>
        )}
        {r.outfit && (
          <span className="a on">
            <span className="gd" />
            Outfit
          </span>
        )}
        <span className="a on">
          <span className="gd" />
          Receipt
        </span>
      </div>
      <div className="vlt-foot">
        <div className="vlt-meta">
          <span className="vd">{VERDICT_LABEL[r.verdict]}</span>
          <span className="id">
            {id} · {receiptDateTime(r.producedAt)}
          </span>
        </div>
        <div className="vlt-actions">
          <button className="vlt-ic" title="Open verdict" aria-label="Open verdict" onClick={() => onOpen(r)}>
            <Icon.open />
          </button>
          <button className="vlt-ic" title="Download cards" aria-label="Download cards" onClick={() => onAction('download', r)}>
            <Icon.download />
          </button>
          <button
            className="vlt-ic"
            title="More"
            aria-label="More actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              onMenu(menuOpen ? null : r.receipt.generationId);
            }}
          >
            <Icon.dots />
          </button>
          {menuOpen && (
            <div className="vlt-cardmenu" role="menu" onClick={(e) => e.stopPropagation()}>
              <button role="menuitem" onClick={() => onAction('open', r)}>
                <Icon.open /> Open verdict
              </button>
              <button role="menuitem" onClick={() => onAction('download', r)}>
                <Icon.download /> Download all 3 cards
              </button>
              <button role="menuitem" onClick={() => onAction('studio', r)}>
                <Icon.layers /> Edit in Card Studio
              </button>
              <button role="menuitem" onClick={() => onAction('rename', r)}>
                <Icon.pencil /> Rename
              </button>
              <button role="menuitem" className="danger" onClick={() => onAction('delete', r)}>
                <Icon.trash /> Delete from device
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CreateTile({ onScan }: { onScan: () => void }) {
  return (
    <button className="vlt-card vlt-create" onClick={onScan}>
      <span className="ic">
        <Icon.plus />
      </span>
      <span className="tt">Run a new scan</span>
      <span className="sb">1 CREDIT · FACE · OUTFIT · RECEIPT</span>
    </button>
  );
}

/** Solo Scan mode content — the live MVP mode. */
export function SoloMode({ mode }: { mode: ScanMode }) {
  const navigate = useNavigate();
  const { history, startNewScan, openResult, removeResult, renameResult, hydrated } = useGeneration();
  const { signedIn, flash, credits, canScan } = useAccount();
  const [filter, setFilter] = useState<'all' | DatingVerdict>('all');
  const [menu, setMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const hasResults = hydrated && history.length > 0;
  const counts = history.reduce<Record<string, number>>((m, r) => {
    m[r.verdict] = (m[r.verdict] || 0) + 1;
    return m;
  }, {});
  const shown = history.filter((r) => filter === 'all' || r.verdict === filter);

  const onScan = () => {
    startNewScan();
    navigate('/scan');
  };
  const onBuy = () => navigate('/credits');

  const onOpen = (r: GenerationResult) => {
    if (openResult(r.receipt.generationId)) {
      // Open on the first card (01 Face), not whatever tab was last viewed.
      localStorage.setItem('fitaura.tab', 'face');
      navigate('/result#face');
    } else flash('That result is no longer on this device.');
  };

  const act = (kind: 'open' | 'download' | 'studio' | 'rename' | 'delete', r: GenerationResult) => {
    setMenu(null);
    if (kind === 'open' || kind === 'download' || kind === 'studio') return onOpen(r);
    if (kind === 'rename') {
      const name = window.prompt('Rename this verdict', r.name || r.receipt.generationId);
      if (name != null) {
        renameResult(r.receipt.generationId, name);
        flash('Renamed on this device');
      }
      return;
    }
    if (kind === 'delete') {
      removeResult(r.receipt.generationId);
      flash('Removed from this device');
    }
  };

  // Credit indicator: signed-in shows balance; guests see the free-scan promise.
  const creditChip = signedIn ? (
    <span className={'vlt-credit' + (credits === 0 ? ' zero' : '')}>
      <span className="gem">
        <Icon.gem />
      </span>
      <b>{credits}</b> credits <span className="x">· 1 / scan</span>
    </span>
  ) : (
    <span className="vlt-credit free">
      <span className="gem">
        <Icon.bolt />
      </span>
      <b>1</b> free verdict
    </span>
  );

  return (
    <div>
      {/* mode header — title + blurb on the left, credits + primary action on the right */}
      <div className="vlt-head">
        <div className="vlt-head-l">
          <span className="vlt-eyebrow">SCAN MODE · AVAILABLE</span>
          <h1 className="vlt-h1">
            SOLO <span className="hl">SCAN</span>
          </h1>
          <p className="vlt-lead">{mode.blurb}</p>
        </div>
        <div className="vlt-head-r">
          {creditChip}
          {!signedIn || canScan ? (
            <button className="vlt-btn primary lg" onClick={onScan}>
              <Icon.scan /> Generate verdict
            </button>
          ) : (
            <button className="vlt-btn primary lg" onClick={onBuy}>
              <Icon.gem /> Buy credits to scan
            </button>
          )}
        </div>
      </div>

      {hasResults ? (
        <>
          <div className="vlt-colhead">
            <div>
              <span className="vlt-eyebrow">YOUR COLLECTION · ON THIS DEVICE</span>
              <h2 className="vlt-colt">
                {history.length} saved verdict{history.length === 1 ? '' : 's'}
              </h2>
            </div>
            <div className="vlt-filters" role="tablist" aria-label="Filter verdicts">
              {FILTERS.map((f) => {
                const n = f.id === 'all' ? history.length : counts[f.id] || 0;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    className="vlt-chip"
                    style={f.id !== 'all' ? ({ ['--vc']: VERDICT_COLOR_VAR[f.id] } as CSSProperties) : undefined}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.id !== 'all' && <span className="d" />}
                    {f.label}
                    <span className="ct">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="vlt-grid">
            <CreateTile onScan={!signedIn || canScan ? onScan : onBuy} />
            {shown.map((r) => (
              <SoloCard
                key={r.receipt.generationId}
                r={r}
                menuOpen={menu === r.receipt.generationId}
                onMenu={setMenu}
                onOpen={onOpen}
                onAction={act}
              />
            ))}
            {shown.length === 0 && (
              <div className="vlt-empty" style={{ gridColumn: '1 / -1', marginTop: 0, padding: '40px' }}>
                No {FILTERS.find((f) => f.id === filter)!.label.toLowerCase()} verdicts yet.
              </div>
            )}
          </div>
        </>
      ) : !hydrated ? (
        <div className="vlt-empty" style={{ minHeight: 160 }} aria-busy="true" />
      ) : (
        /* focused empty state — Generate stays dominant, mode stays selected */
        <div className="vlt-empty">
          <span className="ic">
            <Icon.scan />
          </span>
          <div className="et">No verdicts yet</div>
          <div className="es">
            Drop a face photo and an outfit photo. FitAura returns your full three-part verdict. First scan is free.
          </div>
          <div className="outs">
            {mode.outputs.map((o) => (
              <span
                key={o}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 10.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-dim)',
                  padding: '6px 11px',
                  borderRadius: 999,
                  border: '1px solid var(--hair-soft)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 9, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
                {o}
              </span>
            ))}
          </div>
          <div className="ea">
            <button className="vlt-btn primary lg" onClick={onScan}>
              <Icon.scan /> Run your first scan, free
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
