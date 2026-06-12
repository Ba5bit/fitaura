import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../lib/icons';

type ModalSize = 'sm' | 'md' | 'lg';

interface WebModalProps {
  size?: ModalSize;
  onClose?: () => void;
  closeable?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Centered desktop modal with Esc-close, a focus trap and focus return. */
export function WebModal({ size = 'md', onClose, closeable = true, children }: WebModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = modalRef.current;
    const restoreTo = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    // Move focus into the dialog on open.
    (focusables()[0] ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeable && onClose) {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Return focus to whatever opened the modal.
      restoreTo?.focus?.();
    };
  }, [closeable, onClose]);

  return (
    <div className="aw-scrim" onClick={closeable ? onClose : undefined}>
      <div
        ref={modalRef}
        className={'aw-modal ' + size}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
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
