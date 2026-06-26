import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeBattle, type BattleWinner } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { receiptDateTime } from '../../lib/format';
import { useBattle, type SavedBattle } from '../../state/battle';
import { useAccount } from '../account/AccountContext';
import type { ScanMode } from './modes';
import '../../design/versus.css';

/**
 * Vault surface for Friend vs Friend — a live launcher plus the on-device grid of
 * saved battles, mirroring SoloMode. Battles persist per-account in IndexedDB (the
 * same store Solo uses), so each verdict shows here as a card. A battle costs 2
 * credits and requires sign-in, so guests never produce one.
 */

const BATTLE_COST = 2;

const nm = (name: string, fallback: string) => name?.trim() || fallback;

const winnerName = (w: BattleWinner, b: SavedBattle) =>
  w === 'a' ? nm(b.nameA, 'Player A') : w === 'b' ? nm(b.nameB, 'Player B') : 'Dead heat';

/** Two-up contender thumbnail for one saved battle, winner color on the card. */
function BattleThumb({ b, onOpen }: { b: SavedBattle; onOpen: (b: SavedBattle) => void }) {
  const verdict = computeBattle({ mode: b.mode, face: b.result.face ?? undefined, fit: b.result.fit ?? undefined });
  const aImg = b.imgs.aFit ?? b.imgs.aFace ?? null;
  const bImg = b.imgs.bFit ?? b.imgs.bFace ?? null;
  return (
    <div
      className="vlt-thumb vlt-vs-thumb"
      style={b.palette ? ({ ['--icy']: b.palette.a, ['--gold']: b.palette.b } as CSSProperties) : undefined}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(b)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(b);
        }
      }}
    >
      <div className="vs-duo">
        <span className="h a" style={aImg ? { backgroundImage: `url("${aImg}")` } : undefined} />
        <span className="h b" style={bImg ? { backgroundImage: `url("${bImg}")` } : undefined} />
      </div>
      <span className="scrim" />
      <span className="vs-pip">VS</span>
      <div className="vs-tags">
        <span className="t a">
          <b>{verdict.overall.avgA}</b>
        </span>
        <span className="t b">
          <b>{verdict.overall.avgB}</b>
        </span>
      </div>
    </div>
  );
}

