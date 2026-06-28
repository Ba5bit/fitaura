import type { OutfitCardContent, StickerData } from '@fitaura/shared';
import { NameplateOutfit } from '../../components/cards/skins/NameplateOutfit';
import exampleFit from '../../assets/example-fit.jpg';
import '../../design/nameplate-skin.css';

/**
 * DEV-ONLY preview (`/dev/cards`, gated by `import.meta.env.DEV` in App.tsx).
 *
 * The real Nameplate content (name / dossier / accent) is AI-generated inside the
 * solo-scan edge function, so it can't be seen in `npm run dev` until that
 * function is deployed. This page renders the skin directly with sample data so
 * the intended look — and the image-matched accent — can be reviewed locally
 * without a deploy. Not part of any production route.
 */
const sticker: StickerData = { id: 'preview', label: '', tone: 'accent', rotation: 0, hidden: true };

const base = (over: Partial<OutfitCardContent>): OutfitCardContent => ({
  imageUrl: exampleFit,
  caption: 'LET HIM COOK',
  overallScore: 88,
  scores: [],
  sticker,
  ...over,
});

const SAMPLES: { title: string; content: OutfitCardContent }[] = [
  {
    title: 'Full nameplate · streetwear (icy accent)',
    content: base({
      overallScore: 88,
      nameplate: {
        name: 'DENIM ARMORY',
        eyebrow: 'Double-denim, wash on wash',
        tagline: 'Built like a fortress',
        lane: 'Streetwear',
        accent: '#5b9dff',
        dossier: [
          { label: 'Signature', value: 'Trucker jacket' },
          { label: 'Rule', value: 'Tonal layering' },
          { label: 'Palette', value: 'Stonewashed blue' },
          { label: 'Finish', value: 'Clean white tee' },
        ],
      },
    }),
  },
  {
    title: 'Full nameplate · minimalist (warm accent)',
    content: base({
      overallScore: 92,
      nameplate: {
        name: 'DESERT QUIET',
        eyebrow: 'Earth tones, quiet luxury',
        tagline: 'Says nothing, owns the room',
        lane: 'Minimalist',
        accent: '#e0a85c',
        dossier: [
          { label: 'Signature', value: 'Camel overcoat' },
          { label: 'Rule', value: 'One bold neutral' },
          { label: 'Palette', value: 'Sand & tobacco' },
          { label: 'Finish', value: 'Leather loafers' },
        ],
      },
    }),
  },
  {
    title: 'Fallback · no nameplate (pre-deploy / legacy scan)',
    content: base({ caption: 'LOCKED IN', overallScore: 74 }),
  },
];

export function CardPreview() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#06070a',
        padding: '40px 24px 64px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      {SAMPLES.map((s) => (
        <div key={s.title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 360, height: 640 }}>
            <NameplateOutfit content={s.content} verdict="green_flag" gender="masc" run={false} />
          </div>
          <span
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: 12,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'rgba(243,246,249,.58)',
            }}
          >
            {s.title}
          </span>
        </div>
      ))}
    </div>
  );
}
