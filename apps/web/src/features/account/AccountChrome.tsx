import { Link, useLocation, useNavigate } from 'react-router-dom';
import { VERDICT_COLOR_VAR, VERDICT_LABEL, type DatingVerdict } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { receiptDate } from '../../lib/format';
import { useGeneration } from '../../state/generation';
import { useAccount } from './AccountContext';
import type { CSSProperties } from 'react';

/* ============================ NAV (account-area surfaces) ============================ */
export function AccountNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signedIn, user, openAuth } = useAccount();
  const { credits, isFree } = useGeneration();

  const links: { to: string; label: string }[] = [
    { to: '/', label: 'Home' },
    { to: '/credits', label: 'Credits' },
    { to: '/results', label: 'My results' },
    { to: '/storage', label: 'Storage' },
  ];

  let chip;
  if (signedIn) {
    chip = (
      <button className="aw-chip" onClick={() => navigate('/credits')}>
        <span className="gem">
          <Icon.gem />
        </span>
        <b>{credits}</b> credits
      </button>
    );
  } else if (isFree) {
    chip = (
      <button className="aw-chip free" onClick={() => navigate('/scan')}>
        <span className="gem">
          <Icon.bolt />
        </span>
        1 FREE VERDICT
      </button>
    );
  } else {
    chip = (
      <button className="aw-chip zero" onClick={openAuth}>
        <span className="gem">
          <Icon.gem />
        </span>
        <b>0</b> credits
      </button>
    );
  }

  return (
    <nav className="aw-nav">
      <Link className="aw-brand" to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="dot" />
        <span className="wm">FITAURA</span>
      </Link>
      <div className="aw-nav-links">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={pathname === l.to ? 'on' : ''}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="aw-nav-right">
        {chip}
        <button
          className={'aw-avatar' + (signedIn ? '' : ' guest')}
          onClick={() => (signedIn ? navigate('/account') : openAuth())}
          aria-label="Account"
        >
          {signedIn ? user?.initial : <Icon.user />}
        </button>
      </div>
    </nav>
  );
}

/* ============================ ACCOUNT ENTRY (chip + avatar) ============================ */
/** The balance chip + profile avatar, for embedding into any existing nav. */
export function AccountEntry() {
  const navigate = useNavigate();
  const { signedIn, user, openAuth } = useAccount();
  const { credits, isFree } = useGeneration();

  let chip;
  if (signedIn) {
    chip = (
      <button className="aw-chip" onClick={() => navigate('/credits')}>
        <span className="gem">
          <Icon.gem />
        </span>
        <b>{credits}</b> credits
      </button>
    );
  } else if (isFree) {
    chip = (
      <button className="aw-chip free" onClick={() => navigate('/scan')}>
        <span className="gem">
          <Icon.bolt />
        </span>
        1 FREE VERDICT
      </button>
    );
  } else {
    chip = (
      <button className="aw-chip zero" onClick={openAuth}>
        <span className="gem">
          <Icon.gem />
        </span>
        <b>0</b> credits
      </button>
    );
  }

  return (
    <div className="aw-nav-right">
      {chip}
      <button
        className={'aw-avatar' + (signedIn ? '' : ' guest')}
        onClick={() => (signedIn ? navigate('/account') : openAuth())}
        aria-label="Account"
      >
        {signedIn ? user?.initial : <Icon.user />}
      </button>
    </div>
  );
}

/* ============================ RESULT TILE ============================ */
export interface ResultSummary {
  id: string;
  verdict: DatingVerdict;
  date: string;
  missing?: boolean;
}

export function ResultTile({
  result,
  onOpen,
  compact,
}: {
  result: ResultSummary;
  onOpen: (r: ResultSummary) => void;
  compact?: boolean;
}) {
  if (result.missing) {
    return (
      <button className="aw-result broken" onClick={() => onOpen(result)}>
        <Icon.ghost />
        <span className="dt">{result.id}</span>
        <span className="dt">unavailable</span>
      </button>
    );
  }
  const color = VERDICT_COLOR_VAR[result.verdict];
  return (
    <button
      className="aw-result"
      onClick={() => onOpen(result)}
      style={{ ['--vc']: color } as CSSProperties}
    >
      <span className="stripe" />
      <span className="gd" style={{ background: color, color }} />
      <span className="vd" style={{ fontSize: compact ? '13px' : '20px' }}>
        {VERDICT_LABEL[result.verdict]}
      </span>
      <span className="dt">{result.date}</span>
    </button>
  );
}

/** Adapt the on-device history into result tiles. */
export function useResultTiles(): ResultSummary[] {
  const { history } = useGeneration();
  return history.map((h) => ({
    id: h.receipt.generationId,
    verdict: h.verdict,
    date: receiptDate(h.producedAt),
  }));
}

/* ============================ UNLOCK LIST (what 1 credit buys) ============================ */
const UNLOCKS: { t: string; tag: string }[] = [
  { t: 'Face Card', tag: 'shareable' },
  { t: 'Outfit Check Card', tag: 'shareable' },
  { t: 'Dating Score Receipt', tag: 'shareable' },
  { t: 'Full face & outfit analysis', tag: 'in-app' },
];

export function UnlockList() {
  return (
    <div className="aw-unlock">
      <div className="h">
        <span className="bolt">
          <Icon.bolt />
        </span>
        1 credit unlocks the whole verdict
      </div>
      <ul>
        {UNLOCKS.map((it) => (
          <li key={it.t}>
            <span className="ck">
              <Icon.check />
            </span>
            {it.t}
            <span className="tag">{it.tag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
