import { useEffect, type ReactNode } from 'react';
import { Icon } from '../../lib/icons';

type ModalSize = 'sm' | 'md' | 'lg';

interface WebModalProps {
  size?: ModalSize;
  onClose?: () => void;
  closeable?: boolean;
  children: ReactNode;
}

/** Centered desktop modal. Ported from the account UI atoms. */
export function WebModal({ size = 'md', onClose, closeable = true, children }: WebModalProps) {
  useEffect(() => {
    if (!closeable || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeable, onClose]);

  return (
    <div className="aw-scrim" onClick={closeable ? onClose : undefined}>
      <div className={'aw-modal ' + size} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {closeable && (
          <button className="aw-modal-close" onClick={onClose} aria-label="Close">
            <Icon.x />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Centered status-dialog body (icon + title + sub + actions stacked). */
export function WebDialogBody({ children }: { children: ReactNode }) {
  return (
    <div
      className="aw-modal-pad aw-dialog"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
    >
      {children}
    </div>
  );
}

interface WebFieldProps {
  label?: string;
  type?: string;
  placeholder?: string;
  lock?: boolean;
  defaultValue?: string;
  value?: string;
  inputMode?: 'numeric' | 'text' | 'email';
  onChange?: (v: string) => void;
}

/** Labelled input. Ported from the account UI atoms. */
export function WebField({ label, type = 'text', placeholder, lock, defaultValue, value, inputMode, onChange }: WebFieldProps) {
  return (
    <div className="aw-field">
      {label && <label>{label}</label>}
      <div className="aw-input-wrap">
        <input
          className="aw-input"
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
        {lock && (
          <span className="lock">
            <Icon.lock />
          </span>
        )}
      </div>
    </div>
  );
}
