import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';

/** Friendly back-label per origin path. */
const ORIGIN_LABELS: Record<string, string> = {
  '/vault': 'Vault',
  '/result': 'Result',
  '/account': 'Account',
  '/credits': 'Pricing',
  '/settings': 'Settings',
  '/': 'Home',
};

/**
 * Shared header for the Vault's secondary pages — a back control that returns to
 * the page the user came from (tracked via router state set by ProfileMenu) plus
 * the page title. Falls back to the Vault for direct/deep-linked visits.
 */
export function SubHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const backLabel = from ? ORIGIN_LABELS[from] ?? 'Back' : 'Vault';

  const goBack = () => {
    // `from` means we arrived via an in-app push — a history pop returns there.
    if (from) navigate(-1);
    else navigate('/vault');
  };

  return (
    <div>
      <button className="vlt-back" onClick={goBack}>
        <Icon.back /> {backLabel}
      </button>
      <div className="vlt-sub-head">
        <span className="vlt-eyebrow">{eyebrow}</span>
        <h1 className="vlt-h1">{title}</h1>
        {sub && <p className="vlt-lead">{sub}</p>}
      </div>
    </div>
  );
}
