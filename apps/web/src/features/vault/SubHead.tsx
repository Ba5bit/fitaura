import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';

/** Shared header for the Vault's secondary pages — a back-to-Vault control + title. */
export function SubHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  const navigate = useNavigate();
  return (
    <div>
      <button className="vlt-back" onClick={() => navigate('/vault')}>
        <Icon.back /> Vault
      </button>
      <div className="vlt-sub-head">
        <span className="vlt-eyebrow">{eyebrow}</span>
        <h1 className="vlt-h1">{title}</h1>
        {sub && <p className="vlt-lead">{sub}</p>}
      </div>
    </div>
  );
}
