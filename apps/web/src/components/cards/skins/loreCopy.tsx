import type { DatingVerdict } from '@fitaura/shared';

/** Display-only collectible flavor for the Lore skin, per verdict. */
export const LORE_COPY: Record<DatingVerdict, { vol: string; rarity: string; tier: string }> = {
  red_flag: { vol: 'VOL. I', rarity: '◆◆◇', tier: 'CLASS · UNHINGED' },
  normie: { vol: 'VOL. II', rarity: '◆◇◇', tier: 'CLASS · UNDISCOVERED' },
  green_flag: { vol: 'VOL. III', rarity: '◆◆◆', tier: 'CLASS · CERTIFIED' },
};

/** A 6-dot meter filled proportionally to a 0–100 value. */
export function DotMeter({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(6, Math.round((value / 100) * 6)));
  return (
    <span className="lore-dots" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <i key={i} className={i < filled ? 'on' : ''} />
      ))}
    </span>
  );
}