/** One saved battle card. */
function BattleCard({
  b,
  menuOpen,
  onMenu,
  onOpen,
  onAction,
}: {
  b: SavedBattle;
  menuOpen: boolean;
  onMenu: (id: string | null) => void;
  onOpen: (b: SavedBattle) => void;
  onAction: (kind: 'open' | 'rename' | 'delete', b: SavedBattle) => void;
}) {
  const verdict = computeBattle({ mode: b.mode, face: b.result.face ?? undefined, fit: b.result.fit ?? undefined });
  const winner = verdict.winner;
  const wc = winner === 'a' ? 'var(--icy)' : winner === 'b' ? 'var(--gold)' : 'var(--ink)';
  const title = b.name || `${nm(b.nameA, 'Player A')} vs ${nm(b.nameB, 'Player B')}`;
  return (
    <article className="vlt-card" style={{ ['--vc']: wc } as CSSProperties}>
      <BattleThumb b={b} onOpen={onOpen} />
      <div className="vlt-assets" aria-label="What this battle compares">
        {b.result.face && (
          <span className="a on">
            <span className="gd" />
            Face
          </span>
        )}
        {b.result.fit && (
          <span className="a on">
            <span className="gd" />
            Outfit
          </span>
        )}
        <span className="a on">
          <span className="gd" />
          Verdict
        </span>
      </div>
      <div className="vlt-foot">
        <div className="vlt-meta">
          <span className="vd">{winner === 'tie' ? 'Dead heat' : `${winnerName(winner, b)} wins`}</span>
          <span className="id">
            {title} · {receiptDateTime(b.producedAt)}
          </span>
        </div>
        <div className="vlt-actions">
          <button className="vlt-ic" title="Open verdict" aria-label="Open verdict" onClick={() => onOpen(b)}>
            <Icon.open />
          </button>
          <button
            className="vlt-ic"
            title="More"
            aria-label="More actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              onMenu(menuOpen ? null : b.battleId);
            }}
          >
            <Icon.dots />
          </button>
          {menuOpen && (
            <div className="vlt-cardmenu" role="menu" onClick={(e) => e.stopPropagation()}>
              <button role="menuitem" onClick={() => onAction('open', b)}>
                <Icon.open /> Open verdict
              </button>
              <button role="menuitem" onClick={() => onAction('rename', b)}>
                <Icon.pencil /> Rename
              </button>
              <button role="menuitem" className="danger" onClick={() => onAction('delete', b)}>
                <Icon.trash /> Delete from device
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CreateTile({ onStart }: { onStart: () => void }) {
  return (
    <button className="vlt-card vlt-create" onClick={onStart}>
      <span className="ic">
        <Icon.users />
      </span>
      <span className="tt">Start a battle</span>
      <span className="sb">{BATTLE_COST} CREDITS · ONE VERDICT</span>
    </button>
  );
}

/** Friend vs Friend mode content — now a live mode with on-device battle history. */
export function FriendMode({ mode }: { mode: ScanMode }) {
  const navigate = useNavigate();
  const { history, historyHydrated, openBattle, removeBattle, renameBattle } = useBattle();
  const { signedIn, credits, flash } = useAccount();
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

  // A signed-in user needs the full cost; guests are sent through and prompted to
  // sign in / buy when the scan tries to spend.
  const canBattle = !signedIn || credits >= BATTLE_COST;
  const onStart = () => navigate(canBattle ? '/versus' : '/credits');
  const onBuy = () => navigate('/credits');

  const onOpen = (b: SavedBattle) => {
    if (openBattle(b.battleId)) navigate('/versus/result');
    else flash('That battle is no longer on this device.');
  };

  const act = (kind: 'open' | 'rename' | 'delete', b: SavedBattle) => {
    setMenu(null);
    if (kind === 'open') return onOpen(b);
    if (kind === 'rename') {
      const name = window.prompt('Rename this battle', b.name || `${nm(b.nameA, 'Player A')} vs ${nm(b.nameB, 'Player B')}`);
      if (name != null) {
        renameBattle(b.battleId, name);
        flash('Renamed on this device');
      }
      return;
    }
    if (kind === 'delete') {
      removeBattle(b.battleId);
      flash('Removed from this device');
    }
  };

  const hasResults = historyHydrated && history.length > 0;

  const creditChip = signedIn ? (
    <span className={'vlt-credit' + (credits < BATTLE_COST ? ' zero' : '')}>
      <span className="gem">
        <Icon.gem />
      </span>
      <b>{credits}</b> credits <span className="x">· {BATTLE_COST} / battle</span>
    </span>
  ) : (
    <span className="vlt-credit free">
      <span className="gem">
        <Icon.users />
      </span>
      Head-to-head · {BATTLE_COST} credits
    </span>
  );

  return (
    <div>
      <div className="vlt-head">
        <div className="vlt-head-l">
          <span className="vlt-eyebrow">SCAN MODE · AVAILABLE</span>
          <h1 className="vlt-h1">
            FRIEND VS <span className="hl">FRIEND</span>
          </h1>
          <p className="vlt-lead">{mode.blurb}</p>
        </div>
        <div className="vlt-head-r">
          {creditChip}
          {canBattle ? (
            <button className="vlt-btn primary lg" onClick={onStart}>
              <Icon.users /> Start a battle
            </button>
          ) : (
            <button className="vlt-btn primary lg" onClick={onBuy}>
              <Icon.gem /> Buy credits to battle
            </button>
          )}
        </div>
      </div>

      {hasResults ? (
        <>
          <div className="vlt-colhead">
            <div>
              <span className="vlt-eyebrow">YOUR BATTLES · ON THIS DEVICE</span>
              <h2 className="vlt-colt">
                {history.length} saved battle{history.length === 1 ? '' : 's'}
              </h2>
            </div>
          </div>

          <div className="vlt-grid">
            <CreateTile onStart={canBattle ? onStart : onBuy} />
            {history.map((b) => (
              <BattleCard
                key={b.battleId}
                b={b}
                menuOpen={menu === b.battleId}
                onMenu={setMenu}
                onOpen={onOpen}
                onAction={act}
              />
            ))}
          </div>
        </>
      ) : !historyHydrated ? (
        <div className="vlt-empty" style={{ minHeight: 160 }} aria-busy="true" />
      ) : (
        <div className="vlt-empty">
          <span className="ic">
            <Icon.users />
          </span>
          <div className="et">No battles yet</div>
          <div className="es">Put two people head to head and crown a winner. {BATTLE_COST} credits per battle.</div>
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
            <button className="vlt-btn primary lg" onClick={onStart}>
              <Icon.users /> Start your first battle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
