// apps/web/src/components/cards/EditionLockup.tsx
import nfLogo from '../../assets/nfactorial-logo.png';

/**
 * Co-brand lockup laid over an Edition-skinned card: "FITAURA × nFACTORIAL" with
 * the ¡n! mark. Positioned by `nfactorial-skin.css` (.nf-lockup) per card kind.
 */
export function EditionLockup({ kind }: { kind: 'face' | 'outfit' | 'receipt' }) {
  return (
    <div className={'nf-lockup nf-lockup--' + kind} aria-hidden="true">
      <span className="brand">FITAURA</span>
      <span className="x">×</span>
      <img className="chip" src={nfLogo} alt="" />
    </div>
  );
}
