import { skinsFor, skinIndex } from './skins/registry';
import type { SkinKind, SkinProps } from './skins/types';

const POSE = ['front', 'backRight', 'backLeft'];

interface CardSwitcherProps {
  kind: SkinKind;
  /** Selected skin id (persisted by the parent). */
  skinId: string;
  setSkinId: (id: string) => void;
  /** Props passed to every skin (front gets run=true; peeks get preview=true). */
  skinProps: Omit<SkinProps, 'preview' | 'run'>;
  /** Overlay (sticker editor) rendered on top of the FRONT skin only. */
  overlay?: React.ReactNode;
  /** Disable switching (e.g. while editing a sticker). */
  locked?: boolean;
}

/**
 * Card-stack skin switcher. The front skin is the live, full-size, editable card
 * (the parent's overlay rides on it); peeking skins are dimmed previews. Tapping a
 * peeking card or a dot brings that skin to the front. With one skin it renders
 * only the front and no dots — visually identical to a plain card.
 */
export function CardSwitcher({ kind, skinId, setSkinId, skinProps, overlay, locked }: CardSwitcherProps) {
  const skins = skinsFor(kind);
  const active = skinIndex(kind, skinId);
  // Order the skins so the active one is first (front), preserving relative order.
  const order = [active, ...skins.map((_, i) => i).filter((i) => i !== active)];
  const n = skins.length;

  const select = (i: number) => { if (!locked) setSkinId(skins[i].id); };

  return (
    <div className="cs-switch">
      <div className="cs-deck">
        {order.map((skinIdx, stackPos) => {
          const skin = skins[skinIdx];
          const Comp = skin.Comp;
          const isFront = stackPos === 0;
          return (
            <div
              key={skin.id}
              className={'cs-card ' + (POSE[stackPos] || 'backLeft') + (isFront ? ' front-live' : '')}
              style={{ zIndex: n - stackPos }}
              aria-hidden={!isFront}
              role={isFront ? undefined : 'button'}
              aria-label={isFront ? undefined : `Switch to ${skin.name}`}
              onClick={isFront ? undefined : () => select(skinIdx)}
            >
              <Comp {...skinProps} run={isFront} preview={!isFront} />
              {isFront && overlay}
            </div>
          );
        })}
      </div>
    </div>
  );
}
